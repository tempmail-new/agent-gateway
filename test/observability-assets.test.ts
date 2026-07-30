import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function publishedComposePorts(compose: string): string[] {
  return Array.from(compose.matchAll(/-\s+"(\d+):\d+"/g), (match) => match[1]).sort();
}

function preflightDefaultPorts(preflightScript: string): string[] {
  const match = preflightScript.match(/OBSERVABILITY_DEMO_PORTS:-(?<ports>[^}]+)}/);

  expect(match?.groups?.ports).toBeDefined();

  return match?.groups?.ports.split(/\s+/).sort() ?? [];
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
    const makefile = readRepoFile("Makefile");
    const prometheus = readRepoFile("docs/observability/local-demo/prometheus.yml");
    const grafanaDatasource = readRepoFile(
      "docs/observability/local-demo/grafana/provisioning/datasources/prometheus.yml",
    );
    const grafanaDashboard = readRepoFile(
      "docs/observability/local-demo/grafana/provisioning/dashboards/agent-gateway.yml",
    );
    const trafficScript = readRepoFile("docs/observability/local-demo/generate-traffic.sh");
    const inspectScript = readRepoFile("docs/observability/local-demo/inspect.sh");
    const statusScript = readRepoFile("docs/observability/local-demo/status.sh");
    const logsScript = readRepoFile("docs/observability/local-demo/logs.sh");
    const downScript = readRepoFile("docs/observability/local-demo/down.sh");
    const preflightScript = readRepoFile("docs/observability/local-demo/preflight.sh");
    const readyScript = readRepoFile("docs/observability/local-demo/ready.sh");
    const smokeScript = readRepoFile("docs/observability/local-demo/smoke.sh");
    const upScript = readRepoFile("docs/observability/local-demo/up.sh");

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
    const phonyLine = makefile.split("\n").find((line) => line.startsWith(".PHONY:"));
    expect(phonyLine).toContain("observability-preflight");
    expect(phonyLine).toContain("observability-up");
    expect(phonyLine).toContain("observability-ready");
    expect(phonyLine).toContain("observability-traffic");
    expect(phonyLine).toContain("observability-inspect");
    expect(phonyLine).toContain("observability-status");
    expect(phonyLine).toContain("observability-logs");
    expect(phonyLine).toContain("observability-down");
    expect(phonyLine).toContain("observability-smoke");
    expect(makefile).toContain("OBSERVABILITY_COMPOSE_PROJECT ?= agent-gateway-observability-demo");
    expect(makefile).toContain(
      "OBSERVABILITY_COMPOSE := COMPOSE_PROJECT_NAME=$(OBSERVABILITY_COMPOSE_PROJECT) docker compose -f compose.observability.yaml",
    );
    expect(makefile).toContain("observability-preflight:");
    expect(makefile).toContain("docs/observability/local-demo/preflight.sh");
    expect(makefile).toContain("observability-up:");
    expect(makefile).toContain("docs/observability/local-demo/up.sh");
    expect(makefile).toContain("observability-ready:");
    expect(makefile).toContain("docs/observability/local-demo/ready.sh");
    expect(makefile).toContain("observability-traffic:");
    expect(makefile).toContain("docs/observability/local-demo/generate-traffic.sh");
    expect(makefile).toContain("observability-inspect:");
    expect(makefile).toContain("docs/observability/local-demo/inspect.sh");
    expect(makefile).toContain("observability-status:");
    expect(makefile).toContain("docs/observability/local-demo/status.sh");
    expect(makefile).toContain("observability-logs:");
    expect(makefile).toContain("docs/observability/local-demo/logs.sh");
    expect(makefile).toContain("observability-smoke:");
    expect(makefile).toContain("docs/observability/local-demo/smoke.sh");
    expect(makefile).toContain("observability-down:");
    expect(makefile).toContain("docs/observability/local-demo/down.sh");
    expect(prometheus).toContain("otel-collector:9464");
    expect(prometheus).toContain("/etc/prometheus/rules/agent-gateway.yaml");
    expect(grafanaDatasource).toContain("url: http://prometheus:9090");
    expect(grafanaDashboard).toContain("path: /var/lib/grafana/dashboards");
    expect(trafficScript).toContain("AGENT_GATEWAY_DEMO_TOKEN");
    expect(trafficScript).toContain("blocked-model");
    expect(trafficScript).toContain("expected_status");
    expect(trafficScript).toContain("observability traffic failed; compose state");
    expect(trafficScript).toContain("compose ps >&2 || true");
    expect(trafficScript).toContain(
      "observability traffic failed; running observability inspection",
    );
    expect(trafficScript).toContain("docs/observability/local-demo/inspect.sh >&2 || true");
    expect(trafficScript).toContain("grep agent_gateway");
    expect(inspectScript).toContain("GATEWAY_URL");
    expect(inspectScript).toContain("COLLECTOR_METRICS_URL");
    expect(inspectScript).toContain("PROMETHEUS_URL");
    expect(inspectScript).toContain("GRAFANA_URL");
    expect(inspectScript).toContain("agent_gateway");
    expect(inspectScript).toContain("AgentGatewayElevatedHttp5xxRate");
    expect(inspectScript).toContain("AgentGatewayProviderErrorRate");
    expect(inspectScript).toContain("AgentGatewayProviderP95LatencyHigh");
    expect(inspectScript).toContain("agent-gateway-otel-collector");
    expect(inspectScript).toContain("agent-gateway-ops");
    expect(statusScript).toContain("observability demo status");
    expect(statusScript).toContain("compose ps --all || true");
    expect(statusScript).toContain("gateway readiness");
    expect(statusScript).toContain("collector metrics");
    expect(statusScript).toContain("agent_gateway metrics present");
    expect(statusScript).toContain("prometheus readiness");
    expect(statusScript).toContain("grafana health");
    expect(statusScript).toContain("grafana dashboard");
    expect(statusScript).toContain("agent-gateway-ops");
    expect(logsScript).toContain("OBSERVABILITY_LOG_TAIL");
    expect(logsScript).toContain('compose logs -f --tail="$LOG_TAIL"');
    expect(logsScript).toContain("gateway otel-collector prometheus grafana");
    expect(logsScript).toContain("observability logs failed; compose state");
    expect(logsScript).toContain("compose ps >&2 || true");
    expect(logsScript).toContain("observability logs failed; running observability inspection");
    expect(logsScript).toContain("docs/observability/local-demo/inspect.sh >&2 || true");
    expect(downScript).toContain("compose down");
    expect(downScript).toContain("observability teardown failed; compose state");
    expect(downScript).toContain("compose ps >&2 || true");
    expect(downScript).toContain("observability teardown failed; cleanup context");
    expect(downScript).toContain(
      "retry_command=COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME docker compose -f $COMPOSE_FILE down",
    );
    expect(downScript).toContain("observability teardown failed; running observability inspection");
    expect(downScript).toContain("docs/observability/local-demo/inspect.sh >&2 || true");
    expect(preflightScript).toContain("docker info");
    expect(preflightScript).toContain("docker compose version");
    expect(preflightScript).toContain('docker compose -f "$COMPOSE_FILE" config');
    expect(preflightScript).toContain("OBSERVABILITY_DEMO_PORTS:-3000 4317 4318 8080 9090 9464");
    expect(preflightScript).toContain("port %s is already in use");
    expect(preflightScript).toContain("make observability-down");
    expect(preflightScript).toContain("agent-gateway-observability-demo");
    expect(preflightDefaultPorts(preflightScript)).toEqual(publishedComposePorts(compose));
    expect(readyScript).toContain("OBSERVABILITY_READY_WAIT_ATTEMPTS");
    expect(readyScript).toContain("OBSERVABILITY_READY_WAIT_SLEEP_SECONDS");
    expect(readyScript).toContain("observability demo is ready");
    expect(readyScript).toContain("observability demo did not become ready");
    expect(readyScript).toContain("observability ready failed; compose state");
    expect(readyScript).toContain("compose ps >&2 || true");
    expect(readyScript).toContain("docs/observability/local-demo/inspect.sh >&2 || true");
    expect(smokeScript).toContain("trap 'finish \"$?\"' EXIT");
    expect(smokeScript).toContain("docs/observability/local-demo/preflight.sh");
    expect(smokeScript).toContain("compose down");
    expect(smokeScript).toContain("compose ps");
    expect(smokeScript).toContain('compose logs --tail="$LOG_TAIL"');
    expect(smokeScript).toContain("gateway otel-collector prometheus grafana");
    expect(smokeScript).toContain("wait_for_text");
    expect(smokeScript).toContain("OBSERVABILITY_SMOKE_WAIT_ATTEMPTS");
    expect(smokeScript).toContain("docs/observability/local-demo/generate-traffic.sh");
    expect(smokeScript).toContain("docs/observability/local-demo/inspect.sh");
    expect(upScript).toContain("compose up --build -d");
    expect(upScript).toContain("observability startup failed; compose state");
    expect(upScript).toContain("compose ps >&2 || true");
    expect(upScript).toContain("observability startup failed; running observability inspection");
    expect(upScript).toContain("docs/observability/local-demo/inspect.sh >&2 || true");
  });

  it("documents Makefile helper targets for the local observability smoke workflow", () => {
    const docs = [
      readRepoFile("README.md"),
      readRepoFile("docs/observability/README.md"),
      readRepoFile("docs/observability/local-demo/README.md"),
    ].join("\n");

    for (const target of [
      "make observability-up",
      "make observability-preflight",
      "make observability-ready",
      "make observability-traffic",
      "make observability-inspect",
      "make observability-status",
      "make observability-smoke",
      "make observability-down",
    ]) {
      expect(docs).toContain(target);
    }
    expect(docs).toContain("always tears the stack down");
    expect(docs).toContain("prints compose status");
    expect(docs).toContain("make observability-logs");
    expect(docs).toContain("waits for metric export");
    expect(docs).toContain(
      "default local ports `3000`, `4317`, `4318`, `8080`, `9090`, and `9464`",
    );
  });

  it("waits for local demo readiness before one-command smoke traffic", () => {
    const makefile = readRepoFile("Makefile");

    expect(makefile).toContain("observability-ready:");
    expect(makefile).toContain("docs/observability/local-demo/ready.sh");

    const readyScript = readRepoFile("docs/observability/local-demo/ready.sh");

    expect(readyScript).toContain("http://localhost:8080");
    expect(readyScript).toContain("http://localhost:9090");
    expect(readyScript).toContain("$GATEWAY_URL/readyz");
    expect(readyScript).toContain("$PROMETHEUS_URL/-/ready");
    expect(makefile).toContain("observability-smoke:");
    expect(makefile).toContain("docs/observability/local-demo/smoke.sh");

    const smokeScript = readRepoFile("docs/observability/local-demo/smoke.sh");

    expect(smokeScript).toContain("run local demo preflight");
    expect(smokeScript).toContain("docs/observability/local-demo/preflight.sh");
    expect(smokeScript).toContain("make --no-print-directory observability-ready");
    expect(smokeScript).toContain("docs/observability/local-demo/generate-traffic.sh");
    expect(smokeScript).toContain("wait for collector metric export");
    expect(smokeScript).toContain("docs/observability/local-demo/inspect.sh");
  });

  it("runs every inspection check before reporting local demo inspection failures", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agent-gateway-observability-inspect-"));
    const fakeBin = path.join(tmp, "bin");
    const curlShim = path.join(fakeBin, "curl");

    mkdirSync(fakeBin);
    writeFileSync(
      curlShim,
      [
        "#!/usr/bin/env sh",
        "url=",
        'while [ "$#" -gt 0 ]; do',
        '  case "$1" in',
        "    -f|-s|-S|-fsS) shift ;;",
        '    *) url="$1"; shift ;;',
        "  esac",
        "done",
        'case "$url" in',
        "  http://localhost:8080/readyz)",
        '    printf "%s\\n" "{\\"status\\":\\"ready\\",\\"defaultProvider\\":\\"echo\\"}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9464/metrics)",
        '    printf "%s\\n" "agent_gateway_http_server_requests_total 1"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9090/api/v1/rules)",
        '    printf "%s\\n" "{\\"status\\":\\"success\\",\\"data\\":{\\"groups\\":[]}}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9090/api/v1/targets)",
        '    printf "%s\\n" "{\\"status\\":\\"success\\",\\"data\\":{\\"activeTargets\\":[]}}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:3000/api/health)",
        '    printf "%s\\n" "{\\"database\\":\\"starting\\"}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:3000/api/dashboards/uid/agent-gateway-ops)",
        '    printf "%s\\n" "{\\"dashboard\\":{\\"uid\\":\\"other\\",\\"title\\":\\"Other\\"}}"',
        "    exit 0",
        "    ;;",
        "esac",
        "exit 7",
        "",
      ].join("\n"),
    );
    chmodSync(fakeBin, 0o755);
    chmodSync(curlShim, 0o755);

    try {
      const result = spawnSync("sh", ["docs/observability/local-demo/inspect.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("ok: gateway readiness");
      expect(result.stdout).toContain("ok: collector gateway metrics");
      expect(result.stderr).toContain("unexpected prometheus rule loading response");
      expect(result.stderr).toContain("unexpected prometheus collector target response");
      expect(result.stderr).toContain("unexpected grafana health response");
      expect(result.stderr).toContain("unexpected grafana dashboard provisioning response");
      expect(result.stderr).toContain("observability inspection found failures");
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("prints a compact local demo status snapshot without failing on unavailable surfaces", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agent-gateway-observability-status-"));
    const fakeBin = path.join(tmp, "bin");
    const curlShim = path.join(fakeBin, "curl");
    const dockerShim = path.join(fakeBin, "docker");

    mkdirSync(fakeBin);
    writeFileSync(
      curlShim,
      [
        "#!/usr/bin/env sh",
        "url=",
        'while [ "$#" -gt 0 ]; do',
        '  case "$1" in',
        "    -f|-s|-S|-fsS) shift ;;",
        '    *) url="$1"; shift ;;',
        "  esac",
        "done",
        'case "$url" in',
        "  http://localhost:8080/readyz)",
        '    printf "%s\\n" "{\\"status\\":\\"ready\\",\\"defaultProvider\\":\\"echo\\"}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9464/metrics)",
        '    printf "%s\\n" "agent_gateway_http_server_requests_total 1"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9090/-/ready)",
        '    printf "%s\\n" "Prometheus Server is Ready."',
        "    exit 0",
        "    ;;",
        "  http://localhost:3000/api/health)",
        '    printf "%s\\n" "{\\"database\\":\\"ok\\"}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:3000/api/dashboards/uid/agent-gateway-ops)",
        "    exit 22",
        "    ;;",
        "esac",
        "exit 7",
        "",
      ].join("\n"),
    );
    writeFileSync(
      dockerShim,
      [
        "#!/usr/bin/env sh",
        'if [ "$1" = "compose" ]; then',
        "  shift",
        '  if [ "$1" = "-f" ]; then shift 2; fi',
        '  if [ "$1" = "ps" ]; then',
        '    printf "%s\\n" "NAME SERVICE STATUS"',
        '    printf "%s\\n" "grafana grafana running"',
        "    exit 0",
        "  fi",
        "fi",
        "exit 1",
        "",
      ].join("\n"),
    );
    chmodSync(fakeBin, 0o755);
    chmodSync(curlShim, 0o755);
    chmodSync(dockerShim, 0o755);

    try {
      const result = spawnSync("sh", ["docs/observability/local-demo/status.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("observability demo status");
      expect(result.stdout).toContain("compose_project=agent-gateway-observability-demo");
      expect(result.stdout).toContain("--- compose services ---");
      expect(result.stdout).toContain("grafana grafana running");
      expect(result.stdout).toContain("--- gateway readiness: http://localhost:8080/readyz ---");
      expect(result.stdout).toContain('"status":"ready"');
      expect(result.stdout).toContain("--- collector metrics: http://localhost:9464/metrics ---");
      expect(result.stdout).toContain("agent_gateway metrics present");
      expect(result.stdout).toContain(
        "--- prometheus readiness: http://localhost:9090/-/ready ---",
      );
      expect(result.stdout).toContain("Prometheus Server is Ready.");
      expect(result.stdout).toContain("--- grafana health: http://localhost:3000/api/health ---");
      expect(result.stdout).toContain('"database":"ok"');
      expect(result.stdout).toContain(
        "--- grafana dashboard: http://localhost:3000/api/dashboards/uid/agent-gateway-ops ---",
      );
      expect(result.stdout).toContain("unavailable");
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("prints compose state and inspection context when manual demo readiness fails", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agent-gateway-observability-ready-"));
    const fakeBin = path.join(tmp, "bin");
    const curlShim = path.join(fakeBin, "curl");
    const dockerShim = path.join(fakeBin, "docker");

    mkdirSync(fakeBin);
    writeFileSync(
      curlShim,
      [
        "#!/usr/bin/env sh",
        "url=",
        'while [ "$#" -gt 0 ]; do',
        '  case "$1" in',
        "    -f|-s|-S|-fsS) shift ;;",
        '    *) url="$1"; shift ;;',
        "  esac",
        "done",
        'case "$url" in',
        "  http://localhost:8080/readyz)",
        '    printf "%s\\n" "{\\"status\\":\\"ready\\",\\"defaultProvider\\":\\"echo\\"}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9090/-/ready)",
        "    exit 22",
        "    ;;",
        "  http://localhost:9464/metrics)",
        '    printf "%s\\n" "agent_gateway_http_server_requests_total 1"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9090/api/v1/rules)",
        '    printf "%s\\n" "{\\"status\\":\\"success\\",\\"data\\":{\\"groups\\":[]}}"',
        "    exit 0",
        "    ;;",
        "esac",
        "exit 7",
        "",
      ].join("\n"),
    );
    writeFileSync(
      dockerShim,
      [
        "#!/usr/bin/env sh",
        'if [ "$1" = "compose" ]; then',
        "  shift",
        '  if [ "$1" = "-f" ]; then shift 2; fi',
        '  if [ "$1" = "ps" ]; then',
        '    printf "%s\\n" "NAME SERVICE STATUS"',
        '    printf "%s\\n" "gateway gateway running"',
        "    exit 0",
        "  fi",
        "fi",
        "exit 1",
        "",
      ].join("\n"),
    );
    chmodSync(fakeBin, 0o755);
    chmodSync(curlShim, 0o755);
    chmodSync(dockerShim, 0o755);

    try {
      const result = spawnSync("sh", ["docs/observability/local-demo/ready.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          OBSERVABILITY_READY_WAIT_ATTEMPTS: "1",
          OBSERVABILITY_READY_WAIT_SLEEP_SECONDS: "0",
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("observability demo did not become ready");
      expect(result.stderr).toContain("observability ready failed; compose state");
      expect(result.stderr).toContain("--- compose services ---");
      expect(result.stderr).toContain("gateway gateway running");
      expect(result.stderr).toContain(
        "observability ready failed; running observability inspection",
      );
      expect(result.stderr).toContain("ok: gateway readiness");
      expect(result.stderr).toContain("ok: collector gateway metrics");
      expect(result.stderr).toContain("unexpected prometheus rule loading response");
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("prints compose state and inspection context when manual demo startup fails", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agent-gateway-observability-up-"));
    const fakeBin = path.join(tmp, "bin");
    const curlShim = path.join(fakeBin, "curl");
    const dockerShim = path.join(fakeBin, "docker");

    mkdirSync(fakeBin);
    writeFileSync(
      curlShim,
      [
        "#!/usr/bin/env sh",
        "url=",
        'while [ "$#" -gt 0 ]; do',
        '  case "$1" in',
        "    -f|-s|-S|-fsS) shift ;;",
        '    *) url="$1"; shift ;;',
        "  esac",
        "done",
        'case "$url" in',
        "  http://localhost:8080/readyz)",
        '    printf "%s\\n" "{\\"status\\":\\"ready\\",\\"defaultProvider\\":\\"echo\\"}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9464/metrics)",
        '    printf "%s\\n" "agent_gateway_http_server_requests_total 1"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9090/api/v1/rules)",
        '    printf "%s\\n" "{\\"status\\":\\"success\\",\\"data\\":{\\"groups\\":[]}}"',
        "    exit 0",
        "    ;;",
        "esac",
        "exit 7",
        "",
      ].join("\n"),
    );
    writeFileSync(
      dockerShim,
      [
        "#!/usr/bin/env sh",
        'if [ "$1" = "compose" ]; then',
        "  shift",
        '  if [ "$1" = "-f" ]; then shift 2; fi',
        '  if [ "$1" = "up" ]; then',
        '    printf "%s\\n" "compose startup unavailable" >&2',
        "    exit 18",
        "  fi",
        '  if [ "$1" = "ps" ]; then',
        '    printf "%s\\n" "NAME SERVICE STATUS"',
        '    printf "%s\\n" "gateway gateway exited"',
        "    exit 0",
        "  fi",
        "fi",
        "exit 1",
        "",
      ].join("\n"),
    );
    chmodSync(fakeBin, 0o755);
    chmodSync(curlShim, 0o755);
    chmodSync(dockerShim, 0o755);

    try {
      const result = spawnSync("sh", ["docs/observability/local-demo/up.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status).toBe(18);
      expect(result.stderr).toContain("compose startup unavailable");
      expect(result.stderr).toContain("observability startup failed; compose state");
      expect(result.stderr).toContain("--- compose services ---");
      expect(result.stderr).toContain("gateway gateway exited");
      expect(result.stderr).toContain(
        "observability startup failed; running observability inspection",
      );
      expect(result.stderr).toContain("ok: gateway readiness");
      expect(result.stderr).toContain("ok: collector gateway metrics");
      expect(result.stderr).toContain("unexpected prometheus rule loading response");
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("prints compose state and inspection context when manual demo logs cannot stream", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agent-gateway-observability-logs-"));
    const fakeBin = path.join(tmp, "bin");
    const curlShim = path.join(fakeBin, "curl");
    const dockerShim = path.join(fakeBin, "docker");

    mkdirSync(fakeBin);
    writeFileSync(
      curlShim,
      [
        "#!/usr/bin/env sh",
        "url=",
        'while [ "$#" -gt 0 ]; do',
        '  case "$1" in',
        "    -f|-s|-S|-fsS) shift ;;",
        '    *) url="$1"; shift ;;',
        "  esac",
        "done",
        'case "$url" in',
        "  http://localhost:8080/readyz)",
        '    printf "%s\\n" "{\\"status\\":\\"ready\\",\\"defaultProvider\\":\\"echo\\"}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9464/metrics)",
        '    printf "%s\\n" "agent_gateway_http_server_requests_total 1"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9090/api/v1/rules)",
        '    printf "%s\\n" "{\\"status\\":\\"success\\",\\"data\\":{\\"groups\\":[]}}"',
        "    exit 0",
        "    ;;",
        "esac",
        "exit 7",
        "",
      ].join("\n"),
    );
    writeFileSync(
      dockerShim,
      [
        "#!/usr/bin/env sh",
        'if [ "$1" = "compose" ]; then',
        "  shift",
        '  if [ "$1" = "-f" ]; then shift 2; fi',
        '  if [ "$1" = "logs" ]; then',
        '    printf "%s\\n" "compose log stream unavailable" >&2',
        "    exit 17",
        "  fi",
        '  if [ "$1" = "ps" ]; then',
        '    printf "%s\\n" "NAME SERVICE STATUS"',
        '    printf "%s\\n" "gateway gateway running"',
        "    exit 0",
        "  fi",
        "fi",
        "exit 1",
        "",
      ].join("\n"),
    );
    chmodSync(fakeBin, 0o755);
    chmodSync(curlShim, 0o755);
    chmodSync(dockerShim, 0o755);

    try {
      const result = spawnSync("sh", ["docs/observability/local-demo/logs.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status).toBe(17);
      expect(result.stderr).toContain("compose log stream unavailable");
      expect(result.stderr).toContain("observability logs failed; compose state");
      expect(result.stderr).toContain("--- compose services ---");
      expect(result.stderr).toContain("gateway gateway running");
      expect(result.stderr).toContain(
        "observability logs failed; running observability inspection",
      );
      expect(result.stderr).toContain("ok: gateway readiness");
      expect(result.stderr).toContain("ok: collector gateway metrics");
      expect(result.stderr).toContain("unexpected prometheus rule loading response");
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("prints compose state, cleanup context, and inspection context when manual demo teardown fails", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agent-gateway-observability-down-"));
    const fakeBin = path.join(tmp, "bin");
    const curlShim = path.join(fakeBin, "curl");
    const dockerShim = path.join(fakeBin, "docker");

    mkdirSync(fakeBin);
    writeFileSync(
      curlShim,
      [
        "#!/usr/bin/env sh",
        "url=",
        'while [ "$#" -gt 0 ]; do',
        '  case "$1" in',
        "    -f|-s|-S|-fsS) shift ;;",
        '    *) url="$1"; shift ;;',
        "  esac",
        "done",
        'case "$url" in',
        "  http://localhost:8080/readyz)",
        '    printf "%s\\n" "{\\"status\\":\\"ready\\",\\"defaultProvider\\":\\"echo\\"}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9464/metrics)",
        '    printf "%s\\n" "agent_gateway_http_server_requests_total 1"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9090/api/v1/rules)",
        '    printf "%s\\n" "{\\"status\\":\\"success\\",\\"data\\":{\\"groups\\":[]}}"',
        "    exit 0",
        "    ;;",
        "esac",
        "exit 7",
        "",
      ].join("\n"),
    );
    writeFileSync(
      dockerShim,
      [
        "#!/usr/bin/env sh",
        'if [ "$1" = "compose" ]; then',
        "  shift",
        '  if [ "$1" = "-f" ]; then shift 2; fi',
        '  if [ "$1" = "down" ]; then',
        '    printf "%s\\n" "compose teardown unavailable" >&2',
        "    exit 19",
        "  fi",
        '  if [ "$1" = "ps" ]; then',
        '    printf "%s\\n" "NAME SERVICE STATUS"',
        '    printf "%s\\n" "prometheus prometheus running"',
        "    exit 0",
        "  fi",
        "fi",
        "exit 1",
        "",
      ].join("\n"),
    );
    chmodSync(fakeBin, 0o755);
    chmodSync(curlShim, 0o755);
    chmodSync(dockerShim, 0o755);

    try {
      const result = spawnSync("sh", ["docs/observability/local-demo/down.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status).toBe(19);
      expect(result.stderr).toContain("compose teardown unavailable");
      expect(result.stderr).toContain("observability teardown failed; compose state");
      expect(result.stderr).toContain("--- compose services ---");
      expect(result.stderr).toContain("prometheus prometheus running");
      expect(result.stderr).toContain("observability teardown failed; cleanup context");
      expect(result.stderr).toContain("compose_project=agent-gateway-observability-demo");
      expect(result.stderr).toContain("compose_file=compose.observability.yaml");
      expect(result.stderr).toContain(
        "retry_command=COMPOSE_PROJECT_NAME=agent-gateway-observability-demo docker compose -f compose.observability.yaml down",
      );
      expect(result.stderr).toContain(
        "observability teardown failed; running observability inspection",
      );
      expect(result.stderr).toContain("ok: gateway readiness");
      expect(result.stderr).toContain("ok: collector gateway metrics");
      expect(result.stderr).toContain("unexpected prometheus rule loading response");
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("prints compose state and inspection context when manual demo traffic is unexpected", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agent-gateway-observability-traffic-"));
    const fakeBin = path.join(tmp, "bin");
    const curlShim = path.join(fakeBin, "curl");
    const dockerShim = path.join(fakeBin, "docker");

    mkdirSync(fakeBin);
    writeFileSync(
      curlShim,
      [
        "#!/usr/bin/env sh",
        "url=",
        'for arg in "$@"; do',
        '  case "$arg" in',
        '    http://*) url="$arg" ;;',
        "  esac",
        "done",
        'case "$url" in',
        "  http://localhost:8080/v1/requests)",
        '    printf "%s" "500"',
        "    exit 0",
        "    ;;",
        "  http://localhost:8080/readyz)",
        '    printf "%s\\n" "{\\"status\\":\\"ready\\",\\"defaultProvider\\":\\"echo\\"}"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9464/metrics)",
        '    printf "%s\\n" "agent_gateway_http_server_requests_total 1"',
        "    exit 0",
        "    ;;",
        "  http://localhost:9090/api/v1/rules)",
        '    printf "%s\\n" "{\\"status\\":\\"success\\",\\"data\\":{\\"groups\\":[]}}"',
        "    exit 0",
        "    ;;",
        "esac",
        "exit 7",
        "",
      ].join("\n"),
    );
    writeFileSync(
      dockerShim,
      [
        "#!/usr/bin/env sh",
        'if [ "$1" = "compose" ]; then',
        "  shift",
        '  if [ "$1" = "-f" ]; then shift 2; fi',
        '  if [ "$1" = "ps" ]; then',
        '    printf "%s\\n" "NAME SERVICE STATUS"',
        '    printf "%s\\n" "gateway gateway running"',
        "    exit 0",
        "  fi",
        "fi",
        "exit 1",
        "",
      ].join("\n"),
    );
    chmodSync(fakeBin, 0o755);
    chmodSync(curlShim, 0o755);
    chmodSync(dockerShim, 0o755);

    try {
      const result = spawnSync("sh", ["docs/observability/local-demo/generate-traffic.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("500 echo success 1");
      expect(result.stderr).toContain(
        "observability traffic got unexpected status for echo success 1 (expected 200, got 500)",
      );
      expect(result.stderr).toContain("observability traffic failed; compose state");
      expect(result.stderr).toContain("--- compose services ---");
      expect(result.stderr).toContain("gateway gateway running");
      expect(result.stderr).toContain(
        "observability traffic failed; running observability inspection",
      );
      expect(result.stderr).toContain("ok: gateway readiness");
      expect(result.stderr).toContain("ok: collector gateway metrics");
      expect(result.stderr).toContain("unexpected prometheus rule loading response");
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });
});
