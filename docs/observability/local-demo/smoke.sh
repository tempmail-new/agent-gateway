#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${OBSERVABILITY_COMPOSE_FILE:-compose.observability.yaml}"
LOG_TAIL="${OBSERVABILITY_SMOKE_LOG_TAIL:-120}"
WAIT_ATTEMPTS="${OBSERVABILITY_SMOKE_WAIT_ATTEMPTS:-45}"
WAIT_SLEEP_SECONDS="${OBSERVABILITY_SMOKE_WAIT_SLEEP_SECONDS:-2}"
current_step="startup"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

diagnose_endpoint() {
  label="$1"
  url="$2"

  printf "\n--- %s: %s ---\n" "$label" "$url" >&2
  if ! curl -fsS "$url" >&2; then
    printf "unavailable\n" >&2
  fi
  printf "\n" >&2
}

wait_for_text() {
  label="$1"
  expected="$2"
  url="$3"
  i=1

  while [ "$i" -le "$WAIT_ATTEMPTS" ]; do
    if body="$(curl -fsS "$url")" && printf "%s" "$body" | grep -q "$expected"; then
      printf "ok: %s\n" "$label"
      return 0
    fi

    sleep "$WAIT_SLEEP_SECONDS"
    i=$((i + 1))
  done

  printf "timed out waiting for %s from %s\n" "$label" "$url" >&2
  return 1
}

finish() {
  status="$1"

  if [ "$status" -ne 0 ]; then
    printf "\nlocal observability smoke failed during: %s\n" "$current_step" >&2
    printf "\n--- compose services ---\n" >&2
    compose ps >&2 || true

    diagnose_endpoint "gateway readiness" "http://localhost:8080/readyz"
    diagnose_endpoint "prometheus readiness" "http://localhost:9090/-/ready"
    diagnose_endpoint "grafana health" "http://localhost:3000/api/health"

    printf "\n--- recent service logs ---\n" >&2
    compose logs --tail="$LOG_TAIL" gateway otel-collector prometheus grafana >&2 || true
  fi

  printf "\n--- tearing down observability demo ---\n" >&2
  compose down >&2 || true
  exit "$status"
}

run_step() {
  current_step="$1"
  shift

  printf "\n==> %s\n" "$current_step"
  "$@"
}

trap 'finish "$?"' EXIT

run_step "start compose stack" compose up --build -d
run_step "wait for gateway and prometheus readiness" make --no-print-directory observability-ready
run_step "generate representative traffic" docs/observability/local-demo/generate-traffic.sh
run_step "wait for collector metric export" wait_for_text "collector gateway metrics" "agent_gateway" "http://localhost:9464/metrics"
run_step "inspect observability wiring" docs/observability/local-demo/inspect.sh

current_step="complete"
printf "\nlocal observability smoke completed successfully\n"
