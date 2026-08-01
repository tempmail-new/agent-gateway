# Operator Environment Reference

Use this page when you know which run path you are taking and need the smallest set of environment variables to make startup, provider routing, guardrails, and telemetry predictable.

## Local Echo Request

For `docs/first-request-quickstart.md`, leave the gateway on development defaults:

```bash
npm run dev
```

| Variable                         | Set it when                                                | Local default |
| -------------------------------- | ---------------------------------------------------------- | ------------- |
| `AGENT_GATEWAY_API_KEYS`         | You want a token other than `dev-token`.                   | `dev-token`   |
| `AGENT_GATEWAY_DEFAULT_PROVIDER` | You want requests without `provider` to use another route. | `echo`        |
| `PORT`                           | Port `8080` is already in use.                             | `8080`        |

Keep `AGENT_GATEWAY_API_KEYS` unset for the fastest local proof. In production, set `AGENT_GATEWAY_API_KEYS` or `AGENT_GATEWAY_API_KEYS_FILE`; the development fallback is rejected when `NODE_ENV=production`.

## First Real Provider Request

For `docs/openai-compatible-provider-quickstart.md`, keep the default provider as `echo` and explicitly route the test request to `openai-compatible`:

```bash
export AGENT_GATEWAY_API_KEYS=dev-token
export AGENT_GATEWAY_OPENAI_API_KEY='<provider-api-key>'
export AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS='echo:local-test,openai-compatible:gpt-4o-mini'
```

| Variable                                | Role        | Notes                                                                                |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `AGENT_GATEWAY_OPENAI_API_KEY`          | Secret      | Enables the `openai-compatible` provider. Use only for local shell-based runs.       |
| `AGENT_GATEWAY_OPENAI_API_KEY_FILE`     | Secret file | File-backed alternative for mounted secrets. Do not set it with the inline API key.  |
| `AGENT_GATEWAY_OPENAI_BASE_URL`         | Optional    | Defaults to `https://api.openai.com/v1`; set it for another Chat Completions API.    |
| `AGENT_GATEWAY_OPENAI_TIMEOUT_MS`       | Optional    | Defaults to `30000`; valid range is `1` to `300000`.                                 |
| `AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS`     | Optional    | Defaults to `1`; valid range is `1` to `5` for retryable upstream failures.          |
| `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` | Optional    | Use explicit `provider:model` entries or intentional `*` wildcards for model policy. |

Set either `AGENT_GATEWAY_OPENAI_API_KEY` or `AGENT_GATEWAY_OPENAI_API_KEY_FILE`, not both. After startup, `/readyz` should include `openai-compatible` in `providers`.

## Deployment Secret Mounts

For `make deployment-smoke`, bootstrap ignored local files and let the helper scripts source them:

```bash
make deployment-bootstrap-secrets
make deployment-smoke
```

| Local helper variable                      | Runtime effect                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE` | Mounted into the container as `AGENT_GATEWAY_API_KEYS_FILE`.                       |
| `DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE`   | Mounted into the container as `AGENT_GATEWAY_OPENAI_API_KEY_FILE`.                 |
| `AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN`   | Bearer token used by `deployment-request` and `deployment-smoke`.                  |
| `DEPLOYMENT_EXAMPLE_GATEWAY_PORT`          | Published local port for the container gateway.                                    |
| `DEPLOYMENT_EXAMPLE_WAIT_ATTEMPTS`         | Readiness retry count for helper scripts.                                          |
| `DEPLOYMENT_EXAMPLE_WAIT_SECONDS`          | Delay between readiness attempts.                                                  |
| `DEPLOYMENT_EXAMPLE_DIAGNOSE_LOG_TAIL`     | Number of recent gateway log lines printed by diagnostics.                         |
| `DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT`       | Docker Compose project name used by deployment helpers.                            |
| `DEPLOYMENT_EXAMPLE_GATEWAY_URL`           | Explicit gateway URL override when the helper should not derive it from the port.  |
| `DEPLOYMENT_EXAMPLE_PORTS`                 | Comma-separated local ports checked before startup.                                |
| `DEPLOYMENT_EXAMPLE_SECRET_FILES`          | Comma-separated secret paths checked for local readability and non-empty contents. |
| `DEPLOYMENT_EXAMPLE_ENV_FILE`              | Alternate local env file path when you do not want `.env.local`.                   |

If the gateway API key file changes, keep `AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN` aligned with one comma-separated token in that file. The smoke path uses `echo` for the request and mounts the OpenAI-compatible secret only to prove provider registration and secret loading.

## Guardrails

Use these variables to reject bad or unexpectedly expensive requests before provider execution:

| Variable                                | Rejects                                           |
| --------------------------------------- | ------------------------------------------------- |
| `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` | Provider/model pairs outside the allow list.      |
| `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES`  | Oversized JSON request bodies.                    |
| `AGENT_GATEWAY_MAX_INPUT_BYTES`         | Oversized parsed `input` strings.                 |
| `AGENT_GATEWAY_MAX_INPUT_TOKENS`        | Inputs above the configured local token estimate. |

All numeric guardrails must be strict base-10 positive integers. The request body limit and parsed input limit are separate controls, so large metadata can be rejected without changing the model input budget.

## Telemetry Export

Leave OTLP variables unset for local request proof. Set them only when you want the gateway to export traces or metrics:

| Variable                              | Effect                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `OTEL_SERVICE_NAME`                   | Service name in readiness output, traces, and metrics. Defaults to `agent-gateway`. |
| `OTEL_EXPORTER_OTLP_ENDPOINT`         | Base collector URL; the gateway appends `/v1/traces` and `/v1/metrics`.             |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`  | Exact trace endpoint; overrides the base endpoint for traces.                       |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Exact metric endpoint; overrides the base endpoint for metrics.                     |
| `OTEL_EXPORTER_OTLP_HEADERS`          | Shared comma-separated `key=value` headers.                                         |
| `OTEL_EXPORTER_OTLP_TRACES_HEADERS`   | Trace-specific headers that override shared keys.                                   |
| `OTEL_EXPORTER_OTLP_METRICS_HEADERS`  | Metric-specific headers that override shared keys.                                  |

Header values may be URL-encoded, such as `authorization=Bearer%20token`.

## Startup Validation Checklist

Before restarting a non-default environment, check:

- `AGENT_GATEWAY_API_KEYS` and `AGENT_GATEWAY_API_KEYS_FILE` are not both set.
- `AGENT_GATEWAY_OPENAI_API_KEY` and `AGENT_GATEWAY_OPENAI_API_KEY_FILE` are not both set.
- File-backed secrets point to readable, non-empty files.
- `AGENT_GATEWAY_DEFAULT_PROVIDER` is non-blank and registered in the running process.
- Concrete providers named in `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` are registered.
- `PORT`, guardrail limits, `AGENT_GATEWAY_OPENAI_TIMEOUT_MS`, and `AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS` are valid integers in their documented ranges.

Use `docs/common-failure-modes.md#startup-failures` when the process exits before listening, `make deployment-config` for resolved deployment helper values, and `make deployment-diagnose` for compose state, readiness, health, and logs.
