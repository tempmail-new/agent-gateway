#!/usr/bin/env sh
set -eu

. docs/deployment/container-example/env.sh

compose() {
  COMPOSE_PROJECT_NAME="$DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT" docker compose -f "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE" "$@"
}

section() {
  printf '\n--- %s ---\n' "$1"
}

diagnose_endpoint() {
  label="$1"
  url="$2"

  section "$label: $url"
  if command -v curl >/dev/null 2>&1; then
    if ! curl -fsS "$url"; then
      printf 'unavailable\n'
    fi
  else
    printf 'curl is not available\n'
  fi
  printf '\n'
}

diagnose_container_health() {
  section "gateway container health"

  container_id="$(compose ps -q gateway 2>/dev/null || true)"
  if [ -z "$container_id" ]; then
    printf 'gateway container is not running\n'
    return 0
  fi

  docker inspect --format 'container={{.Name}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_id" 2>/dev/null || true
}

section "resolved deployment configuration"
docs/deployment/container-example/config.sh || true

if ! command -v docker >/dev/null 2>&1; then
  printf 'docker is not available; deployment diagnostics cannot inspect compose services\n' >&2
  exit 0
fi

section "compose services"
compose ps --all || true

diagnose_container_health
diagnose_endpoint "gateway readiness" "$DEPLOYMENT_EXAMPLE_GATEWAY_URL/readyz"

section "recent gateway logs"
compose logs --tail="$DEPLOYMENT_EXAMPLE_DIAGNOSE_LOG_TAIL" gateway || true
