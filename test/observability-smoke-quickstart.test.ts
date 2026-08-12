import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("observability smoke quickstart", () => {
  it("is linked from the operator and observability entry points", () => {
    const docs = [
      readRepoFile("README.md"),
      readRepoFile("docs/operator-journey-index.md"),
      readRepoFile("docs/observability/README.md"),
      readRepoFile("docs/observability/local-demo/README.md"),
    ].join("\n");

    expect(docs).toContain("docs/observability-smoke-quickstart.md");
    expect(docs).toContain("Run the first observability smoke");
    expect(docs).toContain("Inspect observability wiring");
  });

  it("documents prerequisites, smoke proof, and first failed-run checks", () => {
    const quickstart = readRepoFile("docs/observability-smoke-quickstart.md");

    for (const expected of [
      "git clone https://github.com/tempmail-new/agent-gateway.git",
      "cd agent-gateway",
      "Docker Engine or Docker Desktop",
      "docker compose",
      "Node.js `22.12.0` or newer",
      "No live model-provider credentials are required",
      "make observability-smoke",
      "make observability-preflight",
      "compose.observability.yaml",
      "OpenTelemetry Collector",
      "Prometheus",
      "Grafana",
      "http://localhost:8080/readyz",
      "http://localhost:9464/metrics",
      "http://localhost:9090",
      "http://localhost:3000/d/agent-gateway-ops/agent-gateway",
      'status: "ready"',
      "agent_gateway",
      "AgentGatewayElevatedHttp5xxRate",
      "AgentGatewayProviderErrorRate",
      "AgentGatewayProviderP95LatencyHigh",
      "agent-gateway-ops",
      "make observability-status",
      "make observability-inspect",
      "docs/observability/runbooks/gateway-observability.md",
      "docs/common-failure-modes.md#observability-checks",
    ]) {
      expect(quickstart).toContain(expected);
    }
  });
});
