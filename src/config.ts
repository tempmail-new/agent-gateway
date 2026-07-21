import { readFileSync } from "node:fs";

export interface GatewayConfig {
  apiKeys: ReadonlySet<string>;
  defaultProvider: string;
  openAICompatible?: OpenAICompatibleConfig;
  port: number;
  requestBudget: RequestBudgetConfig;
  requestPolicy: RequestPolicyConfig;
  requestSize: RequestSizeConfig;
  serviceName: string;
  telemetry: TelemetryConfig;
}

export interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl: string;
  maxAttempts: number;
  timeoutMs: number;
}

export interface RequestPolicyConfig {
  allowedProviderModels: readonly ProviderModelRule[];
}

export interface RequestBudgetConfig {
  maxInputTokens?: number;
}

export interface RequestSizeConfig {
  maxBodyBytes?: number;
  maxInputBytes?: number;
}

export interface TelemetryConfig {
  otlpMetricExporter?: OtlpMetricExporterConfig;
  otlpTraceExporter?: OtlpTraceExporterConfig;
}

export interface OtlpExporterConfig {
  headers: Record<string, string>;
  url: string;
}

export type OtlpMetricExporterConfig = OtlpExporterConfig;
export type OtlpTraceExporterConfig = OtlpExporterConfig;

export interface ProviderModelRule {
  model: string;
  provider: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const apiKeys = parseCsv(
    readSecretValue(env, "AGENT_GATEWAY_API_KEYS", "AGENT_GATEWAY_API_KEYS_FILE"),
  );
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
    requestSize: {
      maxBodyBytes: parseOptionalPositiveInteger(
        env.AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES,
        "AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES",
      ),
      maxInputBytes: parseOptionalPositiveInteger(
        env.AGENT_GATEWAY_MAX_INPUT_BYTES,
        "AGENT_GATEWAY_MAX_INPUT_BYTES",
      ),
    },
    serviceName: env.OTEL_SERVICE_NAME ?? "agent-gateway",
    telemetry: loadTelemetryConfig(env),
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
  const apiKey = readSecretValue(
    env,
    "AGENT_GATEWAY_OPENAI_API_KEY",
    "AGENT_GATEWAY_OPENAI_API_KEY_FILE",
  );

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
    maxAttempts: parseOpenAIMaxAttempts(env.AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS),
    timeoutMs: parseTimeoutMs(env.AGENT_GATEWAY_OPENAI_TIMEOUT_MS),
  };
}

function readSecretValue(
  env: NodeJS.ProcessEnv,
  variableName: string,
  fileVariableName: string,
): string | undefined {
  const inlineValue = env[variableName]?.trim();
  const filePath = env[fileVariableName]?.trim();

  if (
    inlineValue !== undefined &&
    inlineValue.length > 0 &&
    filePath !== undefined &&
    filePath.length > 0
  ) {
    throw new Error(`${variableName} and ${fileVariableName} cannot both be set`);
  }

  if (filePath === undefined || filePath.length === 0) {
    return inlineValue;
  }

  try {
    const fileValue = readFileSync(filePath, "utf8").trim();

    if (fileValue.length === 0) {
      throw new Error("empty secret file");
    }

    return fileValue;
  } catch {
    throw new Error(`${fileVariableName} must point to a readable non-empty file`);
  }
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

function parseOpenAIMaxAttempts(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) {
    return 1;
  }

  const maxAttempts = Number.parseInt(value, 10);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
    throw new Error("AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS must be an integer between 1 and 5");
  }

  return maxAttempts;
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

function loadTelemetryConfig(env: NodeJS.ProcessEnv): TelemetryConfig {
  const otlpMetricUrl = parseOtlpSignalEndpoint(
    env,
    "metrics",
    "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
  );
  const otlpTraceUrl = parseOtlpSignalEndpoint(env, "traces", "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT");
  const telemetry: TelemetryConfig = {};

  if (otlpMetricUrl !== undefined) {
    telemetry.otlpMetricExporter = {
      headers: {
        ...parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS, "OTEL_EXPORTER_OTLP_HEADERS"),
        ...parseOtlpHeaders(
          env.OTEL_EXPORTER_OTLP_METRICS_HEADERS,
          "OTEL_EXPORTER_OTLP_METRICS_HEADERS",
        ),
      },
      url: otlpMetricUrl,
    };
  }

  if (otlpTraceUrl !== undefined) {
    telemetry.otlpTraceExporter = {
      headers: {
        ...parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS, "OTEL_EXPORTER_OTLP_HEADERS"),
        ...parseOtlpHeaders(
          env.OTEL_EXPORTER_OTLP_TRACES_HEADERS,
          "OTEL_EXPORTER_OTLP_TRACES_HEADERS",
        ),
      },
      url: otlpTraceUrl,
    };
  }

  return telemetry;
}

function parseOtlpSignalEndpoint(
  env: NodeJS.ProcessEnv,
  signalPath: "metrics" | "traces",
  endpointVariableName: string,
): string | undefined {
  const signalEndpoint = env[endpointVariableName]?.trim();

  if (signalEndpoint !== undefined && signalEndpoint.length > 0) {
    return parseUrlForVariable(signalEndpoint, endpointVariableName);
  }

  const genericEndpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();

  if (genericEndpoint === undefined || genericEndpoint.length === 0) {
    return undefined;
  }

  const url = new URL(parseUrlForVariable(genericEndpoint, "OTEL_EXPORTER_OTLP_ENDPOINT"));
  url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/${signalPath}`;
  return url.toString();
}

function parseUrlForVariable(value: string, variableName: string): string {
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`${variableName} must be a valid URL`);
  }
}

function parseOtlpHeaders(value: string | undefined, variableName: string): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const header of parseCsv(value)) {
    const separatorIndex = header.indexOf("=");

    if (separatorIndex < 1) {
      throw new Error(`${variableName} entries must use key=value format`);
    }

    const key = decodeOtlpHeaderSegment(header.slice(0, separatorIndex).trim(), variableName);
    const headerValue = decodeOtlpHeaderSegment(
      header.slice(separatorIndex + 1).trim(),
      variableName,
    );

    headers[key] = headerValue;
  }

  return headers;
}

function decodeOtlpHeaderSegment(value: string, variableName: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`${variableName} entries must be URL-encoded key=value pairs`);
  }
}
