# Agent Gateway

Agent Gateway is a small, production-shaped TypeScript service for authenticated agent and LLM request intake. It demonstrates a provider boundary, observable request handling, and CI-backed repository hygiene without pretending to be a finished platform.

## What Exists

- Fastify API with `/healthz` and `POST /v1/requests`.
- Bearer-token authentication for gateway requests.
- Provider registry with an executable local `echo` provider.
- OpenTelemetry API trace hooks around provider execution.
- Vitest coverage for auth, routing, validation, and provider errors.
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

| Variable                         | Default                        | Purpose                                                                               |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| `AGENT_GATEWAY_API_KEYS`         | `dev-token` outside production | Comma-separated bearer tokens allowed to call `/v1/requests`. Required in production. |
| `AGENT_GATEWAY_DEFAULT_PROVIDER` | `echo`                         | Provider selected when a request omits `provider`.                                    |
| `OTEL_SERVICE_NAME`              | `agent-gateway`                | Service name used by OpenTelemetry API tracers.                                       |
| `PORT`                           | `8080`                         | HTTP listen port.                                                                     |

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

The first production slice is intentionally narrow. Next useful increments are a real provider adapter, policy and budget middleware, and exported OpenTelemetry SDK wiring for a chosen collector.
