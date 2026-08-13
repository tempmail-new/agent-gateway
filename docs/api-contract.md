# API Contract

This is the stable caller-facing contract for the current gateway surface. It reflects the behavior implemented by `/healthz`, `/readyz`, and `POST /v1/requests` on `main`.

## Probes

### `GET /healthz`

Use this as a lightweight process health check. It does not require authentication.

```json
{
  "providers": ["echo"],
  "service": "agent-gateway",
  "status": "ok"
}
```

`providers` lists registered provider names for the running process.

### `GET /readyz`

Use this for orchestration readiness checks and container healthchecks. It does not require authentication.

```json
{
  "defaultProvider": "echo",
  "providers": ["echo"],
  "service": "agent-gateway",
  "status": "ready"
}
```

`defaultProvider` is the provider used when a request omits `provider`. `providers` lists every registered provider, including `openai-compatible` when provider credentials are configured.

## `POST /v1/requests`

Authenticated gateway calls require `authorization: Bearer <token>` with a token from `AGENT_GATEWAY_API_KEYS` or `AGENT_GATEWAY_API_KEYS_FILE`.

### Request Body

```json
{
  "input": "Summarize the handoff",
  "metadata": {
    "tenant": "demo"
  },
  "model": "local-test",
  "provider": "echo"
}
```

| Field      | Required | Contract                                                                                                                                      |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `input`    | Yes      | Non-blank string sent to the selected provider.                                                                                               |
| `metadata` | No       | Object whose values are booleans, numbers, or strings. The gateway passes it through for caller-owned context and does not log prompt values. |
| `model`    | Yes      | Non-blank string used for provider execution and provider/model allow-list checks.                                                            |
| `provider` | No       | Non-blank string. When omitted, the configured default provider is used.                                                                      |

The request body is strict. Unknown top-level fields, missing required fields, blank `input`, blank `model`, blank `provider`, and unsupported `metadata` values return `invalid_request` with `reason: request_schema_invalid` before provider selection or outbound calls.

### Success Response

```json
{
  "durationMs": 1.23,
  "id": "req-1",
  "model": "local-test",
  "output": "{\"input\":\"Summarize the handoff\",\"metadata\":{\"tenant\":\"demo\"},\"model\":\"local-test\",\"requestId\":\"req-1\"}",
  "provider": "echo",
  "trace": {
    "requestId": "req-1",
    "traceId": "req-1"
  },
  "usage": {
    "inputTokens": 6,
    "outputTokens": 32
  }
}
```

| Field                | Contract                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `durationMs`         | Gateway processing duration rounded to two decimal places.                                                   |
| `id`                 | Fastify request ID, using `x-request-id` when supplied or a generated ID otherwise.                          |
| `model`              | The requested model.                                                                                         |
| `output`             | Provider output string. The local `echo` provider returns a JSON string with input, metadata, model, and ID. |
| `provider`           | Resolved provider name.                                                                                      |
| `trace.requestId`    | Same logical request ID used by logs and tracing.                                                            |
| `trace.traceId`      | Current trace handle value.                                                                                  |
| `usage.inputTokens`  | Provider-reported input tokens or the gateway estimate when the provider does not report usage.              |
| `usage.outputTokens` | Provider-reported output tokens or the gateway estimate when the provider does not report usage.             |

## Error Responses

### Authentication

| Status | Body                                  | Meaning                                   |
| ------ | ------------------------------------- | ----------------------------------------- |
| `401`  | `{ "error": "missing_bearer_token" }` | The request did not include bearer auth.  |
| `401`  | `{ "error": "invalid_bearer_token" }` | The bearer token is not in the allow set. |

### Request Contract And Guardrails

| Status | Error family             | Reason                            | Extra fields                     | Meaning                                                                       |
| ------ | ------------------------ | --------------------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `400`  | `invalid_request`        | `request_schema_invalid`          | `details`                        | Request JSON did not match the strict request-body contract.                  |
| `400`  | `unknown_provider`       | n/a                               | `provider`, `supportedProviders` | Request selected a provider that is not registered in this process.           |
| `403`  | `policy_rejected`        | `provider_model_not_allowed`      | `model`, `provider`              | Resolved provider and requested model do not match the configured allow list. |
| `402`  | `budget_exceeded`        | `estimated_input_tokens_exceeded` | `estimatedInputTokens`, `limit`  | Estimated input tokens exceed `AGENT_GATEWAY_MAX_INPUT_TOKENS`.               |
| `413`  | `request_body_too_large` | `request_body_bytes_exceeded`     | `limit`                          | Raw JSON body exceeds configured `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES`.      |
| `413`  | `input_too_large`        | `input_bytes_exceeded`            | `inputBytes`, `limit`            | Parsed `input` exceeds configured `AGENT_GATEWAY_MAX_INPUT_BYTES` as UTF-8.   |

When `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES` is unset, Fastify's default oversized-body response is preserved instead of the gateway-specific `request_body_too_large` body.

### Provider Errors

Provider failures return `error: "provider_error"` and keep prompts, bearer tokens, and provider API keys out of the response.

| Status | `code`                    | Meaning                                                                                  |
| ------ | ------------------------- | ---------------------------------------------------------------------------------------- |
| `502`  | `provider_upstream_error` | The upstream provider returned a non-success status. `details.upstreamStatus` is set.    |
| `502`  | `provider_bad_response`   | The upstream response was not valid JSON or did not match the expected completion shape. |
| `502`  | `provider_request_failed` | The gateway could not complete the outbound provider request.                            |
| `504`  | `provider_timeout`        | The outbound provider request timed out.                                                 |

Provider error bodies use this envelope:

```json
{
  "code": "provider_upstream_error",
  "details": {
    "attemptCount": 1,
    "upstreamStatus": 429
  },
  "error": "provider_error",
  "message": "Provider returned an unsuccessful response",
  "provider": "openai-compatible"
}
```

### Internal Errors

Unexpected gateway failures return status `500` with `{ "error": "internal_error" }`.

## Execution Order

`POST /v1/requests` handles failures in this order:

1. Bearer-token authentication.
2. Strict request-body validation.
3. Parsed input byte limit.
4. Provider resolution.
5. Provider/model allow-list policy.
6. Estimated input-token budget.
7. Provider execution, retry, and provider error normalization.
