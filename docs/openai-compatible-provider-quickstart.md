# OpenAI-Compatible Provider Quickstart

Use this path after the local `echo` request succeeds and you want the shortest proof that the gateway can register an outbound provider and send one real Chat Completions request.

## Prerequisites

- Completed `docs/first-request-quickstart.md`.
- A provider API key for an OpenAI-compatible Chat Completions endpoint.
- The model name you are allowed to call, such as `gpt-4o-mini`.

## 1. Set The Minimum Environment

Keep the gateway token local and add only the provider credentials needed for this run:

```bash
export AGENT_GATEWAY_API_KEYS=dev-token
export AGENT_GATEWAY_OPENAI_API_KEY='<provider-api-key>'
export AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS='echo:local-test,openai-compatible:gpt-4o-mini'
```

The default provider can stay as `echo`. The allow list keeps the first quickstart's `echo:local-test` request available, and the request below names `provider: "openai-compatible"` explicitly to prove the outbound provider path.

If your provider does not use OpenAI's default `https://api.openai.com/v1` base URL, set its Chat Completions-compatible API root:

```bash
export AGENT_GATEWAY_OPENAI_BASE_URL='https://provider.example/v1'
```

For mounted or local secret files, use `AGENT_GATEWAY_OPENAI_API_KEY_FILE` instead of `AGENT_GATEWAY_OPENAI_API_KEY`; do not set both.

## 2. Start The Gateway

```bash
npm run dev
```

## 3. Confirm Provider Registration

In a second terminal:

```bash
curl -s http://localhost:8080/readyz
```

Expected shape:

```json
{
  "defaultProvider": "echo",
  "providers": ["echo", "openai-compatible"],
  "service": "agent-gateway",
  "status": "ready"
}
```

The important proof is that `providers` includes `openai-compatible`. If it does not, restart with `AGENT_GATEWAY_OPENAI_API_KEY` or `AGENT_GATEWAY_OPENAI_API_KEY_FILE` set.

## 4. Send One Real Provider Request

```bash
curl -s http://localhost:8080/v1/requests \
  -H 'authorization: Bearer dev-token' \
  -H 'content-type: application/json' \
  -d '{
    "provider": "openai-compatible",
    "model": "gpt-4o-mini",
    "input": "Reply with one short sentence confirming the provider path works.",
    "metadata": { "tenant": "demo" }
  }'
```

Expected shape:

```json
{
  "id": "req-1",
  "model": "gpt-4o-mini",
  "output": "The provider path is working.",
  "provider": "openai-compatible",
  "usage": {
    "inputTokens": 14,
    "outputTokens": 6
  }
}
```

The exact text, token counts, request id, and duration vary by provider. The important result is `provider: "openai-compatible"` with a non-empty `output`.

## 5. Diagnose One Provider Error

If the request returns `502` or `504`, keep the response body and check the normalized provider error:

```json
{
  "error": "provider_error",
  "code": "provider_upstream_error",
  "details": {
    "attemptCount": 1,
    "upstreamStatus": 401
  },
  "provider": "openai-compatible"
}
```

For `provider_upstream_error` with `details.upstreamStatus`, start with the provider key, base URL, and model access. A `401` or `403` usually means the upstream provider rejected credentials or account access; `404` often means the base URL or model is wrong; `429` means the upstream rate or quota limit was hit.

For `provider_timeout`, check `AGENT_GATEWAY_OPENAI_TIMEOUT_MS` and provider latency. For `provider_bad_response`, confirm the endpoint returns an OpenAI-compatible Chat Completions response with `choices[0].message.content`.

Use `docs/common-failure-modes.md#provider-errors` for the fuller failure map, including retries, logs, and metrics.
