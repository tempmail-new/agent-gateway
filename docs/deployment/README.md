# Deployment Examples

These examples are small operator run paths for the existing gateway runtime. They are not full environment templates; copy the shape into your orchestrator and replace the example secret files before using it outside local smoke checks.

## Container Smoke Example

Run the production-shaped container example:

```bash
make deployment-smoke
```

The smoke script builds the gateway image, proves startup validation rejects an unavailable default provider, starts the service with Docker-mounted secret files, waits for `/readyz`, checks the container health status, sends one authenticated echo request, and tears the container down.

The compose file is `compose.deployment-example.yaml`. It keeps the container's internal port at `8080` and publishes it to local port `18080` so it can run separately from the observability demo.

For a manual operator run, use the lifecycle targets:

```bash
make deployment-up
make deployment-ready
make deployment-request
make deployment-logs
make deployment-down
```

`deployment-up` validates the compose file and starts the gateway with a build. `deployment-ready` waits for `/readyz` and the Docker healthcheck. `deployment-request` sends one authenticated echo request with the example token. `deployment-logs` tails gateway logs, and `deployment-down` removes the example stack.

The lifecycle targets use the same defaults as the smoke path. Override `DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT`, `DEPLOYMENT_EXAMPLE_GATEWAY_URL`, `AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN`, `DEPLOYMENT_EXAMPLE_WAIT_ATTEMPTS`, or `DEPLOYMENT_EXAMPLE_WAIT_SECONDS` when you need to run against a different local port or token.

## Secret Mounts

The example uses Docker Compose secrets:

| Runtime variable                    | Mounted file path                           |
| ----------------------------------- | ------------------------------------------- |
| `AGENT_GATEWAY_API_KEYS_FILE`       | `/run/secrets/agent_gateway_api_keys`       |
| `AGENT_GATEWAY_OPENAI_API_KEY_FILE` | `/run/secrets/agent_gateway_openai_api_key` |

The checked-in files under `docs/deployment/container-example/secrets/` contain local example values only. Replace them with real secret material in an actual deployment and keep inline `AGENT_GATEWAY_API_KEYS` or `AGENT_GATEWAY_OPENAI_API_KEY` unset when the matching `*_FILE` variable is used.

The OpenAI-compatible secret is mounted to prove provider secret loading and provider registration without sending live provider traffic. The smoke request uses the local `echo` provider through `AGENT_GATEWAY_DEFAULT_PROVIDER=echo`.

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

Startup fails before listening if `AGENT_GATEWAY_DEFAULT_PROVIDER` names an unregistered provider. The smoke script exercises that failure path before starting the healthy container.
