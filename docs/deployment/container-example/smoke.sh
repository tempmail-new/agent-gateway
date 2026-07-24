#!/bin/sh
set -eu

. docs/deployment/container-example/env.sh

SMOKE_TOKEN="${AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN:-deploy-example-token}"
WAIT_ATTEMPTS="${DEPLOYMENT_EXAMPLE_WAIT_ATTEMPTS:-30}"
WAIT_SECONDS="${DEPLOYMENT_EXAMPLE_WAIT_SECONDS:-2}"
current_step="startup"

compose() {
  COMPOSE_PROJECT_NAME="$DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT" docker compose -f "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE" "$@"
}

log() {
  printf '%s\n' "deployment smoke: $*"
}

fail() {
  printf '%s\n' "deployment smoke failed: $*" >&2
  exit 1
}

finish() {
  status="$1"
  trap - EXIT

  if [ "$status" -ne 0 ]; then
    printf "\ndeployment smoke failed during: %s\n" "$current_step" >&2
    docs/deployment/container-example/diagnose.sh >&2 || true
  fi

  compose down --remove-orphans >/dev/null 2>&1 || true
  exit "$status"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "$1 is required"
  fi
}

wait_for_readyz() {
  i=1
  while [ "$i" -le "$WAIT_ATTEMPTS" ]; do
    if curl -fsS "$DEPLOYMENT_EXAMPLE_GATEWAY_URL/readyz" 2>/dev/null | grep -q '"status":"ready"'; then
      return 0
    fi
    sleep "$WAIT_SECONDS"
    i=$((i + 1))
  done

  fail "$DEPLOYMENT_EXAMPLE_GATEWAY_URL/readyz did not become ready"
}

wait_for_container_health() {
  container_id="$(compose ps -q gateway)"
  if [ -z "$container_id" ]; then
    fail "gateway container was not created"
  fi

  i=1
  while [ "$i" -le "$WAIT_ATTEMPTS" ]; do
    health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_id")"
    if [ "$health_status" = "healthy" ]; then
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

verify_default_provider_validation() {
  validation_output="$(mktemp)"
  if compose run --rm --no-deps -e AGENT_GATEWAY_DEFAULT_PROVIDER=missing gateway >"$validation_output" 2>&1; then
    rm -f "$validation_output"
    fail "startup accepted an unavailable default provider"
  fi

  if ! grep -q "Unknown provider 'missing'" "$validation_output"; then
    cat "$validation_output" >&2
    rm -f "$validation_output"
    fail "startup validation error did not mention the unavailable default provider"
  fi

  rm -f "$validation_output"
}

verify_request_path() {
  response="$(
    curl -fsS "$DEPLOYMENT_EXAMPLE_GATEWAY_URL/v1/requests" \
      -H "authorization: Bearer $SMOKE_TOKEN" \
      -H "content-type: application/json" \
      -d '{"model":"local-test","input":"deployment smoke"}'
  )"

  printf '%s\n' "$response" | grep -q '"provider":"echo"' || fail "smoke request did not use echo provider"
  printf '%s\n' "$response" | grep -q '"model":"local-test"' || fail "smoke request returned an unexpected model"
}

validate_compose_file() {
  compose config >/dev/null
}

run_step() {
  current_step="$1"
  shift

  log "$current_step"
  "$@"
}

require_command curl
require_command docker

run_step "run deployment preflight" docs/deployment/container-example/preflight.sh

trap 'finish "$?"' EXIT

run_step "validate compose file" validate_compose_file

run_step "build gateway image" compose build gateway

run_step "verify default provider startup validation" verify_default_provider_validation

run_step "start gateway with mounted secret files" compose up -d gateway

run_step "wait for readiness" wait_for_readyz

run_step "wait for container healthcheck" wait_for_container_health

run_step "send authenticated smoke request" verify_request_path

current_step="complete"
log "ok"
