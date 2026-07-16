# Agent Gateway

Agent Gateway is a small, production-shaped TypeScript service for authenticated agent and LLM request intake. It demonstrates a provider boundary, observable request handling, and CI-backed repository hygiene without pretending to be a finished platform.

## What Exists

- Fastify API with `/healthz` and `POST /v1/requests`.
- Bearer-token authentication for gateway requests.
- Provider registry with an executable local `echo` provider and optional OpenAI-compatible provider.
- Config-driven provider/model allow policy before provider execution.
- Config-driven input token budget guard before provider execution.
- OpenTelemetry traces can be exported to an OTLP HTTP collector when configured, with structured logs around provider execution that include upstream status and normalized error code fields without prompts or secrets.
- Vitest coverage for auth, routing, validation, provider errors, and mocked outbound provider calls.
- Dockerfile, Makefile, ESLint, Prettier, TypeScript build, and GitHub Actions CI.

## API

```bash
curl -s http://localhost:8080/v1/requests \
  -H 'authorization: Bearer dev-token' \
  -H 'content-type: application/json' \
  -d '{
    "model": "local-test",
    "input": "Summarize the handoff",
    "metadata": { "tenant": "demo" }
  }'
```

Response:

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

## Configuration

| Variable                                | Default                        | Purpose                                                                                |
| --------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` | unset                          | Optional comma-separated `provider:model` allow list. Supports `*` wildcards.          |
| `AGENT_GATEWAY_API_KEYS`                | `dev-token` outside production | Comma-separated bearer tokens allowed to call `/v1/requests`. Required in production.  |
| `AGENT_GATEWAY_DEFAULT_PROVIDER`        | `echo`                         | Provider selected when a request omits `provider`.                                     |
| `AGENT_GATEWAY_MAX_INPUT_TOKENS`        | unset                          | Optional positive integer input-token budget. Over-budget requests are rejected early. |
| `AGENT_GATEWAY_OPENAI_API_KEY`          | unset                          | Enables the `openai-compatible` provider when set.                                     |
| `AGENT_GATEWAY_OPENAI_BASE_URL`         | `https://api.openai.com/v1`    | Base URL for an OpenAI-compatible Chat Completions API.                                |
| `AGENT_GATEWAY_OPENAI_TIMEOUT_MS`       | `30000`                        | Outbound provider request timeout in milliseconds.                                     |
| `OTEL_EXPORTER_OTLP_ENDPOINT`           | unset                          | Optional OTLP HTTP collector base URL. The gateway appends `/v1/traces`.               |
| `OTEL_EXPORTER_OTLP_HEADERS`            | unset                          | Optional comma-separated OTLP headers in `key=value` format.                           |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`    | unset                          | Optional exact OTLP HTTP traces endpoint. Takes precedence over the base endpoint.     |
| `OTEL_EXPORTER_OTLP_TRACES_HEADERS`     | unset                          | Optional trace-specific OTLP headers. Overrides generic header keys.                   |
| `OTEL_SERVICE_NAME`                     | `agent-gateway`                | Service name used by OpenTelemetry API tracers.                                        |
| `PORT`                                  | `8080`                         | HTTP listen port.                                                                      |

Set `provider` to `openai-compatible` on a request, or set `AGENT_GATEWAY_DEFAULT_PROVIDER=openai-compatible`, to route through the outbound Chat Completions adapter. The adapter requires `AGENT_GATEWAY_OPENAI_API_KEY` and returns normalized `provider_error` responses for upstream failures, malformed responses, request failures, and timeouts.

When `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` is set, requests are rejected with `policy_rejected` before provider execution unless the resolved provider and requested model match one of the configured rules. Example: `echo:local-test,openai-compatible:gpt-4o-mini,openai-compatible:*`.

When `AGENT_GATEWAY_MAX_INPUT_TOKENS` is set, the gateway estimates input tokens locally and rejects requests with `budget_exceeded` before provider execution when the estimate is above the configured limit.

When `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is set, the gateway starts the OpenTelemetry Node SDK before listening and flushes it during shutdown. Leaving both unset keeps trace export disabled while preserving local request behavior. Header values may be URL-encoded, such as `authorization=Bearer%20token`.

## Development

```bash
npm install
npm run dev
```

Validation:

```bash
make validate
```

## Roadmap

The first production slice is intentionally narrow. The next useful increment is a provider retry policy with explicit retry bounds and tests.
