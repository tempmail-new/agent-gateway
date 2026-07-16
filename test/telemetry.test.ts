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

    expect(config.telemetry.otlpTraceExporter).toEqual({
      headers: {},
      url: "http://collector.example:4318/v1/traces",
    });
  });

  it("prefers a trace-specific OTLP endpoint and merges trace headers over generic headers", () => {
    const config = loadConfig({
      AGENT_GATEWAY_API_KEYS: "test-token",
      NODE_ENV: "test",
      OTEL_EXPORTER_OTLP_HEADERS: "authorization=Bearer%20generic,x-tenant=demo",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://collector.example/custom/traces",
      OTEL_EXPORTER_OTLP_TRACES_HEADERS: "authorization=Bearer%20trace",
      OTEL_SERVICE_NAME: "agent-gateway-test",
    });

    expect(config.telemetry.otlpTraceExporter).toEqual({
      headers: {
        authorization: "Bearer trace",
        "x-tenant": "demo",
      },
      url: "https://collector.example/custom/traces",
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

  it("starts and shuts down the OTLP SDK once when export is enabled", async () => {
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
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.example:4318",
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
});
