# Architecture

Agent Gateway keeps the HTTP boundary, provider routing, and observability concerns separate so new provider adapters can be added without rewriting request intake.

## Request Flow

1. `POST /v1/requests` receives a JSON payload.
2. `authenticate` validates the bearer token and records a non-secret key fingerprint.
3. Zod validates the request body.
4. `ProviderRegistry` resolves the requested provider or the configured default provider.
5. `withGatewayTrace` wraps provider execution with OpenTelemetry API attributes.
6. The selected provider returns normalized output and usage metadata.

## Boundaries

- `src/http`: transport-level concerns such as authentication.
- `src/providers`: provider interface, registry, and adapters.
- `src/observability`: tracing hooks independent of Fastify.
- `src/app.ts`: application composition and routes.

## Current Tradeoffs

- The `echo` provider is deterministic and local so CI can validate the gateway without external credentials.
- OpenTelemetry uses the API package only. Runtime exporters can be added later without changing the provider contract.
- API keys are configured from environment variables. A secret manager integration belongs in a later deployment-focused increment.
