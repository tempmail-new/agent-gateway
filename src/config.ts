export interface GatewayConfig {
  apiKeys: ReadonlySet<string>;
  defaultProvider: string;
  port: number;
  serviceName: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const apiKeys = parseCsv(env.AGENT_GATEWAY_API_KEYS);
  const nodeEnv = env.NODE_ENV ?? "development";

  if (apiKeys.length === 0 && nodeEnv === "production") {
    throw new Error("AGENT_GATEWAY_API_KEYS must be set in production");
  }

  return {
    apiKeys: new Set(apiKeys.length > 0 ? apiKeys : ["dev-token"]),
    defaultProvider: env.AGENT_GATEWAY_DEFAULT_PROVIDER ?? "echo",
    port: parsePort(env.PORT),
    serviceName: env.OTEL_SERVICE_NAME ?? "agent-gateway",
  };
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 8080;
  }

  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}
