import { SpanStatusCode, trace } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";

import type { GatewayConfig } from "../config.js";

export type TraceAttributeValue = boolean | number | string;

type NodeSDKOptions = NonNullable<ConstructorParameters<typeof NodeSDK>[0]>;
type MetricExporterConfig = ConstructorParameters<typeof OTLPMetricExporter>[0];
type MetricReaderOptions = ConstructorParameters<typeof PeriodicExportingMetricReader>[0];
type MetricReader = NonNullable<NodeSDKOptions["metricReaders"]>[number];
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
  createMetricExporter?(config: MetricExporterConfig): MetricReaderOptions["exporter"];
  createMetricReader?(options: MetricReaderOptions): MetricReader;
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
  const metricExporterConfig = config.telemetry.otlpMetricExporter;
  const traceExporterConfig = config.telemetry.otlpTraceExporter;

  if (metricExporterConfig === undefined && traceExporterConfig === undefined) {
    return {
      enabled: false,
      shutdown: async () => {},
      start: () => {},
    };
  }

  const metricReaders: MetricReader[] = [];

  if (metricExporterConfig !== undefined) {
    const metricExporter =
      dependencies.createMetricExporter?.({
        headers: metricExporterConfig.headers,
        url: metricExporterConfig.url,
      }) ??
      new OTLPMetricExporter({
        headers: metricExporterConfig.headers,
        url: metricExporterConfig.url,
      });
    metricReaders.push(
      dependencies.createMetricReader?.({ exporter: metricExporter }) ??
        new PeriodicExportingMetricReader({ exporter: metricExporter }),
    );
  }

  const sdkOptions: NodeSDKOptions = {
    instrumentations: [],
    logRecordProcessors: [],
    metricReaders,
    serviceName: config.serviceName,
  };

  if (traceExporterConfig !== undefined) {
    sdkOptions.traceExporter =
      dependencies.createTraceExporter?.({
        headers: traceExporterConfig.headers,
        url: traceExporterConfig.url,
      }) ??
      new OTLPTraceExporter({
        headers: traceExporterConfig.headers,
        url: traceExporterConfig.url,
      });
  }

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
