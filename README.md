# Agent Gateway

Agent Gateway is a small, production-shaped TypeScript service for authenticated agent and LLM request intake. It demonstrates a provider boundary, observable request handling, and CI-backed repository hygiene without pretending to be a finished platform.

## What Exists

- Fastify API with `/healthz` and `POST /v1/requests`.
- Bearer-token authentication for gateway requests.
- Provider registry with an executable local `echo` provider and optional OpenAI-compatible provider.
- OpenTelemetry API trace hooks around provider execution.
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

| Variable                          | Default                        | Purpose                                                                               |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| `AGENT_GATEWAY_API_KEYS`          | `dev-token` outside production | Comma-separated bearer tokens allowed to call `/v1/requests`. Required in production. |
| `AGENT_GATEWAY_DEFAULT_PROVIDER`  | `echo`                         | Provider selected when a request omits `provider`.                                    |
| `AGENT_GATEWAY_OPENAI_API_KEY`    | unset                          | Enables the `openai-compatible` provider when set.                                    |
| `AGENT_GATEWAY_OPENAI_BASE_URL`   | `https://api.openai.com/v1`    | Base URL for an OpenAI-compatible Chat Completions API.                               |
| `AGENT_GATEWAY_OPENAI_TIMEOUT_MS` | `30000`                        | Outbound provider request timeout in milliseconds.                                    |
| `OTEL_SERVICE_NAME`               | `agent-gateway`                | Service name used by OpenTelemetry API tracers.                                       |
| `PORT`                            | `8080`                         | HTTP listen port.                                                                     |

Set `provider` to `openai-compatible` on a request, or set `AGENT_GATEWAY_DEFAULT_PROVIDER=openai-compatible`, to route through the outbound Chat Completions adapter. The adapter requires `AGENT_GATEWAY_OPENAI_API_KEY` and returns normalized `provider_error` responses for upstream failures, malformed responses, request failures, and timeouts.

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

The first production slice is intentionally narrow. Next useful increments are policy and budget middleware around provider calls, deeper observability, and exported OpenTelemetry SDK wiring for a chosen collector.
