import type { GatewayRequest, RequestContext } from "../types.js";
import type { AgentProvider, ProviderResult } from "./types.js";

export class EchoProvider implements AgentProvider {
  readonly name = "echo";

  async complete(request: GatewayRequest, context: RequestContext): Promise<ProviderResult> {
    const output = JSON.stringify({
      input: request.input,
      metadata: request.metadata ?? {},
      model: request.model,
      requestId: context.requestId,
    });

    return {
      output,
      usage: {
        inputTokens: estimateTokens(request.input),
        outputTokens: estimateTokens(output),
      },
    };
  }
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.trim().length / 4));
}
