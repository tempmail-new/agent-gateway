#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${OBSERVABILITY_COMPOSE_FILE:-compose.observability.yaml}"
COMPOSE_PROJECT_NAME="${OBSERVABILITY_COMPOSE_PROJECT:-agent-gateway-observability-demo}"
LOG_TAIL="${OBSERVABILITY_LOG_TAIL:-100}"

export COMPOSE_PROJECT_NAME

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

print_diagnostics() {
  printf "\nobservability logs failed; compose state\n" >&2
  printf "\n--- compose services ---\n" >&2
  compose ps >&2 || true

  printf "\nobservability logs failed; running observability inspection\n" >&2
  docs/observability/local-demo/inspect.sh >&2 || true
}

if ! command -v docker >/dev/null 2>&1; then
  printf "%s\n" "observability logs failed: docker is required" >&2
  print_diagnostics
  exit 1
fi

set +e
compose logs -f --tail="$LOG_TAIL" gateway otel-collector prometheus grafana
status="$?"
set -e

case "$status" in
  0 | 130 | 143)
    exit "$status"
    ;;
esac

print_diagnostics
exit "$status"
