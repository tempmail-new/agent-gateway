import { z } from "zod";

import type { GatewayRequest } from "../types.js";
import { estimateTokens } from "./token-estimate.js";
import type { AgentProvider, ProviderResult } from "./types.js";
import { ProviderError } from "./types.js";

export interface OpenAICompatibleProviderConfig {
  apiKey: string;
  baseUrl: string;
  maxAttempts: number;
  timeoutMs: number;
}

const retryableUpstreamStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const chatCompletionResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.string(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    usage: z
      .object({
        completion_tokens: z.number().int().nonnegative().optional(),
        prompt_tokens: z.number().int().nonnegative().optional(),
      })
      .optional(),
  })
  .passthrough();

export class OpenAICompatibleProvider implements AgentProvider {
  readonly name = "openai-compatible";

  private readonly chatCompletionsUrl: string;

  constructor(
    private readonly config: OpenAICompatibleProviderConfig,
    private readonly fetchImpl: typeof fetch = globalThis.fetch,
  ) {
    this.chatCompletionsUrl = new URL(
      "chat/completions",
      ensureTrailingSlash(config.baseUrl),
    ).toString();
  }

  async complete(request: GatewayRequest): Promise<ProviderResult> {
    let attempt = 0;

    while (attempt < this.config.maxAttempts) {
      attempt += 1;

      try {
        const response = await this.fetchImpl(this.chatCompletionsUrl, {
          body: JSON.stringify({
            messages: [{ content: request.input, role: "user" }],
            model: request.model,
          }),
          headers: {
            authorization: `Bearer ${this.config.apiKey}`,
            "content-type": "application/json",
          },
          method: "POST",
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        if (!response.ok) {
          if (shouldRetryUpstreamStatus(response.status) && attempt < this.config.maxAttempts) {
            continue;
          }

          throw new ProviderError(
            this.name,
            "provider_upstream_error",
            502,
            "Provider returned an unsuccessful response",
            { attemptCount: attempt, upstreamStatus: response.status },
          );
        }

        const body = await parseJsonResponse(this.name, response, attempt);
        const parsed = chatCompletionResponseSchema.safeParse(body);

        if (!parsed.success) {
          throw new ProviderError(
            this.name,
            "provider_bad_response",
            502,
            "Provider response did not match the expected chat completion shape",
            { attemptCount: attempt },
          );
        }

        const output = parsed.data.choices[0]?.message.content;

        if (output === undefined || output.length === 0) {
          throw new ProviderError(
            this.name,
            "provider_bad_response",
            502,
            "Provider response did not include message content",
            { attemptCount: attempt },
          );
        }

        return {
          observability: {
            attemptCount: attempt,
            upstreamStatus: response.status,
          },
          output,
          usage: {
            inputTokens: parsed.data.usage?.prompt_tokens ?? estimateTokens(request.input),
            outputTokens: parsed.data.usage?.completion_tokens ?? estimateTokens(output),
          },
        };
      } catch (error) {
        if (error instanceof ProviderError) {
          throw error;
        }

        if (isTimeoutError(error)) {
          if (attempt < this.config.maxAttempts) {
            continue;
          }

          throw new ProviderError(
            this.name,
            "provider_timeout",
            504,
            "Provider request timed out",
            {
              attemptCount: attempt,
              timeoutMs: this.config.timeoutMs,
            },
          );
        }

        if (attempt < this.config.maxAttempts) {
          continue;
        }

        throw new ProviderError(
          this.name,
          "provider_request_failed",
          502,
          "Provider request failed",
          {
            attemptCount: attempt,
          },
        );
      }
    }

    throw new ProviderError(this.name, "provider_request_failed", 502, "Provider request failed", {
      attemptCount: attempt,
    });
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

function shouldRetryUpstreamStatus(status: number): boolean {
  return retryableUpstreamStatuses.has(status);
}

async function parseJsonResponse(
  provider: string,
  response: Response,
  attemptCount: number,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ProviderError(
      provider,
      "provider_bad_response",
      502,
      "Provider response did not include valid JSON",
      { attemptCount },
    );
  }
}
