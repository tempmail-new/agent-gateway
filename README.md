# Agent Gateway

Agent Gateway is a small, production-shaped TypeScript service for authenticated agent and LLM request intake. It demonstrates a provider boundary, observable request handling, and CI-backed repository hygiene without pretending to be a finished platform.

## What Exists

- Fastify API with `/healthz`, `/readyz`, and `POST /v1/requests`.
- Bearer-token authentication for gateway requests.
- Provider registry with an executable local `echo` provider and optional OpenAI-compatible provider.
- Strict JSON request-shape validation for `POST /v1/requests`.
- Config-driven provider/model allow policy before provider execution.
- Config-driven request body and input byte guardrails before provider execution.
- Config-driven input token budget guard before provider execution.
- Env-gated transient retry control for OpenAI-compatible provider calls.
- File-backed secret loading for deployment-mounted gateway and provider API keys.
- A checked-in deployment smoke example for container runs with mounted secret files, default-provider startup validation, and readiness/healthcheck verification.
- OpenTelemetry traces and metrics can be exported to an OTLP HTTP collector when configured, with structured logs around provider execution that include upstream status, attempt count, retry count, and normalized error code fields without prompts or secrets.
- Gateway metrics cover HTTP request count/duration and provider call count/duration with bounded operational attributes.
- Operator-facing observability assets under `docs/observability` cover collector wiring, a Grafana dashboard import, starter Prometheus alerts with traffic gates, and a runbook for tuning the shipped metrics.
- A local observability demo compose stack starts the gateway, collector, Prometheus, and Grafana with sample traffic instructions for end-to-end smoke checks.
- Vitest coverage for auth, routing, validation, provider errors, and mocked outbound provider calls.
- Dockerfile with a readiness healthcheck, Makefile, ESLint, Prettier, TypeScript build, and GitHub Actions CI.

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

| Variable                                | Default                        | Purpose                                                                                                                                                 |
| --------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` | unset                          | Optional comma-separated `provider:model` allow list. Entries are trimmed, non-blank, support `*` wildcards, and concrete providers must be registered. |
| `AGENT_GATEWAY_API_KEYS`                | `dev-token` outside production | Comma-separated bearer tokens allowed to call `/v1/requests`. Entries are trimmed, and blank entries fail startup. Required in production.              |
| `AGENT_GATEWAY_API_KEYS_FILE`           | unset                          | Path to a readable file containing `AGENT_GATEWAY_API_KEYS`. Cannot be combined with the inline variable.                                               |
| `AGENT_GATEWAY_DEFAULT_PROVIDER`        | `echo`                         | Trimmed non-blank provider selected when a request omits `provider`.                                                                                    |
| `AGENT_GATEWAY_MAX_INPUT_BYTES`         | unset                          | Optional positive base-10 integer byte limit for parsed request `input`. Oversized inputs are rejected early.                                           |
| `AGENT_GATEWAY_MAX_INPUT_TOKENS`        | unset                          | Optional positive base-10 integer input-token budget. Over-budget requests are rejected early.                                                          |
| `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES`  | unset                          | Optional positive base-10 integer byte limit for incoming JSON request bodies. Oversized bodies are rejected early.                                     |
| `AGENT_GATEWAY_OPENAI_API_KEY`          | unset                          | Enables the `openai-compatible` provider when set.                                                                                                      |
| `AGENT_GATEWAY_OPENAI_API_KEY_FILE`     | unset                          | Path to a readable file containing `AGENT_GATEWAY_OPENAI_API_KEY`. Cannot be combined with the inline variable.                                         |
| `AGENT_GATEWAY_OPENAI_BASE_URL`         | `https://api.openai.com/v1`    | Base URL for an OpenAI-compatible Chat Completions API.                                                                                                 |
| `AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS`     | `1`                            | Provider request attempts for retryable OpenAI-compatible failures. Strict base-10 integer range: `1` to `5`.                                           |
| `AGENT_GATEWAY_OPENAI_TIMEOUT_MS`       | `30000`                        | Outbound provider request timeout in milliseconds. Must be a strict base-10 integer.                                                                    |
| `OTEL_EXPORTER_OTLP_ENDPOINT`           | unset                          | Optional OTLP HTTP collector base URL. The gateway appends `/v1/traces` and `/v1/metrics`.                                                              |
| `OTEL_EXPORTER_OTLP_HEADERS`            | unset                          | Optional comma-separated OTLP headers in `key=value` format.                                                                                            |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`   | unset                          | Optional exact OTLP HTTP metrics endpoint. Takes precedence over the base endpoint for metrics.                                                         |
| `OTEL_EXPORTER_OTLP_METRICS_HEADERS`    | unset                          | Optional metric-specific OTLP headers. Overrides generic header keys.                                                                                   |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`    | unset                          | Optional exact OTLP HTTP traces endpoint. Takes precedence over the base endpoint.                                                                      |
| `OTEL_EXPORTER_OTLP_TRACES_HEADERS`     | unset                          | Optional trace-specific OTLP headers. Overrides generic header keys.                                                                                    |
| `OTEL_SERVICE_NAME`                     | `agent-gateway`                | Service name used by OpenTelemetry API tracers.                                                                                                         |
| `PORT`                                  | `8080`                         | HTTP listen port. Must be a strict base-10 integer.                                                                                                     |

`/healthz` returns a lightweight process health response. `/readyz` returns the configured service name, registered providers, and resolved default provider for deployment readiness checks. The container image uses `/readyz` for its Docker healthcheck.

Set `provider` to `openai-compatible` on a request, or set `AGENT_GATEWAY_DEFAULT_PROVIDER=openai-compatible`, to route through the outbound Chat Completions adapter. The adapter requires `AGENT_GATEWAY_OPENAI_API_KEY` or `AGENT_GATEWAY_OPENAI_API_KEY_FILE` and returns normalized `provider_error` responses for upstream failures, malformed responses, request failures, and timeouts. Startup fails if the configured default provider is blank or not registered.

`POST /v1/requests` accepts only `input`, `metadata`, `model`, and `provider` as top-level fields. `input`, `model`, and supplied `provider` values must contain non-whitespace text. Unknown top-level fields and blank request fields are rejected with `invalid_request` and `reason: request_schema_invalid` before provider selection or outbound calls.

Use the `*_FILE` secret variables when mounting secrets from an orchestrator. File contents are trimmed, must be non-empty, and cannot be combined with the matching inline secret variable. `AGENT_GATEWAY_API_KEYS` file or inline values may contain comma-separated tokens, but empty comma-separated entries are rejected during startup.

Set `AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS` above `1` to retry transient OpenAI-compatible failures. Retries are limited to request failures, timeouts, and clearly retryable upstream statuses: `408`, `409`, `425`, `429`, `500`, `502`, `503`, and `504`. Non-transient upstream responses and malformed successful responses are not retried. Provider-call traces and logs include attempt and retry counts.

When `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` is set, requests are rejected with `policy_rejected` before provider execution unless the resolved provider and requested model match one of the configured rules. Each allow-list entry is trimmed and must use non-blank `provider:model` format; blank entries, missing segments, extra separators, or concrete provider names that are not registered fail startup. Use `*` for an intentional provider or model wildcard. Example: `echo:local-test,openai-compatible:gpt-4o-mini,openai-compatible:*`.

When `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES` is set, Fastify rejects oversized JSON bodies with `request_body_too_large` before the route handler runs. When `AGENT_GATEWAY_MAX_INPUT_BYTES` is set, the gateway measures the parsed `input` as UTF-8 bytes and rejects oversized inputs with `input_too_large` before provider execution. These byte limits bound payload and data-URL abuse; `AGENT_GATEWAY_MAX_INPUT_TOKENS` remains the separate model-cost budget.

When `AGENT_GATEWAY_MAX_INPUT_TOKENS` is set, the gateway estimates input tokens locally and rejects requests with `budget_exceeded` before provider execution when the estimate is above the configured limit.

When `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, or `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` is set, the gateway starts the OpenTelemetry Node SDK before listening and flushes it during shutdown. Leaving them unset keeps OTLP export disabled while preserving local request behavior. Header values may be URL-encoded, such as `authorization=Bearer%20token`.

Metrics use the same OpenTelemetry bootstrap as traces. The first metric slice records `agent_gateway.http.server.requests`, `agent_gateway.http.server.duration`, `agent_gateway.provider.calls`, and `agent_gateway.provider.duration`. HTTP metrics include method, route, and status code. Provider metrics include provider, outcome, and normalized error code.

See `docs/observability/README.md` for an operator pack with an OpenTelemetry Collector example, Prometheus/Grafana dashboard artifact, traffic-gated starter alert rules, runbook guidance, and a compose-based local demo path for these metrics.

For a production-shaped container smoke path, use `make deployment-smoke`. It first runs `make deployment-preflight` checks for Docker, Docker Compose, compose validity, default deployment port `18080`, stale containers, and readable and non-empty mounted secret files; then it builds the image, starts the gateway from `compose.deployment-example.yaml`, verifies `AGENT_GATEWAY_DEFAULT_PROVIDER=echo` through `/readyz` at `http://localhost:18080/readyz`, waits for the container healthcheck, sends one authenticated echo request, and proves startup validation rejects an unavailable default provider before the healthy run. Failed smoke runs print the same resolved configuration, compose, readiness, container-health, and gateway-log diagnostics exposed by `make deployment-diagnose`; failed manual `make deployment-ready` runs print the same diagnostics when readiness or the Docker healthcheck does not pass. When you want local changes without editing tracked files, run `make deployment-bootstrap-secrets` to create ignored local env and secret files from the checked-in examples, then set `DEPLOYMENT_EXAMPLE_GATEWAY_PORT`, `DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE`, or `DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE` in `docs/deployment/container-example/.env.local`. Use `make deployment-help` for a quick command map and resolved default paths before choosing a smoke or manual run. Use `make deployment-checklist` to confirm the ignored env file, local secret files, Docker prerequisites, Node.js availability, and manual command order are ready before startup. Use `make deployment-config` to inspect the resolved local env file, compose project, gateway URL, checked ports, and secret file paths/status without printing secret values. When you want to keep the container running for inspection, use the manual lifecycle targets: `deployment-bootstrap-secrets`, `deployment-checklist`, `deployment-preflight`, `deployment-config`, `deployment-up`, `deployment-ready`, `deployment-request`, `deployment-diagnose`, `deployment-logs`, `deployment-down`, and `deployment-reset`. `make deployment-reset` removes ignored `.env.local` and `*.local` deployment files without touching tracked `.example` files. See `docs/deployment/README.md` for the deployment example.

For a local end-to-end smoke run, use `make observability-smoke`. It first runs `make observability-preflight` to verify Docker, Docker Compose, default demo port availability (`3000`, `4317`, `4318`, `8080`, `9090`, and `9464`), and stale demo containers; then it starts the demo stack, waits for readiness, generates sample traffic, waits for metric export, runs observability inspections, prints targeted diagnostics on failure, and always tears the stack down. Individual helper targets are available for `observability-preflight`, `observability-up`, `observability-ready`, `observability-traffic`, `observability-inspect`, `observability-logs`, and `observability-down` when you want to keep services running for manual inspection.

For the bounded text-versus-image compression spike, use `make benchmark-text-image`. The recorded result in `docs/benchmarks/text-vs-image.md` shows the image data URL path costs more estimated input tokens than native text for both `100`-word and `1000`-word samples, so the gateway should not build a text-as-image compression path under its current text-only request contract.

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

The production slice is intentionally narrow. Future observability work should respond to concrete gaps from gateway usage before expanding the metric taxonomy.

The text-as-image compression idea has been benchmarked as a research spike. Native text remains the better default for the current gateway API; revisit only with provider-native multimodal inputs, real provider token accounting, latency, and answer-quality checks.
