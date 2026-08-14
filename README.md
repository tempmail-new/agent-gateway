# Agent Gateway

Agent Gateway is a small, production-shaped TypeScript service for authenticated agent and LLM request intake. It demonstrates a provider boundary, observable request handling, and CI-backed repository hygiene without pretending to be a finished platform.

## Fastest Operator Paths

First time here? Start with `docs/operator-journey-index.md` when you want to choose the right guide by goal. Use `docs/first-request-quickstart.md` to go from install to one authenticated local `POST /v1/requests` call and a readiness/auth check. After the local `echo` request works, use `docs/openai-compatible-provider-quickstart.md` to register one real outbound provider and call it explicitly, `docs/deployment-smoke-quickstart.md` to run the container smoke path with file-backed secrets, `docs/guardrail-verification-quickstart.md` to deliberately prove schema, policy, request-size, and budget rejections, or `docs/observability-smoke-quickstart.md` to prove telemetry export through the local collector, Prometheus rules, and Grafana dashboard. Use `docs/operator-acceptance-checklist.md` when you need the shortest pilot-readiness checklist across request intake, provider routing, deployment, guardrails, observability, and validation. Use `docs/pilot-configuration-template.md` after the checklist passes to record provider/model policy, request guardrails, secret mounts, telemetry wiring, and expected failure handling for a narrow pilot, then open the GitHub issue form at `.github/ISSUE_TEMPLATE/pilot.yml` to track those decisions in the repository. Use `docs/pilot-dry-run-runbook.md` before real pilot traffic to rehearse the recorded decisions once and capture go/no-go evidence. Use `docs/operator-env-reference.md` when you need the smallest environment variable set for local, provider, deployment, guardrail, or telemetry runs. If either path fails, use `docs/common-failure-modes.md` to map the response to auth, policy, budget, provider, readiness, deployment, or observability checks.

| Goal                                                        | Command                                         | What it proves                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choose the right operator guide                             | `docs/operator-journey-index.md`                | Routes local first request, real provider request, deployment smoke, guardrail proof, observability, pilot readiness, tracked pilot planning, and dry-run goals to the shortest path.   |
| Make the first authenticated local request                  | `docs/first-request-quickstart.md`              | Installs dependencies, starts the local gateway, checks `/readyz`, sends one echo request with `dev-token`, and confirms the auth gate.                                                 |
| Make the first real provider request                        | `docs/openai-compatible-provider-quickstart.md` | Registers the optional `openai-compatible` provider, checks `/readyz`, sends one authenticated outbound request, and diagnoses one provider error.                                      |
| Run the first deployment smoke                              | `docs/deployment-smoke-quickstart.md`           | Bootstraps ignored local secret files, runs the container smoke, and points the first failed run to status and diagnostics.                                                             |
| Prove local guardrail rejections                            | `docs/guardrail-verification-quickstart.md`     | Starts the local echo path with guardrails and proves schema, policy, request-size, and budget rejections before provider execution.                                                    |
| Run the operator acceptance checklist                       | `docs/operator-acceptance-checklist.md`         | Ties first request, real provider, deployment smoke, guardrail rejection, observability smoke, and repository validation into one pilot-readiness pass.                                 |
| Record narrow pilot configuration choices                   | `docs/pilot-configuration-template.md`          | Converts the passing acceptance checklist into copyable provider/model policy, guardrail, secret-mount, telemetry, and expected failure-handling decisions.                             |
| Track a narrow pilot issue                                  | `.github/ISSUE_TEMPLATE/pilot.yml`              | Opens a GitHub-native pilot form for owner, scope, deployment path, success signal, rollback trigger, runtime policy, guardrails, secrets, telemetry, and failure handling.             |
| Rehearse a narrow pilot before traffic                      | `docs/pilot-dry-run-runbook.md`                 | Turns the tracked pilot decisions into one go/no-go dry run with validation, readiness, provider, deployment, guardrail, telemetry, and evidence checks.                                |
| Choose runtime environment variables                        | `docs/operator-env-reference.md`                | Shows the smallest local, provider, deployment, guardrail, and telemetry variable sets with startup validation checks.                                                                  |
| Validate the container deployment example                   | `make deployment-smoke`                         | Builds the image, mounts file-backed secrets, checks `/readyz` and the Docker healthcheck, sends an authenticated echo request, and verifies bad default-provider config fails startup. |
| Inspect deployment helper commands before running Docker    | `make deployment-help`                          | Prints the smoke/manual command map, resolved default paths, and supported override knobs without touching the runtime.                                                                 |
| Check a running deployment example without log noise        | `make deployment-status`                        | Prints compose state, `/readyz`, and container health for the local deployment example.                                                                                                 |
| Run the first observability smoke                           | `docs/observability-smoke-quickstart.md`        | Starts the gateway, collector, Prometheus, and Grafana with `make observability-smoke`; verifies metrics, rules, targets, and dashboard provisioning; then tears the stack down.        |
| Inspect observability helper commands before running Docker | `make observability-help`                       | Prints the local demo command map, endpoint URLs, resolved compose defaults, and override knobs.                                                                                        |
| Check a running observability demo without log noise        | `make observability-status`                     | Prints compose state, gateway readiness, collector metric presence, Prometheus readiness, Grafana health, and dashboard availability.                                                   |

Start with `docs/operator-journey-index.md` to choose the right operator guide by goal, `docs/first-request-quickstart.md` for the local first-request path, `docs/openai-compatible-provider-quickstart.md` for the first real provider call, `docs/deployment-smoke-quickstart.md` for the production-shaped container path, `docs/guardrail-verification-quickstart.md` for local rejection proofs, `docs/observability-smoke-quickstart.md` for the telemetry smoke path, `docs/operator-acceptance-checklist.md` for pilot readiness, `docs/pilot-configuration-template.md` for narrow pilot decisions, `.github/ISSUE_TEMPLATE/pilot.yml` for tracked pilot planning, `docs/pilot-dry-run-runbook.md` for the final rehearsal before pilot traffic, `docs/operator-env-reference.md` for environment-variable choices, `docs/api-contract.md` for request, response, error, and readiness semantics, `docs/common-failure-modes.md` when a request or smoke run fails, `docs/release-checklist.md` for validation, versioning, release-note, and tag-cut expectations, and `make validate` for repository hygiene. The deeper operator references are `docs/deployment/README.md`, `docs/observability/README.md`, and `docs/architecture.md`.

## Architecture And Decisions

Use `docs/architecture.md` for the runtime shape, request flow, module boundaries, and current tradeoffs. Use `docs/adr/0001-provider-boundary.md` for the first accepted decision: starting with a provider boundary and deterministic local `echo` adapter before adding networked model providers.

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

## Security

Report suspected vulnerabilities through `SECURITY.md`. Use a private GitHub advisory when possible, and do not disclose bearer tokens, provider keys, mounted secret values, prompts, raw request payloads, or production logs in public issues or pull requests.

## Support

Use `SUPPORT.md` to route usage questions, reproducible bugs, narrow pilot planning, and security disclosures to the right existing repository path. Reproducible bugs use the GitHub issue form at `.github/ISSUE_TEMPLATE/bug.yml`.

## Maintenance

CI runs format, lint, tests, and build on pull requests and pushes to `main`. Dependabot is configured in `.github/dependabot.yml` to check npm dependencies and GitHub Actions weekly, with grouped production, development, and workflow update pull requests so maintenance stays reviewable.

Use `docs/release-checklist.md` before cutting a release. It documents semantic versioning expectations, release-note content, the required validation order, and the minimal `main` tag flow for this narrow service.

## License

Agent Gateway is released under the MIT License. See `LICENSE` for the full terms and the matching SPDX identifier in `package.json`.

## API

Use `docs/api-contract.md` for the full request-body, success-response, error, `/healthz`, and `/readyz` contract.

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

Use `docs/operator-env-reference.md` for run-specific environment variable sets and startup validation checks.

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

## Operator Run Paths

For a production-shaped container smoke path, use `make deployment-smoke`. It runs preflight checks, builds the image, mounts file-backed gateway and provider secrets, verifies `AGENT_GATEWAY_DEFAULT_PROVIDER=echo` through `/readyz` at `http://localhost:18080/readyz`, waits for the container healthcheck, sends one authenticated echo request, and proves startup validation rejects an unavailable default provider before the healthy run. Use `make deployment-help` before manual work, `make deployment-status` for a compact running-state snapshot, and `make deployment-diagnose` when you need resolved configuration, compose state, readiness, container health, and recent logs. Manual lifecycle targets cover bootstrap, checklist, preflight, config, up, ready, request, status, diagnose, logs, down, and reset; `make deployment-reset` removes ignored local files without touching tracked `.example` files. See `docs/deployment/README.md` for the full deployment example.

For the local telemetry path, use `make observability-smoke`. It verifies Docker prerequisites and demo ports, starts the gateway, collector, Prometheus, and Grafana, waits for readiness, generates representative traffic, waits for metric export, checks Prometheus rules and targets, confirms Grafana dashboard provisioning, prints targeted diagnostics on failure, and always tears the stack down. Use `make observability-help` to see the command map and local URLs, `make observability-status` for a compact gateway/collector/Prometheus/Grafana snapshot, and `make observability-inspect` when you want every local wiring check to run before returning failure. Manual helper targets cover preflight, up, ready, traffic, status, inspect, logs, and down. See `docs/observability/README.md` for the operations pack and `docs/observability/local-demo/README.md` for the full smoke workflow.

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

Contributor workflow, documentation expectations, and PR hygiene are covered in `CONTRIBUTING.md`.

## Roadmap

The production slice is intentionally narrow. Future observability work should respond to concrete gaps from gateway usage before expanding the metric taxonomy.

The text-as-image compression idea has been benchmarked as a research spike. Native text remains the better default for the current gateway API; revisit only with provider-native multimodal inputs, real provider token accounting, latency, and answer-quality checks.
