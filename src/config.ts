export interface GatewayConfig {
  apiKeys: ReadonlySet<string>;
  defaultProvider: string;
  openAICompatible?: OpenAICompatibleConfig;
  port: number;
  requestBudget: RequestBudgetConfig;
  requestPolicy: RequestPolicyConfig;
  serviceName: string;
}

export interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export interface RequestPolicyConfig {
  allowedProviderModels: readonly ProviderModelRule[];
}

export interface RequestBudgetConfig {
  maxInputTokens?: number;
}

export interface ProviderModelRule {
  model: string;
  provider: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const apiKeys = parseCsv(env.AGENT_GATEWAY_API_KEYS);
  const defaultProvider = env.AGENT_GATEWAY_DEFAULT_PROVIDER ?? "echo";
  const nodeEnv = env.NODE_ENV ?? "development";
  const openAICompatible = loadOpenAICompatibleConfig(env, defaultProvider);

  if (apiKeys.length === 0 && nodeEnv === "production") {
    throw new Error("AGENT_GATEWAY_API_KEYS must be set in production");
  }

  return {
    apiKeys: new Set(apiKeys.length > 0 ? apiKeys : ["dev-token"]),
    defaultProvider,
    openAICompatible,
    port: parsePort(env.PORT),
    requestBudget: {
      maxInputTokens: parseOptionalPositiveInteger(
        env.AGENT_GATEWAY_MAX_INPUT_TOKENS,
        "AGENT_GATEWAY_MAX_INPUT_TOKENS",
      ),
    },
    requestPolicy: {
      allowedProviderModels: parseProviderModelRules(env.AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS),
    },
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

function loadOpenAICompatibleConfig(
  env: NodeJS.ProcessEnv,
  defaultProvider: string,
): OpenAICompatibleConfig | undefined {
  const apiKey = env.AGENT_GATEWAY_OPENAI_API_KEY?.trim();

  if (apiKey === undefined || apiKey.length === 0) {
    if (defaultProvider === "openai-compatible") {
      throw new Error(
        "AGENT_GATEWAY_OPENAI_API_KEY must be set when AGENT_GATEWAY_DEFAULT_PROVIDER is openai-compatible",
      );
    }

    return undefined;
  }

  return {
    apiKey,
    baseUrl: parseUrl(env.AGENT_GATEWAY_OPENAI_BASE_URL ?? "https://api.openai.com/v1"),
    timeoutMs: parseTimeoutMs(env.AGENT_GATEWAY_OPENAI_TIMEOUT_MS),
  };
}

function parseUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    throw new Error("AGENT_GATEWAY_OPENAI_BASE_URL must be a valid URL");
  }
}

function parseTimeoutMs(value: string | undefined): number {
  if (value === undefined) {
    return 30_000;
  }

  const timeoutMs = Number.parseInt(value, 10);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) {
    throw new Error("AGENT_GATEWAY_OPENAI_TIMEOUT_MS must be an integer between 1 and 300000");
  }

  return timeoutMs;
}

function parseProviderModelRules(value: string | undefined): ProviderModelRule[] {
  return parseCsv(value).map((rule) => {
    const separatorIndex = rule.indexOf(":");

    if (separatorIndex < 1 || separatorIndex === rule.length - 1) {
      throw new Error(
        "AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS entries must use provider:model format",
      );
    }

    return {
      model: rule.slice(separatorIndex + 1),
      provider: rule.slice(0, separatorIndex),
    };
  });
}

function parseOptionalPositiveInteger(
  value: string | undefined,
  variableName: string,
): number | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`${variableName} must be a positive integer`);
  }

  return parsedValue;
}
