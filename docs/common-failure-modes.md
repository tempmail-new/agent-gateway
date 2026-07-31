# Common Failure Modes

Use this page after the first request or a smoke run fails and you need the shortest path from the response to the right operator surface.

Start by checking readiness:

```bash
curl -s http://localhost:8080/readyz
```

Expected local development shape:

```json
{
  "defaultProvider": "echo",
  "providers": ["echo"],
  "service": "agent-gateway",
  "status": "ready"
}
```

If `/readyz` fails, the gateway is not listening on the URL you are calling, did not finish startup, or failed configuration validation before binding the port. In the container path, run `make deployment-status` for a compact state check or `make deployment-diagnose` for resolved config, readiness, healthcheck, and logs. In the local observability path, run `make observability-status` for a low-noise snapshot or `make observability-inspect` to run every gateway, collector, Prometheus, and Grafana check before returning failure.

## Request Failures

| Symptom                                                           | Likely cause                                                                                       | First check                                                                                                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `401` with `missing_bearer_token`                                 | The request is missing `authorization: Bearer <token>`.                                            | Add `-H 'authorization: Bearer dev-token'` for local development, or use the token configured for the deployment helper.                         |
| `401` with `invalid_bearer_token`                                 | The bearer token is present but does not match `AGENT_GATEWAY_API_KEYS`.                           | Confirm the local token is `dev-token`, or align `AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN` with the mounted gateway API keys file.                |
| `400` with `invalid_request` and `reason: request_schema_invalid` | The JSON body has missing, blank, or unknown top-level fields.                                     | Send only `input`, `metadata`, `model`, and optional `provider`; keep `input`, `model`, and `provider` non-blank strings.                        |
| `400` with `unknown_provider`                                     | The request names a provider that is not registered in the running process.                        | Check `/readyz` and use one of its `providers`. The `openai-compatible` provider is registered only when its API key or API key file is present. |
| `403` with `policy_rejected`                                      | `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` does not allow the resolved provider and requested model.  | Check the returned `provider`, `model`, and `reason`, then update the allow list with an explicit `provider:model` pair or intentional wildcard. |
| `402` with `budget_exceeded`                                      | `AGENT_GATEWAY_MAX_INPUT_TOKENS` is set and the local estimate is over the limit.                  | Shorten `input` or raise the configured token budget after checking expected prompt size.                                                        |
| `413` with `request_body_too_large`                               | `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES` rejected the full JSON body before the route handler.       | Reduce the whole payload, especially large metadata or encoded content, or raise the body limit.                                                 |
| `413` with `input_too_large`                                      | `AGENT_GATEWAY_MAX_INPUT_BYTES` rejected the parsed UTF-8 `input` field.                           | Shorten `input` or raise the input-byte limit separately from the body-size limit.                                                               |
| `502` or `504` with `provider_error`                              | The selected provider returned an upstream error, malformed response, request failure, or timeout. | Inspect the response `code` and provider details, then compare `provider_call_failed` logs and observability metrics.                            |

## Provider Errors

Provider failures are normalized as:

```json
{
  "error": "provider_error",
  "code": "provider_upstream_error",
  "provider": "openai-compatible"
}
```

Useful `code` values include `provider_upstream_error`, `provider_bad_response`, and `provider_timeout`. For OpenAI-compatible calls, `details.attemptCount` shows how many attempts were made, and `details.upstreamStatus` appears when an HTTP response was received from the upstream provider.

For transient upstream statuses, retries run only when `AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS` is greater than `1`. The retryable statuses are `408`, `409`, `425`, `429`, `500`, `502`, `503`, and `504`; malformed successful responses are not retried.

## Startup Failures

The gateway fails before listening when configuration is invalid. Common startup checks include:

- `AGENT_GATEWAY_API_KEYS` must be set in production.
- `AGENT_GATEWAY_API_KEYS` and `AGENT_GATEWAY_API_KEYS_FILE` cannot both be set.
- `AGENT_GATEWAY_OPENAI_API_KEY` and `AGENT_GATEWAY_OPENAI_API_KEY_FILE` cannot both be set.
- `AGENT_GATEWAY_DEFAULT_PROVIDER` must be non-blank and registered.
- `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` entries must use non-blank `provider:model` format.
- Concrete providers in `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` must be registered in the running process.
- Numeric limits such as `PORT`, `AGENT_GATEWAY_MAX_INPUT_TOKENS`, `AGENT_GATEWAY_MAX_INPUT_BYTES`, `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES`, `AGENT_GATEWAY_OPENAI_TIMEOUT_MS`, and `AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS` must be valid integers in their documented ranges.

For local deployment checks, `make deployment-up`, `make deployment-ready`, `make deployment-request`, `make deployment-logs`, and `make deployment-down` print targeted diagnostics when they fail. Use `make deployment-help` before manual runs to see the command map, resolved defaults, and override knobs.

## Observability Checks

When the gateway is running with the observability demo, use:

```bash
make observability-status
make observability-inspect
```

`make observability-status` prints compose state, gateway readiness, collector metric presence, Prometheus readiness, Grafana health, and dashboard availability without log noise. `make observability-inspect` runs the full local check set and is the better choice when a failure is unclear.

For metrics and alert triage, start with `docs/observability/runbooks/gateway-observability.md`. HTTP error rates show gateway-boundary failures such as auth, schema, policy, and budget rejections; provider error metrics and `provider_call_failed` logs explain upstream provider failures.
