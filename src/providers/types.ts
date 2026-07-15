import type { GatewayRequest, RequestContext } from "../types.js";

export interface ProviderObservation {
  upstreamStatus?: number;
}

export interface ProviderResult {
  observability?: ProviderObservation;
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

export type ProviderErrorCode =
  | "provider_bad_response"
  | "provider_request_failed"
  | "provider_timeout"
  | "provider_upstream_error";

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly code: ProviderErrorCode,
    readonly statusCode: number,
    message: string,
    readonly details: Record<string, boolean | number | string> = {},
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
