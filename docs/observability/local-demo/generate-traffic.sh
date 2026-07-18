#!/usr/bin/env sh
set -eu

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
TOKEN="${AGENT_GATEWAY_DEMO_TOKEN:-demo-token}"

post_request() {
  label="$1"
  token="$2"
  body="$3"

  status="$(
    curl -sS -o /dev/null -w "%{http_code}" \
      "$GATEWAY_URL/v1/requests" \
      -H "authorization: Bearer $token" \
      -H "content-type: application/json" \
      -d "$body"
  )"

  printf "%s %s\n" "$status" "$label"
}

i=1
while [ "$i" -le 24 ]; do
  post_request "echo success $i" "$TOKEN" "{
    \"model\": \"local-test\",
    \"input\": \"local demo request $i\",
    \"metadata\": { \"tenant\": \"demo\", \"sequence\": $i }
  }"
  i=$((i + 1))
done

post_request "auth rejection" "wrong-token" '{
  "model": "local-test",
  "input": "auth rejection"
}'

post_request "policy rejection" "$TOKEN" '{
  "model": "blocked-model",
  "input": "policy rejection"
}'

post_request "budget rejection" "$TOKEN" '{
  "model": "local-test",
  "input": "this local smoke request intentionally contains enough words to exceed the small demo input budget"
}'

post_request "validation rejection" "$TOKEN" '{
  "model": "local-test",
  "input": ""
}'

printf "scrape metrics: curl -s %s | grep agent_gateway\n" "http://localhost:9464/metrics"
