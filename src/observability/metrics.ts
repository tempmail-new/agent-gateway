import { metrics } from "@opentelemetry/api";
import type { Attributes } from "@opentelemetry/api";

export interface HttpRequestMetric {
  durationMs: number;
  method: string;
  route: string;
  statusCode: number;
}

export interface ProviderCallMetric {
  durationMs: number;
  errorCode?: string;
  outcome: "error" | "success";
  provider: string;
}

export interface MetricsRecorder {
  recordHttpRequest(metric: HttpRequestMetric): void;
  recordProviderCall(metric: ProviderCallMetric): void;
}

export function createGatewayMetrics(serviceName: string): MetricsRecorder {
  const meter = metrics.getMeter(serviceName);
  const httpRequests = meter.createCounter("agent_gateway.http.server.requests", {
    description: "HTTP requests handled by the gateway.",
    unit: "{request}",
  });
  const httpRequestDuration = meter.createHistogram("agent_gateway.http.server.duration", {
    description: "HTTP request duration in milliseconds.",
    unit: "ms",
  });
  const providerCalls = meter.createCounter("agent_gateway.provider.calls", {
    description: "Provider calls attempted by the gateway.",
    unit: "{call}",
  });
  const providerCallDuration = meter.createHistogram("agent_gateway.provider.duration", {
    description: "Provider call duration in milliseconds.",
    unit: "ms",
  });

  return {
    recordHttpRequest(metric) {
      const attributes: Attributes = {
        "http.request.method": metric.method,
        "http.response.status_code": metric.statusCode,
        "http.route": metric.route,
      };

      httpRequests.add(1, attributes);
      httpRequestDuration.record(metric.durationMs, attributes);
    },
    recordProviderCall(metric) {
      const attributes: Attributes = {
        "agent_gateway.provider.error_code": metric.errorCode ?? "none",
        "agent_gateway.provider.name": metric.provider,
        "agent_gateway.provider.outcome": metric.outcome,
      };

      providerCalls.add(1, attributes);
      providerCallDuration.record(metric.durationMs, attributes);
    },
  };
}
