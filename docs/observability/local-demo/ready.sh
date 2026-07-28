#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${OBSERVABILITY_COMPOSE_FILE:-compose.observability.yaml}"
COMPOSE_PROJECT_NAME="${OBSERVABILITY_COMPOSE_PROJECT:-agent-gateway-observability-demo}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
WAIT_ATTEMPTS="${OBSERVABILITY_READY_WAIT_ATTEMPTS:-30}"
WAIT_SLEEP_SECONDS="${OBSERVABILITY_READY_WAIT_SLEEP_SECONDS:-2}"

export COMPOSE_PROJECT_NAME
export GATEWAY_URL
export PROMETHEUS_URL

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

print_diagnostics() {
  printf "\nobservability ready failed; compose state\n" >&2
  printf "\n--- compose services ---\n" >&2
  compose ps >&2 || true

  printf "\nobservability ready failed; running observability inspection\n" >&2
  docs/observability/local-demo/inspect.sh >&2 || true
}

i=1
while [ "$i" -le "$WAIT_ATTEMPTS" ]; do
  if curl -fsS "$GATEWAY_URL/readyz" >/dev/null && curl -fsS "$PROMETHEUS_URL/-/ready" >/dev/null; then
    echo "observability demo is ready"
    exit 0
  fi

  sleep "$WAIT_SLEEP_SECONDS"
  i=$((i + 1))
done

echo "observability demo did not become ready" >&2
print_diagnostics
exit 1
