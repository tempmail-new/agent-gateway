#!/usr/bin/env sh
set -eu

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
TOKEN="${AGENT_GATEWAY_DEMO_TOKEN:-demo-token}"
COMPOSE_FILE="${OBSERVABILITY_COMPOSE_FILE:-compose.observability.yaml}"
COMPOSE_PROJECT_NAME="${OBSERVABILITY_COMPOSE_PROJECT:-agent-gateway-observability-demo}"

export COMPOSE_PROJECT_NAME

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

diagnose_failure() {
  message="$1"

  printf "\n%s\n" "$message" >&2
  printf "\nobservability traffic failed; compose state\n" >&2
  printf "\n--- compose services ---\n" >&2
  compose ps >&2 || true

  printf "\nobservability traffic failed; running observability inspection\n" >&2
  docs/observability/local-demo/inspect.sh >&2 || true
}

post_request() {
  label="$1"
  expected_status="$2"
  token="$3"
  body="$4"

  if ! status="$(
    curl -sS -o /dev/null -w "%{http_code}" \
      "$GATEWAY_URL/v1/requests" \
      -H "authorization: Bearer $token" \
      -H "content-type: application/json" \
      -d "$body"
  )"; then
    diagnose_failure "observability traffic failed during: $label"
    return 1
  fi

  printf "%s %s\n" "$status" "$label"

  if [ "$status" != "$expected_status" ]; then
    diagnose_failure "observability traffic got unexpected status for $label (expected $expected_status, got $status)"
    return 1
  fi
}

i=1
while [ "$i" -le 24 ]; do
  post_request "echo success $i" "200" "$TOKEN" "{
    \"model\": \"local-test\",
    \"input\": \"local demo request $i\",
    \"metadata\": { \"tenant\": \"demo\", \"sequence\": $i }
  }"
  i=$((i + 1))
done

post_request "auth rejection" "401" "wrong-token" '{
  "model": "local-test",
  "input": "auth rejection"
}'

post_request "policy rejection" "403" "$TOKEN" '{
  "model": "blocked-model",
  "input": "policy rejection"
}'

post_request "budget rejection" "402" "$TOKEN" '{
  "model": "local-test",
  "input": "this local smoke request intentionally contains enough words to exceed the small demo input budget"
}'

post_request "validation rejection" "400" "$TOKEN" '{
  "model": "local-test",
  "input": ""
}'

printf "scrape metrics: curl -s %s | grep agent_gateway\n" "http://localhost:9464/metrics"
