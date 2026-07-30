#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${OBSERVABILITY_COMPOSE_FILE:-compose.observability.yaml}"
COMPOSE_PROJECT_NAME="${OBSERVABILITY_COMPOSE_PROJECT:-agent-gateway-observability-demo}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
COLLECTOR_METRICS_URL="${COLLECTOR_METRICS_URL:-http://localhost:9464/metrics}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"

export COMPOSE_PROJECT_NAME

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

section() {
  printf '\n--- %s ---\n' "$1"
}

print_endpoint() {
  label="$1"
  url="$2"

  section "$label: $url"

  if ! command -v curl >/dev/null 2>&1; then
    printf 'curl is not available\n'
    return 0
  fi

  if ! curl -fsS "$url"; then
    printf 'unavailable\n'
  fi
  printf '\n'
}

print_collector_metrics() {
  section "collector metrics: $COLLECTOR_METRICS_URL"

  if ! command -v curl >/dev/null 2>&1; then
    printf 'curl is not available\n'
    return 0
  fi

  if body="$(curl -fsS "$COLLECTOR_METRICS_URL")" && printf "%s" "$body" | grep -q "agent_gateway"; then
    printf 'agent_gateway metrics present\n'
    return 0
  fi

  printf 'agent_gateway metrics unavailable\n'
}

printf "observability demo status\n"
printf "compose_file=%s\n" "$COMPOSE_FILE"
printf "compose_project=%s\n" "$COMPOSE_PROJECT_NAME"
printf "gateway_url=%s\n" "$GATEWAY_URL"
printf "collector_metrics_url=%s\n" "$COLLECTOR_METRICS_URL"
printf "prometheus_url=%s\n" "$PROMETHEUS_URL"
printf "grafana_url=%s\n" "$GRAFANA_URL"

if command -v docker >/dev/null 2>&1; then
  section "compose services"
  compose ps --all || true
else
  printf '\ndocker is not available; observability status cannot inspect compose services\n' >&2
fi

print_endpoint "gateway readiness" "$GATEWAY_URL/readyz"
print_collector_metrics
print_endpoint "prometheus readiness" "$PROMETHEUS_URL/-/ready"
print_endpoint "grafana health" "$GRAFANA_URL/api/health"
print_endpoint "grafana dashboard" "$GRAFANA_URL/api/dashboards/uid/agent-gateway-ops"
