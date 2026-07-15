export type GatewayMetadata = Record<string, boolean | number | string>;

export interface GatewayRequest {
  input: string;
  metadata?: GatewayMetadata;
  model: string;
  provider?: string;
}

export interface GatewayResponse {
  durationMs: number;
  id: string;
  model: string;
  output: string;
  provider: string;
  trace: {
    requestId: string;
    traceId: string;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface RequestContext {
  apiKeyId: string;
  requestId: string;
}
