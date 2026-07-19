#!/usr/bin/env sh
set -eu

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
COLLECTOR_METRICS_URL="${COLLECTOR_METRICS_URL:-http://localhost:9464/metrics}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"

fetch() {
  label="$1"
  url="$2"

  if ! curl -fsS "$url"; then
    printf "failed to fetch %s from %s\n" "$label" "$url" >&2
    return 1
  fi
}

require_text() {
  label="$1"
  expected="$2"
  url="$3"

  if fetch "$label" "$url" | grep -q "$expected"; then
    printf "ok: %s\n" "$label"
    return 0
  fi

  printf "missing %s in %s\n" "$expected" "$url" >&2
  return 1
}

require_json() {
  label="$1"
  url="$2"
  script="$3"

  if fetch "$label" "$url" | node -e "$script"; then
    printf "ok: %s\n" "$label"
    return 0
  fi

  printf "unexpected %s response from %s\n" "$label" "$url" >&2
  return 1
}

require_json "gateway readiness" "$GATEWAY_URL/readyz" '
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const body = JSON.parse(input);
  if (body.status === "ready" && body.defaultProvider === "echo") {
    process.exit(0);
  }
  process.exit(1);
});
'

require_text "collector gateway metrics" "agent_gateway" "$COLLECTOR_METRICS_URL"

require_json "prometheus rule loading" "$PROMETHEUS_URL/api/v1/rules" '
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const body = JSON.parse(input);
  const groups = body.data?.groups ?? [];
  const rules = groups.flatMap((group) => group.rules ?? []);
  const names = new Set(rules.map((rule) => rule.name));
  if (
    body.status === "success" &&
    names.has("AgentGatewayElevatedHttp5xxRate") &&
    names.has("AgentGatewayElevatedProviderErrorRate") &&
    names.has("AgentGatewayHighProviderLatency")
  ) {
    process.exit(0);
  }
  process.exit(1);
});
'

require_json "prometheus collector target" "$PROMETHEUS_URL/api/v1/targets" '
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const body = JSON.parse(input);
  const targets = body.data?.activeTargets ?? [];
  const collector = targets.find((target) => {
    return (
      target.labels?.job === "agent-gateway-otel-collector" &&
      target.scrapeUrl?.includes("otel-collector:9464")
    );
  });
  if (body.status === "success" && collector?.health === "up") {
    process.exit(0);
  }
  process.exit(1);
});
'

require_json "grafana health" "$GRAFANA_URL/api/health" '
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const body = JSON.parse(input);
  if (body.database === "ok") {
    process.exit(0);
  }
  process.exit(1);
});
'

require_json "grafana dashboard provisioning" "$GRAFANA_URL/api/dashboards/uid/agent-gateway-ops" '
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const body = JSON.parse(input);
  if (body.dashboard?.uid === "agent-gateway-ops" && body.dashboard?.title === "Agent Gateway") {
    process.exit(0);
  }
  process.exit(1);
});
'
