# Guardrail Verification Quickstart

Use this path after the first local request works and you want the shortest safe proof that gateway guardrails reject malformed, disallowed, oversized, and over-budget requests before provider execution.

## Prerequisites

- Node.js `22.12.0` or newer.
- `curl`.

## 1. Clone And Install

```bash
git clone https://github.com/tempmail-new/agent-gateway.git
cd agent-gateway
npm install
```

## 2. Run With Local Guardrails

Start the gateway in one terminal with the local `echo` provider and three guardrail settings:

```bash
AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS='echo:local-test' \
AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES=120 \
AGENT_GATEWAY_MAX_INPUT_TOKENS=1 \
npm run dev
```

This keeps the development token as `dev-token`, allows only `echo:local-test`, rejects JSON bodies larger than `120` bytes, and rejects inputs estimated above `1` token.

In a second terminal, confirm the process is ready:

```bash
curl -s http://localhost:8080/readyz
```

Expected shape:

```json
{
  "defaultProvider": "echo",
  "providers": ["echo"],
  "service": "agent-gateway",
  "status": "ready"
}
```

## 3. Prove Schema Rejection

Send an authenticated request with an unknown top-level field:

```bash
curl -s -i http://localhost:8080/v1/requests \
  -H 'authorization: Bearer dev-token' \
  -H 'content-type: application/json' \
  -d '{
    "model": "local-test",
    "input": "ok",
    "temperature": 0.9
  }'
```

Expected proof points:

```text
HTTP/1.1 400 Bad Request
```

```json
{
  "error": "invalid_request",
  "reason": "request_schema_invalid"
}
```

The `details` object will include the rejected `temperature` field.

## 4. Prove Policy Rejection

Send a request for a model outside `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS`:

```bash
curl -s -i http://localhost:8080/v1/requests \
  -H 'authorization: Bearer dev-token' \
  -H 'content-type: application/json' \
  -d '{
    "model": "blocked-model",
    "input": "ok"
  }'
```

Expected body:

```json
{
  "error": "policy_rejected",
  "model": "blocked-model",
  "provider": "echo",
  "reason": "provider_model_not_allowed"
}
```

## 5. Prove Request-Size Rejection

Send a JSON body larger than `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES`:

```bash
node -e "process.stdout.write(JSON.stringify({ model: 'local-test', input: 'x'.repeat(180) }))" \
  | curl -s -i http://localhost:8080/v1/requests \
      -H 'authorization: Bearer dev-token' \
      -H 'content-type: application/json' \
      --data-binary @-
```

Expected body:

```json
{
  "error": "request_body_too_large",
  "limit": 120,
  "reason": "request_body_bytes_exceeded"
}
```

Use `AGENT_GATEWAY_MAX_INPUT_BYTES` when you need a separate limit for the parsed `input` string. Use `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES` when you want the HTTP parser to reject the full JSON payload, including metadata and encoded content.

## 6. Prove Budget Rejection

Send an allowed local model with input that exceeds the `1` token budget:

```bash
curl -s -i http://localhost:8080/v1/requests \
  -H 'authorization: Bearer dev-token' \
  -H 'content-type: application/json' \
  -d '{
    "model": "local-test",
    "input": "hello"
  }'
```

Expected body:

```json
{
  "error": "budget_exceeded",
  "estimatedInputTokens": 2,
  "limit": 1,
  "reason": "estimated_input_tokens_exceeded"
}
```

## Next Checks

- Use `docs/common-failure-modes.md#request-failures` to map these responses to the first fix.
- Use `docs/operator-env-reference.md#guardrails` to choose guardrail variables for a different local or deployment run.
- Press `Ctrl-C` in the server terminal when you are done, then restart without these environment variables for the normal first-request path.
