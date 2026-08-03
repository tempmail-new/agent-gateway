# Pilot Configuration Template

Use this template after `docs/operator-acceptance-checklist.md` passes and before a small team runs the gateway for a narrow pilot. It turns the acceptance proof into copyable runtime choices: provider/model policy, request guardrails, secret mounts, telemetry export, and expected failure handling.

Keep the pilot intentionally small. Choose one tenant or workflow, one provider route, one deployment path, and the first failure responses the team will treat as expected operator signals.

## Pilot Scope

Copy this block into the pilot issue, runbook, or deployment notes:

```markdown
Pilot name:
Owner:
Workflow or tenant:
Pilot start:
Pilot end or review date:
Gateway version or commit:
Deployment path:
Success signal:
Rollback trigger:
```

## Runtime Decisions

Fill every `Chosen value` before the pilot starts. Use `docs/operator-env-reference.md` for variable details and startup validation rules.

| Decision area             | Chosen value | Gateway variable or proof path                                                                                                                                                   |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default provider          |              | `AGENT_GATEWAY_DEFAULT_PROVIDER`                                                                                                                                                 |
| Allowed provider models   |              | `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS`                                                                                                                                          |
| Request body byte limit   |              | `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES`                                                                                                                                           |
| Parsed input byte limit   |              | `AGENT_GATEWAY_MAX_INPUT_BYTES`                                                                                                                                                  |
| Input token budget        |              | `AGENT_GATEWAY_MAX_INPUT_TOKENS`                                                                                                                                                 |
| Gateway API key source    |              | `AGENT_GATEWAY_API_KEYS_FILE` for mounted secrets, or `AGENT_GATEWAY_API_KEYS` only for local shell runs.                                                                        |
| Provider API key source   |              | `AGENT_GATEWAY_OPENAI_API_KEY_FILE` for mounted secrets, or `AGENT_GATEWAY_OPENAI_API_KEY` only for local shell runs.                                                            |
| Provider base URL         |              | `AGENT_GATEWAY_OPENAI_BASE_URL` when using a non-default OpenAI-compatible endpoint.                                                                                             |
| Provider timeout/retries  |              | `AGENT_GATEWAY_OPENAI_TIMEOUT_MS` and `AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS`.                                                                                                       |
| Telemetry service name    |              | `OTEL_SERVICE_NAME`                                                                                                                                                              |
| Trace export endpoint     |              | `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`.                                                                                                           |
| Metric export endpoint    |              | `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`.                                                                                                          |
| Expected request failures |              | `invalid_request`, `policy_rejected`, `request_body_too_large`, `input_too_large`, `budget_exceeded`, `provider_error`, and the matching `docs/common-failure-modes.md` section. |

## Narrow Pilot Example

This example keeps the local `echo` path available, permits one OpenAI-compatible model, rejects oversized request bodies before route handling, rejects unexpectedly large inputs before provider execution, and exports telemetry through one collector endpoint:

```bash
export AGENT_GATEWAY_DEFAULT_PROVIDER=echo
export AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS='echo:local-test,openai-compatible:gpt-4o-mini'
export AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES=32768
export AGENT_GATEWAY_MAX_INPUT_BYTES=12000
export AGENT_GATEWAY_MAX_INPUT_TOKENS=3000
export AGENT_GATEWAY_OPENAI_TIMEOUT_MS=30000
export AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS=2
export OTEL_SERVICE_NAME=agent-gateway-pilot
export OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

For a production-shaped container pilot, prefer mounted secret files over inline secrets:

```bash
export AGENT_GATEWAY_API_KEYS_FILE=/run/secrets/agent-gateway-api-keys
export AGENT_GATEWAY_OPENAI_API_KEY_FILE=/run/secrets/openai-api-key
```

Run `make deployment-smoke` after writing the mounted files, then check `/readyz` to confirm the resolved default provider and registered providers before sending pilot traffic.

## Expected Failure Handling

Record the response the pilot owner expects before each request reaches a provider:

| Failure class                  | Expected response code   | Expected error code      | First check                                                     |
| ------------------------------ | ------------------------ | ------------------------ | --------------------------------------------------------------- |
| Missing or wrong bearer token  | `401`                    | `unauthorized`           | `docs/common-failure-modes.md#request-failures`                 |
| Invalid request shape          | `400`                    | `invalid_request`        | `docs/guardrail-verification-quickstart.md`                     |
| Provider/model outside policy  | `403`                    | `policy_rejected`        | `docs/operator-env-reference.md#guardrails`                     |
| Oversized JSON request body    | `413`                    | `request_body_too_large` | `docs/operator-env-reference.md#guardrails`                     |
| Oversized parsed input         | `413`                    | `input_too_large`        | `docs/operator-env-reference.md#guardrails`                     |
| Input token estimate too large | `402`                    | `budget_exceeded`        | `docs/operator-env-reference.md#guardrails`                     |
| Upstream provider failure      | Provider status or `502` | `provider_error`         | `docs/common-failure-modes.md#provider-errors`                  |
| Deployment smoke failure       | Helper failure output    | Depends on failed check  | `make deployment-status`, then `make deployment-diagnose`.      |
| Telemetry smoke failure        | Helper failure output    | Depends on failed check  | `make observability-status`, then `make observability-inspect`. |

Treat these failures as expected guardrail behavior during a pilot. Investigate only when the status, error code, or first-check path differs from the recorded decision.

## Preflight

Before sending pilot traffic:

- Run the relevant proof from `docs/operator-acceptance-checklist.md`.
- Confirm `/readyz` shows the intended `defaultProvider`, registered providers, and `serviceName`.
- Confirm file-backed secrets are readable, non-empty, and not also set through inline secret variables.
- Confirm the allow list includes the local `echo:local-test` path if rollback or diagnostics depend on it.
- Confirm guardrail limits reject the cases documented in `docs/guardrail-verification-quickstart.md`.
- Confirm the telemetry backend receives gateway metrics through `make observability-smoke` or the team's equivalent collector check.
