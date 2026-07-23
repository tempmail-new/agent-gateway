# Architecture

Agent Gateway keeps the HTTP boundary, provider routing, and observability concerns separate so new provider adapters can be added without rewriting request intake.

## Runtime Operations

- `/healthz` is a lightweight process health endpoint.
- `/readyz` reports the service name, registered providers, and resolved default provider for deployment readiness checks.
- The Docker image includes a healthcheck that probes `/readyz` on the configured `PORT`.
- Startup fails if the configured default provider is blank or not registered, which catches deployment misconfiguration before traffic is accepted.
- Provider/model allow-list entries are trimmed, must use non-blank `provider:model` format, and must reference registered concrete providers before app construction.
- Numeric environment variables use strict base-10 integer parsing so malformed values fail startup instead of being partially accepted.
- Gateway and OpenAI-compatible API keys can be sourced from readable non-empty files for orchestrator-mounted secrets.
- Gateway API-key lists are trimmed and fail startup on blank comma-separated entries so malformed auth config is not silently accepted.

## Request Flow

1. `POST /v1/requests` receives a JSON payload.
2. `authenticate` validates the bearer token and records a non-secret key fingerprint.
3. Fastify rejects request bodies above `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES` when that limit is configured.
4. Zod validates the request body and rejects unknown top-level fields or blank request strings.
5. Request size enforcement rejects parsed `input` values above `AGENT_GATEWAY_MAX_INPUT_BYTES` when that limit is configured.
6. `ProviderRegistry` resolves the requested provider or the configured default provider.
7. Request policy rejects disallowed provider/model combinations before execution when an allow list is configured.
8. Request budget enforcement rejects over-limit input token estimates before execution when a budget is configured.
9. Optional provider adapters perform outbound calls with their own timeout, retry, and error normalization rules.
10. `withGatewayTrace` wraps provider execution with OpenTelemetry API attributes and events for provider duration, upstream status, attempt count, retry count, timeout state, and normalized error codes.
11. Provider execution records a small metric set for provider call count and duration, tagged by provider, outcome, and normalized error code.
12. Fastify response hooks record HTTP request count and duration, tagged by method, route, and status code.
13. When an OTLP endpoint is configured, the OpenTelemetry Node SDK exports spans and/or metrics to the configured HTTP collector and flushes during process shutdown.
14. Operator assets under `docs/observability` show a first collector, dashboard, alert, and runbook path for the emitted metric surface.
15. The selected provider returns normalized output and usage metadata.

## Boundaries

- `src/http`: transport-level concerns such as authentication.
- `src/policy`: request governance decisions independent of Fastify and provider adapters.
- `src/providers`: provider interface, registry, shared provider errors, and adapters.
- `src/observability`: tracing hooks, metric instruments, and telemetry bootstrap independent of provider adapters.
- `src/app.ts`: application composition and routes.
- `src/server.ts`: process startup, HTTP listen, and graceful telemetry shutdown.

## Current Tradeoffs

- The `echo` provider is deterministic and local so CI can validate the gateway without external credentials.
- The `openai-compatible` provider is registered only when `AGENT_GATEWAY_OPENAI_API_KEY` is present, and tests mock outbound calls instead of using live credentials. Its retry control is opt-in with a bounded attempt range and only retries request failures, timeouts, and selected transient upstream statuses.
- Provider/model policy is opt-in so existing deployments keep permissive behavior until an allow list is configured. Configured allow-list entries fail startup when any provider or model segment is blank or malformed, or when a concrete provider name is not registered in the running process.
- Request-shape validation is strict at the top level so accidental client parameters are rejected before provider selection or outbound calls. Request `input`, `model`, and supplied `provider` values must contain non-whitespace text. `metadata` remains an open key/value bag for caller-owned context.
- Request body and input byte limits are opt-in so operators can bound payload size without changing provider behavior. Input size is measured as UTF-8 bytes, which keeps data-URL and non-ASCII payload accounting deterministic.
- Input token budgeting is opt-in and uses a simple local estimate so CI and early rejection behavior stay deterministic.
- OTLP export is opt-in so local development and CI do not require a collector. Generic collector endpoints enable trace and metric export paths; signal-specific endpoints can enable either path independently.
- The first metric surface is intentionally small: HTTP request count/duration and provider call count/duration. The repository includes starter collector, dashboard, alert, and runbook assets for these instruments; a larger taxonomy is deferred until these signals are exercised.
- Provider-call logs intentionally exclude prompts, metadata, bearer tokens, and provider API keys. They include operational fields such as provider, model, request ID, duration, upstream status, attempt count, retry count, timeout flag, and normalized error code.
- API keys can be configured through inline environment variables or matching `*_FILE` variables for mounted secret files. Blank `AGENT_GATEWAY_API_KEYS` entries fail startup, while the non-production `dev-token` fallback is preserved only when no API keys are configured. Direct secret manager APIs still belong in a later platform-specific increment.
