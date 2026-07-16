import { SpanStatusCode, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

import type { GatewayConfig } from "../config.js";

export type TraceAttributeValue = boolean | number | string;

type NodeSDKOptions = NonNullable<ConstructorParameters<typeof NodeSDK>[0]>;
type TraceExporterConfig = ConstructorParameters<typeof OTLPTraceExporter>[0];

export interface TraceHandle {
  requestId: string;
  traceId: string;
}

export interface TraceOperationContext {
  handle: TraceHandle;
  recordEvent(name: string, attributes: Record<string, TraceAttributeValue>): void;
  setAttributes(attributes: Record<string, TraceAttributeValue | undefined>): void;
}

export interface TelemetryLifecycle {
  enabled: boolean;
  shutdown(): Promise<void>;
  start(): void;
}

export interface TelemetryDependencies {
  createSDK?(options: NodeSDKOptions): TelemetrySDK;
  createTraceExporter?(config: TraceExporterConfig): NodeSDKOptions["traceExporter"];
}

interface TelemetrySDK {
  shutdown(): Promise<void>;
  start(): void;
}

export function createTelemetry(
  config: GatewayConfig,
  dependencies: TelemetryDependencies = {},
): TelemetryLifecycle {
  const exporterConfig = config.telemetry.otlpTraceExporter;

  if (exporterConfig === undefined) {
    return {
      enabled: false,
      shutdown: async () => {},
      start: () => {},
    };
  }

  const traceExporter =
    dependencies.createTraceExporter?.({
      headers: exporterConfig.headers,
      url: exporterConfig.url,
    }) ??
    new OTLPTraceExporter({
      headers: exporterConfig.headers,
      url: exporterConfig.url,
    });
  const sdkOptions: NodeSDKOptions = {
    instrumentations: [],
    logRecordProcessors: [],
    metricReaders: [],
    serviceName: config.serviceName,
    traceExporter,
  };
  const sdk = dependencies.createSDK?.(sdkOptions) ?? new NodeSDK(sdkOptions);
  let started = false;

  return {
    enabled: true,
    async shutdown() {
      if (!started) {
        return;
      }

      await sdk.shutdown();
      started = false;
    },
    start() {
      if (started) {
        return;
      }

      sdk.start();
      started = true;
    },
  };
}

export async function withGatewayTrace<T>(
  serviceName: string,
  spanName: string,
  attributes: Record<string, TraceAttributeValue>,
  fallbackTrace: TraceHandle,
  operation: (traceContext: TraceOperationContext) => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer(serviceName);

  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      const spanContext = span.spanContext();
      const traceHandle = spanContext.traceId
        ? { requestId: fallbackTrace.requestId, traceId: spanContext.traceId }
        : fallbackTrace;

      return await operation({
        handle: traceHandle,
        recordEvent(name, eventAttributes) {
          span.addEvent(name, eventAttributes);
        },
        setAttributes(dynamicAttributes) {
          for (const [key, value] of Object.entries(dynamicAttributes)) {
            if (value !== undefined) {
              span.setAttribute(key, value);
            }
          }
        },
      });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
