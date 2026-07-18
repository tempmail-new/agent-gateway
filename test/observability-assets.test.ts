import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const metricNames = [
  "agent_gateway.http.server.requests",
  "agent_gateway.http.server.duration",
  "agent_gateway.provider.calls",
  "agent_gateway.provider.duration",
];

describe("observability operations assets", () => {
  it("documents each emitted gateway metric", () => {
    const docs = [
      readRepoFile("docs/observability/README.md"),
      readRepoFile("docs/observability/runbooks/gateway-observability.md"),
    ].join("\n");

    for (const metricName of metricNames) {
      expect(docs).toContain(metricName);
    }
  });

  it("ships a valid Grafana dashboard for the Prometheus-exported metric names", () => {
    const dashboard = JSON.parse(
      readRepoFile("docs/observability/dashboards/grafana-agent-gateway.json"),
    ) as {
      panels: Array<{ targets?: Array<{ expr?: string }> }>;
      tags: string[];
      title: string;
    };
    const expressions = dashboard.panels
      .flatMap((panel) => panel.targets ?? [])
      .map((target) => target.expr ?? "")
      .join("\n");

    expect(dashboard.title).toBe("Agent Gateway");
    expect(dashboard.tags).toContain("agent-gateway");
    expect(expressions).toContain("agent_gateway_http_server_requests_total");
    expect(expressions).toContain("agent_gateway_http_server_duration_milliseconds_bucket");
    expect(expressions).toContain("agent_gateway_provider_calls_total");
    expect(expressions).toContain("agent_gateway_provider_duration_milliseconds_bucket");
    expect(expressions).toContain('http_response_status_code=~"4.."');
    expect(expressions).toContain('http_response_status_code=~"5.."');
    expect(expressions).toContain('agent_gateway_provider_outcome="error"');
  });

  it("includes collector and alert examples wired to the dashboard metric family", () => {
    const collectorConfig = readRepoFile("docs/observability/collector/otel-collector.yaml");
    const alertRules = readRepoFile("docs/observability/alerts/prometheus-rules.yaml");

    expect(collectorConfig).toContain("endpoint: 0.0.0.0:4318");
    expect(collectorConfig).toContain("endpoint: 0.0.0.0:9464");
    expect(alertRules).toContain("AgentGatewayElevatedHttp5xxRate");
    expect(alertRules).toContain("agent_gateway_http_server_requests_total");
    expect(alertRules).toContain("agent_gateway_provider_calls_total");
    expect(alertRules).toContain("agent_gateway_provider_duration_milliseconds_bucket");
    expect(alertRules).toContain(
      "sum(increase(agent_gateway_http_server_requests_total[10m])) >= 20",
    );
    expect(alertRules).toContain("sum(increase(agent_gateway_provider_calls_total[10m])) >= 10");
    expect(alertRules).toContain("sum(rate(agent_gateway_provider_calls_total[5m]))");
  });

  it("ships a compose-based local demo wired to the observability pack", () => {
    const compose = readRepoFile("compose.observability.yaml");
    const prometheus = readRepoFile("docs/observability/local-demo/prometheus.yml");
    const grafanaDatasource = readRepoFile(
      "docs/observability/local-demo/grafana/provisioning/datasources/prometheus.yml",
    );
    const grafanaDashboard = readRepoFile(
      "docs/observability/local-demo/grafana/provisioning/dashboards/agent-gateway.yml",
    );
    const trafficScript = readRepoFile("docs/observability/local-demo/generate-traffic.sh");

    expect(compose).toContain("OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318");
    expect(compose).toContain(
      "./docs/observability/collector/otel-collector.yaml:/etc/otelcol/config.yaml:ro",
    );
    expect(compose).toContain(
      "./docs/observability/alerts/prometheus-rules.yaml:/etc/prometheus/rules/agent-gateway.yaml:ro",
    );
    expect(compose).toContain(
      "./docs/observability/dashboards/grafana-agent-gateway.json:/var/lib/grafana/dashboards/agent-gateway.json:ro",
    );
    expect(prometheus).toContain("otel-collector:9464");
    expect(prometheus).toContain("/etc/prometheus/rules/agent-gateway.yaml");
    expect(grafanaDatasource).toContain("url: http://prometheus:9090");
    expect(grafanaDashboard).toContain("path: /var/lib/grafana/dashboards");
    expect(trafficScript).toContain("AGENT_GATEWAY_DEMO_TOKEN");
    expect(trafficScript).toContain("blocked-model");
    expect(trafficScript).toContain("grep agent_gateway");
  });
});
