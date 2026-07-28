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

up_diagnostics() {
  printf '\n%s\n' "deployment up failed; running deployment status" >&2
  docs/deployment/container-example/status.sh >&2 || true

  printf '\n%s\n' "deployment up failed; running deployment diagnostics" >&2
  docs/deployment/container-example/diagnose.sh >&2 || true
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
  if ! compose up --build -d gateway; then
    up_diagnostics
    exit 1
  fi
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

  body_file="$(mktemp)"
  error_file="$(mktemp)"

  set +e
  http_status="$(
    curl -sS -o "$body_file" -w "%{http_code}" "$DEPLOYMENT_EXAMPLE_GATEWAY_URL/v1/requests" \
      -H "authorization: Bearer $SMOKE_TOKEN" \
      -H "content-type: application/json" \
      -d '{"model":"local-test","input":"deployment helper request"}' \
      2>"$error_file"
  )"
  curl_status="$?"
  set -e

  if [ "$curl_status" -ne 0 ]; then
    printf '%s\n' "deployment request failed: curl exited with status $curl_status while calling $DEPLOYMENT_EXAMPLE_GATEWAY_URL/v1/requests" >&2
    if [ -s "$error_file" ]; then
      printf '\n--- curl error ---\n' >&2
      cat "$error_file" >&2
    fi
    request_diagnostics
    rm -f "$body_file" "$error_file"
    exit 1
  fi

  if [ "$http_status" -lt 200 ] || [ "$http_status" -gt 299 ]; then
    printf '%s\n' "deployment request failed: HTTP status $http_status from $DEPLOYMENT_EXAMPLE_GATEWAY_URL/v1/requests" >&2
    print_request_body "$body_file" >&2
    request_diagnostics
    rm -f "$body_file" "$error_file"
    exit 1
  fi

  response="$(cat "$body_file")"
  if ! printf '%s\n' "$response" | grep -q '"provider":"echo"'; then
    printf '%s\n' "deployment request failed: response did not use echo provider" >&2
    print_request_body "$body_file" >&2
    request_diagnostics
    rm -f "$body_file" "$error_file"
    exit 1
  fi

  if ! printf '%s\n' "$response" | grep -q '"model":"local-test"'; then
    printf '%s\n' "deployment request failed: response returned an unexpected model" >&2
    print_request_body "$body_file" >&2
    request_diagnostics
    rm -f "$body_file" "$error_file"
    exit 1
  fi

  rm -f "$body_file" "$error_file"
  printf '%s\n' "$response"
}

print_request_body() {
  body_file="$1"

  printf '\n--- response body ---\n' >&2
  if [ -s "$body_file" ]; then
    cat "$body_file" >&2
  else
    printf 'empty\n' >&2
  fi
}

request_diagnostics() {
  printf '\n%s\n' "deployment request failed; running deployment status" >&2
  docs/deployment/container-example/status.sh >&2 || true

  printf '\n%s\n' "deployment request failed; running deployment diagnostics" >&2
  docs/deployment/container-example/diagnose.sh >&2 || true
}

logs_diagnostics() {
  printf '\n%s\n' "deployment logs failed; running deployment status" >&2
  docs/deployment/container-example/status.sh >&2 || true

  printf '\n%s\n' "deployment logs failed; running deployment diagnostics" >&2
  docs/deployment/container-example/diagnose.sh >&2 || true
}

down_diagnostics() {
  printf '\n%s\n' "deployment down failed; running deployment status" >&2
  docs/deployment/container-example/status.sh >&2 || true

  printf '\n%s\n' "deployment down failed; cleanup context" >&2
  printf '%s\n' "compose_project=$DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT" >&2
  printf '%s\n' "compose_file=$DEPLOYMENT_EXAMPLE_COMPOSE_FILE" >&2
  printf '%s\n' "retry_command=COMPOSE_PROJECT_NAME=$DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT docker compose -f $DEPLOYMENT_EXAMPLE_COMPOSE_FILE down --remove-orphans" >&2

  printf '\n%s\n' "deployment down failed; running deployment diagnostics" >&2
  docs/deployment/container-example/diagnose.sh >&2 || true
}

logs() {
  if ! command -v docker >/dev/null 2>&1; then
    printf '%s\n' "deployment logs failed: docker is required" >&2
    logs_diagnostics
    exit 1
  fi

  set +e
  compose logs -f --tail="$LOG_TAIL" gateway
  status="$?"
  set -e

  case "$status" in
    0 | 130 | 143)
      exit "$status"
      ;;
  esac

  logs_diagnostics
  exit "$status"
}

down() {
  if ! command -v docker >/dev/null 2>&1; then
    printf '%s\n' "deployment down failed: docker is required" >&2
    down_diagnostics
    exit 1
  fi

  set +e
  compose down --remove-orphans
  status="$?"
  set -e

  if [ "$status" -ne 0 ]; then
    down_diagnostics
    exit "$status"
  fi
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
