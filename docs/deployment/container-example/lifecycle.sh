#!/bin/sh
set -eu

. docs/deployment/container-example/env.sh

LOG_TAIL="${DEPLOYMENT_EXAMPLE_LOG_TAIL:-100}"
SMOKE_TOKEN="$AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN"
WAIT_ATTEMPTS="${DEPLOYMENT_EXAMPLE_WAIT_ATTEMPTS:-30}"
WAIT_SECONDS="${DEPLOYMENT_EXAMPLE_WAIT_SECONDS:-2}"

compose() {
  COMPOSE_PROJECT_NAME="$DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT" docker compose -f "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE" "$@"
}

log() {
  printf '%s\n' "deployment example: $*"
}

fail() {
  printf '%s\n' "deployment example failed: $*" >&2
  exit 1
}

finish_ready() {
  status="$1"
  trap - EXIT

  if [ "$status" -ne 0 ]; then
    printf '\ndeployment ready failed; running deployment diagnostics\n' >&2
    docs/deployment/container-example/diagnose.sh >&2 || true
  fi

  exit "$status"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "$1 is required"
  fi
}

container_id() {
  compose ps -q gateway
}

wait_for_readyz() {
  i=1
  while [ "$i" -le "$WAIT_ATTEMPTS" ]; do
    if curl -fsS "$DEPLOYMENT_EXAMPLE_GATEWAY_URL/readyz" 2>/dev/null | grep -q '"status":"ready"'; then
      log "gateway ready at $DEPLOYMENT_EXAMPLE_GATEWAY_URL/readyz"
      return 0
    fi
    sleep "$WAIT_SECONDS"
    i=$((i + 1))
  done

  fail "$DEPLOYMENT_EXAMPLE_GATEWAY_URL/readyz did not become ready"
}

wait_for_container_health() {
  id="$(container_id)"
  if [ -z "$id" ]; then
    fail "gateway container was not created"
  fi

  i=1
  while [ "$i" -le "$WAIT_ATTEMPTS" ]; do
    health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$id")"
    if [ "$health_status" = "healthy" ]; then
      log "gateway container healthcheck is healthy"
      return 0
    fi
    if [ "$health_status" = "unhealthy" ]; then
      fail "gateway container healthcheck is unhealthy"
    fi
    sleep "$WAIT_SECONDS"
    i=$((i + 1))
  done

  fail "gateway container healthcheck did not become healthy"
}

up() {
  require_command docker
  log "run deployment preflight"
  docs/deployment/container-example/preflight.sh
  log "start gateway"
  compose up --build -d gateway
}

ready() {
  require_command curl
  require_command docker
  trap 'finish_ready "$?"' EXIT
  wait_for_readyz
  wait_for_container_health
  trap - EXIT
}

request() {
  require_command curl
  response="$(
    curl -fsS "$DEPLOYMENT_EXAMPLE_GATEWAY_URL/v1/requests" \
      -H "authorization: Bearer $SMOKE_TOKEN" \
      -H "content-type: application/json" \
      -d '{"model":"local-test","input":"deployment helper request"}'
  )"

  printf '%s\n' "$response" | grep -q '"provider":"echo"' || fail "request did not use echo provider"
  printf '%s\n' "$response" | grep -q '"model":"local-test"' || fail "request returned an unexpected model"
  printf '%s\n' "$response"
}

logs() {
  require_command docker
  compose logs -f --tail="$LOG_TAIL" gateway
}

down() {
  require_command docker
  compose down --remove-orphans
}

case "${1:-}" in
  up)
    up
    ;;
  ready)
    ready
    ;;
  request)
    request
    ;;
  logs)
    logs
    ;;
  down)
    down
    ;;
  *)
    printf '%s\n' "usage: $0 {up|ready|request|logs|down}" >&2
    exit 2
    ;;
esac
