import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { HttpRequestMetric, ProviderCallMetric } from "../src/observability/metrics.js";
import { OpenAICompatibleProvider } from "../src/providers/index.js";
import type { ProviderError } from "../src/providers/index.js";

const config = loadConfig({
  AGENT_GATEWAY_API_KEYS: "test-token",
  NODE_ENV: "test",
  OTEL_SERVICE_NAME: "agent-gateway-test",
});
const tempDirs: string[] = [];

function createTempSecretFile(name: string, value: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), "agent-gateway-test-"));
  tempDirs.push(tempDir);
  const filePath = join(tempDir, name);
  writeFileSync(filePath, value);
  return filePath;
}

function createLogCapture() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, encoding, callback) {
      void encoding;
      chunks.push(chunk.toString());
      callback();
    },
  });

  return {
    allText() {
      return chunks.join("");
    },
    findByMessage(message: string) {
      return parseLogEntries(chunks).find((entry) => entry.msg === message);
    },
    logger: {
      level: "info",
      stream,
    },
  };
}

function createMetricsCapture() {
  const httpRequests: HttpRequestMetric[] = [];
  const providerCalls: ProviderCallMetric[] = [];

  return {
    httpRequests,
    providerCalls,
    recorder: {
      recordHttpRequest(metric: HttpRequestMetric) {
        httpRequests.push(metric);
      },
      recordProviderCall(metric: ProviderCallMetric) {
        providerCalls.push(metric);
      },
    },
  };
}

function parseLogEntries(chunks: string[]): Record<string, unknown>[] {
  return chunks.flatMap((chunk) =>
    chunk
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => {
        const parsed: unknown = JSON.parse(line);
        return parsed !== null && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : {};
      }),
  );
}

describe("agent gateway app", () => {
  afterEach(() => {
    vi.unstubAllGlobals();

    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("reports health without authentication", async () => {
    const app = buildApp(config);
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      providers: ["echo"],
      service: "agent-gateway-test",
      status: "ok",
    });
  });

  it("reports readiness for orchestration probes", async () => {
    const app = buildApp(config);
    const response = await app.inject({ method: "GET", url: "/readyz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      defaultProvider: "echo",
      providers: ["echo"],
      service: "agent-gateway-test",
      status: "ready",
    });
  });

  it("fails fast when the configured default provider is unavailable", () => {
    expect(() =>
      buildApp(
        loadConfig({
          AGENT_GATEWAY_API_KEYS: "test-token",
          AGENT_GATEWAY_DEFAULT_PROVIDER: "missing",
          NODE_ENV: "test",
        }),
      ),
    ).toThrow("Unknown provider 'missing'");
  });

  it("rejects unauthenticated gateway requests", async () => {
    const app = buildApp(config);
    const response = await app.inject({
      method: "POST",
      url: "/v1/requests",
      payload: { input: "hello", model: "test-model" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_bearer_token" });
  });

  it("routes authenticated requests to the echo provider with trace metadata", async () => {
    const metrics = createMetricsCapture();
    const app = buildApp(config, { metrics: metrics.recorder });
    const response = await app.inject({
      headers: {
        authorization: "Bearer test-token",
        "x-request-id": "req_123",
      },
      method: "POST",
      payload: {
        input: "summarize this",
        metadata: { tenant: "demo" },
        model: "local-test",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "req_123",
      model: "local-test",
      provider: "echo",
      trace: {
        requestId: "req_123",
      },
      usage: {
        inputTokens: 4,
      },
    });
    expect(JSON.parse(response.json().output)).toMatchObject({
      input: "summarize this",
      metadata: { tenant: "demo" },
      model: "local-test",
      requestId: "req_123",
    });
    expect(metrics.httpRequests).toHaveLength(1);
    expect(metrics.httpRequests[0]).toMatchObject({
      method: "POST",
      route: "/v1/requests",
      statusCode: 200,
    });
    expect(typeof metrics.httpRequests[0]?.durationMs).toBe("number");
    expect(metrics.providerCalls).toHaveLength(1);
    expect(metrics.providerCalls[0]).toMatchObject({
      outcome: "success",
      provider: "echo",
    });
    expect(typeof metrics.providerCalls[0]?.durationMs).toBe("number");
  });

  it("rejects unknown top-level request fields before provider execution", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "gpt-compatible",
        provider: "openai-compatible",
        temperature: 0.9,
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid_request",
      reason: "request_schema_invalid",
    });
    expect(response.json().details.formErrors).toContain(
      "Unrecognized key(s) in object: 'temperature'",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a typed error for unknown providers", async () => {
    const app = buildApp(config);
    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "local-test",
        provider: "missing",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "unknown_provider",
      provider: "missing",
      supportedProviders: ["echo"],
    });
  });

  it("rejects provider and model combinations before provider execution", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS: "openai-compatible:approved-model",
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "blocked-model",
        provider: "openai-compatible",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "policy_rejected",
      model: "blocked-model",
      provider: "openai-compatible",
      reason: "provider_model_not_allowed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows wildcard model policy matches", async () => {
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS: "echo:*",
        AGENT_GATEWAY_API_KEYS: "test-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "any-local-model",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      model: "any-local-model",
      provider: "echo",
    });
  });

  it("rejects over-budget requests before provider execution", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_MAX_INPUT_TOKENS: "1",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "gpt-compatible",
        provider: "openai-compatible",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(402);
    expect(response.json()).toEqual({
      error: "budget_exceeded",
      estimatedInputTokens: 2,
      limit: 1,
      reason: "estimated_input_tokens_exceeded",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows requests within the configured input token budget", async () => {
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_MAX_INPUT_TOKENS: "2",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "local-test",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      model: "local-test",
      provider: "echo",
      usage: {
        inputTokens: 2,
      },
    });
  });

  it("rejects oversized request bodies before provider execution", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES: "80",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      method: "POST",
      payload: JSON.stringify({
        input: "x".repeat(120),
        model: "gpt-compatible",
        provider: "openai-compatible",
      }),
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: "request_body_too_large",
      limit: 80,
      reason: "request_body_bytes_exceeded",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves Fastify's default oversized-body response when the body limit is unset", async () => {
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      method: "POST",
      payload: JSON.stringify({
        input: "x".repeat(1024 * 1024),
        model: "local-test",
      }),
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      code: "FST_ERR_CTP_BODY_TOO_LARGE",
      error: "Payload Too Large",
      message: "Request body is too large",
      statusCode: 413,
    });
  });

  it("rejects oversized inputs before provider execution", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_MAX_INPUT_BYTES: "5",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello!",
        model: "gpt-compatible",
        provider: "openai-compatible",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: "input_too_large",
      inputBytes: 6,
      limit: 5,
      reason: "input_bytes_exceeded",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("measures configured input limits in bytes", async () => {
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_MAX_INPUT_BYTES: "3",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "éé",
        model: "local-test",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: "input_too_large",
      inputBytes: 4,
      limit: 3,
      reason: "input_bytes_exceeded",
    });
  });

  it("rejects invalid budget configuration", () => {
    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_MAX_INPUT_TOKENS: "0",
        NODE_ENV: "test",
      }),
    ).toThrow("AGENT_GATEWAY_MAX_INPUT_TOKENS must be a positive integer");
  });

  it("rejects invalid request size configuration", () => {
    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_MAX_INPUT_BYTES: "0",
        NODE_ENV: "test",
      }),
    ).toThrow("AGENT_GATEWAY_MAX_INPUT_BYTES must be a positive integer");

    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES: "1.5",
        NODE_ENV: "test",
      }),
    ).toThrow("AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES must be a positive integer");
  });

  it("rejects invalid OpenAI-compatible retry configuration", () => {
    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS: "6",
        NODE_ENV: "test",
      }),
    ).toThrow("AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS must be an integer between 1 and 5");
  });

  it("loads deployment secrets from files", () => {
    const apiKeysFile = createTempSecretFile("gateway-api-keys", "file-token\n");
    const providerApiKeyFile = createTempSecretFile("provider-api-key", "provider-file-token\n");
    const configFromFiles = loadConfig({
      AGENT_GATEWAY_API_KEYS_FILE: apiKeysFile,
      AGENT_GATEWAY_OPENAI_API_KEY_FILE: providerApiKeyFile,
      NODE_ENV: "test",
    });

    expect([...configFromFiles.apiKeys]).toEqual(["file-token"]);
    expect(configFromFiles.openAICompatible?.apiKey).toBe("provider-file-token");
  });

  it("rejects ambiguous inline and file-backed secret configuration", () => {
    const apiKeysFile = createTempSecretFile("gateway-api-keys", "file-token\n");

    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "inline-token",
        AGENT_GATEWAY_API_KEYS_FILE: apiKeysFile,
        NODE_ENV: "test",
      }),
    ).toThrow("AGENT_GATEWAY_API_KEYS and AGENT_GATEWAY_API_KEYS_FILE cannot both be set");
  });

  it("registers the OpenAI-compatible provider when credentials are configured", async () => {
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      providers: ["echo", "openai-compatible"],
      service: "agent-gateway-test",
      status: "ok",
    });
  });

  it("routes OpenAI-compatible requests through the chat completions API", async () => {
    const logs = createLogCapture();
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "A concise summary." } }],
          usage: { completion_tokens: 4, prompt_tokens: 7 },
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        AGENT_GATEWAY_OPENAI_BASE_URL: "https://provider.example/v1",
        AGENT_GATEWAY_OPENAI_TIMEOUT_MS: "1000",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
      { logger: logs.logger },
    );

    const response = await app.inject({
      headers: {
        authorization: "Bearer test-token",
        "x-request-id": "req_openai",
      },
      method: "POST",
      payload: {
        input: "Summarize the incident report.",
        model: "gpt-compatible",
        provider: "openai-compatible",
      },
      url: "/v1/requests",
    });
    const providerLog = logs.findByMessage("provider_call_completed");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "req_openai",
      model: "gpt-compatible",
      output: "A concise summary.",
      provider: "openai-compatible",
      usage: {
        inputTokens: 7,
        outputTokens: 4,
      },
    });
    expect(providerLog).toMatchObject({
      model: "gpt-compatible",
      provider: "openai-compatible",
      providerAttemptCount: 1,
      providerRetryCount: 0,
      requestId: "req_openai",
      upstreamStatus: 200,
    });
    expect(typeof providerLog?.providerDurationMs).toBe("number");
    expect(logs.allText()).not.toContain("provider-token");
    expect(logs.allText()).not.toContain("Summarize the incident report.");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({
          messages: [{ content: "Summarize the incident report.", role: "user" }],
          model: "gpt-compatible",
        }),
        headers: {
          authorization: "Bearer provider-token",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
  });

  it("normalizes unsuccessful OpenAI-compatible responses", async () => {
    const logs = createLogCapture();
    const metrics = createMetricsCapture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
        });
      }),
    );
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
      { logger: logs.logger, metrics: metrics.recorder },
    );

    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "gpt-compatible",
        provider: "openai-compatible",
      },
      url: "/v1/requests",
    });
    const providerLog = logs.findByMessage("provider_call_failed");

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      code: "provider_upstream_error",
      details: { attemptCount: 1, upstreamStatus: 429 },
      error: "provider_error",
      message: "Provider returned an unsuccessful response",
      provider: "openai-compatible",
    });
    expect(providerLog).toMatchObject({
      model: "gpt-compatible",
      provider: "openai-compatible",
      providerAttemptCount: 1,
      providerErrorCode: "provider_upstream_error",
      providerRetryCount: 0,
      timeout: false,
      upstreamStatus: 429,
    });
    expect(typeof providerLog?.providerDurationMs).toBe("number");
    expect(metrics.httpRequests).toHaveLength(1);
    expect(metrics.httpRequests[0]).toMatchObject({
      method: "POST",
      route: "/v1/requests",
      statusCode: 502,
    });
    expect(metrics.providerCalls).toHaveLength(1);
    expect(metrics.providerCalls[0]).toMatchObject({
      errorCode: "provider_upstream_error",
      outcome: "error",
      provider: "openai-compatible",
    });
    expect(logs.allText()).not.toContain("provider-token");
    expect(logs.allText()).not.toContain("hello");
  });

  it("retries retryable OpenAI-compatible upstream responses before succeeding", async () => {
    const logs = createLogCapture();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "unavailable" } }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Recovered response." } }],
            usage: { completion_tokens: 3, prompt_tokens: 2 },
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS: "3",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
      { logger: logs.logger },
    );

    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "gpt-compatible",
        provider: "openai-compatible",
      },
      url: "/v1/requests",
    });
    const providerLog = logs.findByMessage("provider_call_completed");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      output: "Recovered response.",
      provider: "openai-compatible",
      usage: {
        inputTokens: 2,
        outputTokens: 3,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(providerLog).toMatchObject({
      provider: "openai-compatible",
      providerAttemptCount: 2,
      providerRetryCount: 1,
      upstreamStatus: 200,
    });
  });

  it("does not retry non-transient OpenAI-compatible upstream responses", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: "bad request" } }), { status: 400 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS: "3",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );

    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "gpt-compatible",
        provider: "openai-compatible",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      code: "provider_upstream_error",
      details: { attemptCount: 1, upstreamStatus: 400 },
      error: "provider_error",
      message: "Provider returned an unsuccessful response",
      provider: "openai-compatible",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("OpenAICompatibleProvider", () => {
  it("retries request failures before returning a successful response", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("socket closed"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "A recovered summary." } }],
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      );
    const provider = new OpenAICompatibleProvider(
      {
        apiKey: "provider-token",
        baseUrl: "https://provider.example/v1",
        maxAttempts: 2,
        timeoutMs: 1000,
      },
      fetchMock,
    );

    await expect(
      provider.complete({
        input: "hello",
        model: "gpt-compatible",
        provider: "openai-compatible",
      }),
    ).resolves.toMatchObject({
      observability: {
        attemptCount: 2,
        upstreamStatus: 200,
      },
      output: "A recovered summary.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry malformed successful provider responses", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response("not-json", { status: 200 });
    });
    const provider = new OpenAICompatibleProvider(
      {
        apiKey: "provider-token",
        baseUrl: "https://provider.example/v1",
        maxAttempts: 3,
        timeoutMs: 1000,
      },
      fetchMock,
    );

    await expect(
      provider.complete({
        input: "hello",
        model: "gpt-compatible",
        provider: "openai-compatible",
      }),
    ).rejects.toMatchObject<Partial<ProviderError>>({
      code: "provider_bad_response",
      details: { attemptCount: 1 },
      provider: "openai-compatible",
      statusCode: 502,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("normalizes provider timeouts", async () => {
    const fetchMock = vi.fn(async () => {
      throw Object.assign(new Error("deadline exceeded"), { name: "TimeoutError" });
    });
    const provider = new OpenAICompatibleProvider(
      {
        apiKey: "provider-token",
        baseUrl: "https://provider.example/v1",
        maxAttempts: 2,
        timeoutMs: 1,
      },
      fetchMock,
    );

    await expect(
      provider.complete({
        input: "hello",
        model: "gpt-compatible",
        provider: "openai-compatible",
      }),
    ).rejects.toMatchObject<Partial<ProviderError>>({
      code: "provider_timeout",
      details: { attemptCount: 2, timeoutMs: 1 },
      provider: "openai-compatible",
      statusCode: 504,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
