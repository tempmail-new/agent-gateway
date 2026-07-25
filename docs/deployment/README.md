# Deployment Examples

These examples are small operator run paths for the existing gateway runtime. They are not full environment templates; copy the shape into your orchestrator and replace the example secret files before using it outside local smoke checks.

## Container Smoke Example

Run the production-shaped container example:

```bash
make deployment-smoke
```

The smoke script first runs `make deployment-preflight` checks through the shared preflight helper, then builds the gateway image, proves startup validation rejects an unavailable default provider, starts the service with Docker-mounted secret files and request-size guardrails, waits for `/readyz`, checks the container health status, sends one authenticated echo request, and tears the container down.

The compose file is `compose.deployment-example.yaml`. It keeps the container's internal port at `8080` and publishes it to local port `18080` so it can run separately from the observability demo.

For a manual operator run, use the lifecycle targets:

```bash
make deployment-bootstrap-secrets
make deployment-checklist
make deployment-preflight
make deployment-config
make deployment-up
make deployment-ready
make deployment-request
make deployment-diagnose
make deployment-logs
make deployment-down
make deployment-reset
```

`deployment-bootstrap-secrets` creates the ignored local env file and local secret files from the checked-in examples when they do not already exist. `deployment-checklist` confirms that the ignored local env file exists, the configured secret files are local/readable/non-empty, Docker and Docker Compose are reachable, Node.js is available for preflight checks, and the preferred manual command order is clear before startup. `deployment-preflight` verifies Docker, Docker Compose, compose-file validity, default deployment port `18080` availability, stale deployment containers, and that the mounted example secret files are readable and non-empty. `deployment-config` prints the resolved local env file, compose project, gateway URL, checked ports, and secret file paths/status without printing secret values. `deployment-up` runs the same preflight checks before starting the gateway with a build. `deployment-ready` waits for `/readyz` and the Docker healthcheck. `deployment-request` sends one authenticated echo request with the example token. `deployment-diagnose` prints resolved configuration, compose service state, gateway container health, `/readyz`, and recent gateway logs for a failed or manually inspected run. `deployment-logs` tails gateway logs, `deployment-down` removes the example stack, and `deployment-reset` removes ignored local setup files when you want the checked-in example back to a pristine local state.

The lifecycle targets use the same defaults as the smoke path. Run the bootstrap target when you need local overrides without editing tracked files:

```bash
make deployment-bootstrap-secrets
```

The helper creates `docs/deployment/container-example/.env.local`, `docs/deployment/container-example/secrets/gateway-api-keys.local`, and `docs/deployment/container-example/secrets/openai-api-key.local` from their tracked examples only when the files are missing. Existing local files are left untouched. Use the local env file to set `DEPLOYMENT_EXAMPLE_GATEWAY_PORT`, `DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE`, and `DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE`. The helper scripts source it before running Docker Compose, so `make deployment-checklist`, `make deployment-preflight`, `make deployment-up`, `make deployment-smoke`, and `make deployment-diagnose` all use the same port and secret-file paths. The local file and `*.local` secret files are ignored by Git. Run `make deployment-reset` after `make deployment-down` to remove `.env.local` and ignored `*.local` secret files created for local smoke checks; tracked `.example` files are preserved.

You can still override `DEPLOYMENT_EXAMPLE_ENV_FILE`, `DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT`, `DEPLOYMENT_EXAMPLE_GATEWAY_URL`, `DEPLOYMENT_EXAMPLE_PORTS`, `DEPLOYMENT_EXAMPLE_SECRET_FILES`, `AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN`, `DEPLOYMENT_EXAMPLE_WAIT_ATTEMPTS`, `DEPLOYMENT_EXAMPLE_WAIT_SECONDS`, or `DEPLOYMENT_EXAMPLE_DIAGNOSE_LOG_TAIL` from the shell when you need a different local env-file path, compose project, URL, token, or diagnostic log depth.

## Secret Mounts

The example uses Docker Compose secrets:

| Runtime variable                    | Mounted file path                           |
| ----------------------------------- | ------------------------------------------- |
| `AGENT_GATEWAY_API_KEYS_FILE`       | `/run/secrets/agent_gateway_api_keys`       |
| `AGENT_GATEWAY_OPENAI_API_KEY_FILE` | `/run/secrets/agent_gateway_openai_api_key` |

The checked-in files under `docs/deployment/container-example/secrets/` contain local example values only. For local customization, point `DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE` and `DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE` at untracked `*.local` files instead of editing the examples. Replace example values with real secret material in an actual deployment and keep inline `AGENT_GATEWAY_API_KEYS` or `AGENT_GATEWAY_OPENAI_API_KEY` unset when the matching `*_FILE` variable is used. `AGENT_GATEWAY_API_KEYS` file contents can use comma-separated tokens, but blank entries fail startup.

The OpenAI-compatible secret is mounted to prove provider secret loading and provider registration without sending live provider traffic. The smoke request uses the local `echo` provider through `AGENT_GATEWAY_DEFAULT_PROVIDER=echo`.

The example also sets `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES=8192`, `AGENT_GATEWAY_MAX_INPUT_BYTES=4096`, and `AGENT_GATEWAY_MAX_INPUT_TOKENS=32` to show body-size, input-size, and model-cost guardrails as separate deployment controls. Tune these values for expected prompt and metadata shape before using the example outside local smoke checks.

## Readiness

The image healthcheck probes `/readyz` on the configured `PORT`. The endpoint returns the resolved default provider and registered providers:

```bash
curl -s http://localhost:18080/readyz
```

Expected shape:

```json
{
  "defaultProvider": "echo",
  "providers": ["echo", "openai-compatible"],
  "service": "agent-gateway-deployment-example",
  "status": "ready"
}
```

Startup fails before listening if `AGENT_GATEWAY_DEFAULT_PROVIDER` names an unregistered provider, or if `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` references a concrete provider that is not registered in the running process. The smoke script exercises the default-provider failure path before starting the healthy container.
