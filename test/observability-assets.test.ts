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
  });
});
