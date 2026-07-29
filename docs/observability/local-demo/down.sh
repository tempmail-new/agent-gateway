#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${OBSERVABILITY_COMPOSE_FILE:-compose.observability.yaml}"
COMPOSE_PROJECT_NAME="${OBSERVABILITY_COMPOSE_PROJECT:-agent-gateway-observability-demo}"

export COMPOSE_PROJECT_NAME

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

print_diagnostics() {
  printf "\nobservability teardown failed; compose state\n" >&2
  printf "\n--- compose services ---\n" >&2
  compose ps >&2 || true

  printf "\nobservability teardown failed; cleanup context\n" >&2
  printf "%s\n" "compose_project=$COMPOSE_PROJECT_NAME" >&2
  printf "%s\n" "compose_file=$COMPOSE_FILE" >&2
  printf "%s\n" "retry_command=COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME docker compose -f $COMPOSE_FILE down" >&2

  printf "\nobservability teardown failed; running observability inspection\n" >&2
  docs/observability/local-demo/inspect.sh >&2 || true
}

if ! command -v docker >/dev/null 2>&1; then
  printf "%s\n" "observability teardown failed: docker is required" >&2
  print_diagnostics
  exit 1
fi

set +e
compose down
status="$?"
set -e

if [ "$status" -eq 0 ]; then
  exit 0
fi

print_diagnostics
exit "$status"
