# Architecture

Agent Gateway keeps the HTTP boundary, provider routing, and observability concerns separate so new provider adapters can be added without rewriting request intake.

## Request Flow

1. `POST /v1/requests` receives a JSON payload.
2. `authenticate` validates the bearer token and records a non-secret key fingerprint.
3. Zod validates the request body.
4. `ProviderRegistry` resolves the requested provider or the configured default provider.
5. Request policy rejects disallowed provider/model combinations before execution when an allow list is configured.
6. Request budget enforcement rejects over-limit input token estimates before execution when a budget is configured.
7. Optional provider adapters perform outbound calls with their own timeout and error normalization.
8. `withGatewayTrace` wraps provider execution with OpenTelemetry API attributes.
9. The selected provider returns normalized output and usage metadata.

## Boundaries

- `src/http`: transport-level concerns such as authentication.
- `src/policy`: request governance decisions independent of Fastify and provider adapters.
- `src/providers`: provider interface, registry, shared provider errors, and adapters.
- `src/observability`: tracing hooks independent of Fastify.
- `src/app.ts`: application composition and routes.

## Current Tradeoffs

- The `echo` provider is deterministic and local so CI can validate the gateway without external credentials.
- The `openai-compatible` provider is registered only when `AGENT_GATEWAY_OPENAI_API_KEY` is present, and tests mock outbound calls instead of using live credentials.
- Provider/model policy is opt-in so existing deployments keep permissive behavior until an allow list is configured.
- Input token budgeting is opt-in and uses a simple local estimate so CI and early rejection behavior stay deterministic.
- OpenTelemetry uses the API package only. Runtime exporters can be added later without changing the provider contract.
- API keys are configured from environment variables. A secret manager integration belongs in a later deployment-focused increment.
