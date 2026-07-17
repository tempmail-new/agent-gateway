import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../src/config.js";
import { createTelemetry } from "../src/observability/tracing.js";
import type { TelemetryDependencies } from "../src/observability/tracing.js";

describe("telemetry configuration", () => {
  it("keeps OTLP export disabled when no collector endpoint is configured", () => {
    const config = loadConfig({
      AGENT_GATEWAY_API_KEYS: "test-token",
      NODE_ENV: "test",
      OTEL_SERVICE_NAME: "agent-gateway-test",
    });

    expect(config.telemetry).toEqual({});
  });

  it("builds the trace endpoint from a generic OTLP collector endpoint", () => {
    const config = loadConfig({
      AGENT_GATEWAY_API_KEYS: "test-token",
      NODE_ENV: "test",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.example:4318/",
      OTEL_SERVICE_NAME: "agent-gateway-test",
    });

    expect(config.telemetry).toEqual({
      otlpMetricExporter: {
        headers: {},
        url: "http://collector.example:4318/v1/metrics",
      },
      otlpTraceExporter: {
        headers: {},
        url: "http://collector.example:4318/v1/traces",
      },
    });
  });

  it("prefers signal-specific OTLP endpoints and merges signal headers over generic headers", () => {
    const config = loadConfig({
      AGENT_GATEWAY_API_KEYS: "test-token",
      NODE_ENV: "test",
      OTEL_EXPORTER_OTLP_HEADERS: "authorization=Bearer%20generic,x-tenant=demo",
      OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "https://collector.example/custom/metrics",
      OTEL_EXPORTER_OTLP_METRICS_HEADERS: "authorization=Bearer%20metrics",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://collector.example/custom/traces",
      OTEL_EXPORTER_OTLP_TRACES_HEADERS: "authorization=Bearer%20trace",
      OTEL_SERVICE_NAME: "agent-gateway-test",
    });

    expect(config.telemetry).toEqual({
      otlpMetricExporter: {
        headers: {
          authorization: "Bearer metrics",
          "x-tenant": "demo",
        },
        url: "https://collector.example/custom/metrics",
      },
      otlpTraceExporter: {
        headers: {
          authorization: "Bearer trace",
          "x-tenant": "demo",
        },
        url: "https://collector.example/custom/traces",
      },
    });
  });

  it("rejects invalid OTLP endpoint and header configuration", () => {
    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        NODE_ENV: "test",
        OTEL_EXPORTER_OTLP_ENDPOINT: "not a url",
      }),
    ).toThrow("OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL");

    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        NODE_ENV: "test",
        OTEL_EXPORTER_OTLP_HEADERS: "missing-separator",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://collector.example/v1/traces",
      }),
    ).toThrow("OTEL_EXPORTER_OTLP_HEADERS entries must use key=value format");

    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        NODE_ENV: "test",
        OTEL_EXPORTER_OTLP_HEADERS: "authorization=Bearer%ZZtoken",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://collector.example/v1/traces",
      }),
    ).toThrow("OTEL_EXPORTER_OTLP_HEADERS entries must be URL-encoded key=value pairs");

    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        NODE_ENV: "test",
        OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "not a url",
      }),
    ).toThrow("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT must be a valid URL");

    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        NODE_ENV: "test",
        OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "http://collector.example/v1/metrics",
        OTEL_EXPORTER_OTLP_METRICS_HEADERS: "missing-separator",
      }),
    ).toThrow("OTEL_EXPORTER_OTLP_METRICS_HEADERS entries must use key=value format");
  });
});

describe("telemetry lifecycle", () => {
  it("does not create an SDK when OTLP export is disabled", () => {
    const createSDK = vi.fn<NonNullable<TelemetryDependencies["createSDK"]>>();
    const telemetry = createTelemetry(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        NODE_ENV: "test",
      }),
      { createSDK },
    );

    telemetry.start();

    expect(telemetry.enabled).toBe(false);
    expect(createSDK).not.toHaveBeenCalled();
  });

  it("starts and shuts down the OTLP SDK once when trace export is enabled", async () => {
    const sdk = {
      shutdown: vi.fn(async () => {}),
      start: vi.fn(),
    };
    const traceExporter = {} as ReturnType<
      NonNullable<TelemetryDependencies["createTraceExporter"]>
    >;
    const createTraceExporter = vi.fn<NonNullable<TelemetryDependencies["createTraceExporter"]>>(
      () => traceExporter,
    );
    const createSDK = vi.fn<NonNullable<TelemetryDependencies["createSDK"]>>(() => sdk);
    const telemetry = createTelemetry(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        NODE_ENV: "test",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://collector.example:4318/v1/traces",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
      { createSDK, createTraceExporter },
    );

    telemetry.start();
    telemetry.start();
    await telemetry.shutdown();
    await telemetry.shutdown();

    expect(telemetry.enabled).toBe(true);
    expect(createTraceExporter).toHaveBeenCalledWith({
      headers: {},
      url: "http://collector.example:4318/v1/traces",
    });
    expect(createSDK).toHaveBeenCalledWith(
      expect.objectContaining({
        instrumentations: [],
        logRecordProcessors: [],
        metricReaders: [],
        serviceName: "agent-gateway-test",
        traceExporter,
      }),
    );
    expect(sdk.start).toHaveBeenCalledOnce();
    expect(sdk.shutdown).toHaveBeenCalledOnce();
  });

  it("adds a metric reader when metric export is enabled", async () => {
    const sdk = {
      shutdown: vi.fn(async () => {}),
      start: vi.fn(),
    };
    const metricExporter = {} as ReturnType<
      NonNullable<TelemetryDependencies["createMetricExporter"]>
    >;
    const metricReader = {} as ReturnType<NonNullable<TelemetryDependencies["createMetricReader"]>>;
    const createMetricExporter = vi.fn<NonNullable<TelemetryDependencies["createMetricExporter"]>>(
      () => metricExporter,
    );
    const createMetricReader = vi.fn<NonNullable<TelemetryDependencies["createMetricReader"]>>(
      () => metricReader,
    );
    const createSDK = vi.fn<NonNullable<TelemetryDependencies["createSDK"]>>(() => sdk);
    const telemetry = createTelemetry(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        NODE_ENV: "test",
        OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "http://collector.example:4318/v1/metrics",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
      { createMetricExporter, createMetricReader, createSDK },
    );

    telemetry.start();
    await telemetry.shutdown();

    expect(telemetry.enabled).toBe(true);
    expect(createMetricExporter).toHaveBeenCalledWith({
      headers: {},
      url: "http://collector.example:4318/v1/metrics",
    });
    expect(createMetricReader).toHaveBeenCalledWith({ exporter: metricExporter });
    expect(createSDK).toHaveBeenCalledWith(
      expect.objectContaining({
        metricReaders: [metricReader],
        serviceName: "agent-gateway-test",
      }),
    );
    expect(sdk.start).toHaveBeenCalledOnce();
    expect(sdk.shutdown).toHaveBeenCalledOnce();
  });
});
