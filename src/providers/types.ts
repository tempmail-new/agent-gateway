import type { GatewayRequest, RequestContext } from "../types.js";

export interface ProviderResult {
  output: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AgentProvider {
  readonly name: string;
  complete(request: GatewayRequest, context: RequestContext): Promise<ProviderResult>;
}
