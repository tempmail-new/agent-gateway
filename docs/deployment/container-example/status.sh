#!/usr/bin/env sh
set -eu

. docs/deployment/container-example/env.sh

compose() {
  COMPOSE_PROJECT_NAME="$DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT" docker compose -f "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE" "$@"
}

section() {
  printf '\n--- %s ---\n' "$1"
}

print_readyz() {
  section "gateway readiness: $DEPLOYMENT_EXAMPLE_GATEWAY_URL/readyz"

  if ! command -v curl >/dev/null 2>&1; then
    printf 'curl is not available\n'
    return 0
  fi

  if ! curl -fsS "$DEPLOYMENT_EXAMPLE_GATEWAY_URL/readyz"; then
    printf 'unavailable\n'
  fi
  printf '\n'
}

print_container_health() {
  section "gateway container health"

  container_id="$(compose ps -q gateway 2>/dev/null || true)"
  if [ -z "$container_id" ]; then
    printf 'gateway container is not running\n'
    return 0
  fi

  docker inspect --format 'container={{.Name}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_id" 2>/dev/null || true
}

printf "deployment example status\n"
printf "env_file=%s\n" "$DEPLOYMENT_EXAMPLE_ENV_FILE"
printf "compose_file=%s\n" "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE"
printf "compose_project=%s\n" "$DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT"
printf "gateway_url=%s\n" "$DEPLOYMENT_EXAMPLE_GATEWAY_URL"

if ! command -v docker >/dev/null 2>&1; then
  printf '\ndocker is not available; deployment status cannot inspect compose services\n' >&2
  print_readyz
  exit 0
fi

section "compose services"
compose ps --all || true

print_readyz
print_container_health
