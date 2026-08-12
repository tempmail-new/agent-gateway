# Deployment Smoke Quickstart

Use this path when the local `echo` request works and you want the shortest production-shaped container check. It builds the image, mounts file-backed secrets, waits for `/readyz` and the Docker healthcheck, sends one authenticated `echo` request, proves one bad startup configuration fails early, and cleans up the container.

## Prerequisites

- Docker Engine or Docker Desktop is running.
- Docker Compose plugin is available as `docker compose`.
- Node.js 22.12.0 or newer is available for the deployment preflight checks.

## Run The Smoke

From a fresh clone:

```bash
git clone https://github.com/tempmail-new/agent-gateway.git
cd agent-gateway
make deployment-bootstrap-secrets
make deployment-smoke
```

`make deployment-bootstrap-secrets` creates ignored local files only when they are missing:

- `docs/deployment/container-example/.env.local`
- `docs/deployment/container-example/secrets/gateway-api-keys.local`
- `docs/deployment/container-example/secrets/openai-api-key.local`

The smoke path defaults to `http://localhost:18080`, uses `AGENT_GATEWAY_DEFAULT_PROVIDER=echo`, authenticates with `AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN`, and leaves tracked `.example` files untouched.

## Expected Proof

A successful run shows the container path is wired end to end:

- deployment preflight passed
- `/readyz` returns `status: "ready"`
- Docker reports the gateway container as healthy
- `POST /v1/requests` returns `provider: "echo"` and `model: "local-test"`
- unavailable default-provider startup validation fails before the healthy run starts

## First Failed-Run Checks

If the smoke run fails after the stack starts, keep the container state available and run:

```bash
make deployment-status
make deployment-diagnose
```

`make deployment-status` prints compose state, `/readyz`, and container health without logs. `make deployment-diagnose` adds resolved configuration, recent gateway logs, and the same readiness and health surfaces.

If preflight fails before Docker starts the container, fix the specific preflight message first. Common first fixes are starting Docker, freeing port `18080`, running `make deployment-down` for stale containers, or rerunning `make deployment-bootstrap-secrets` if local secret files are missing.

Use `docs/deployment/README.md` for the full manual lifecycle and `docs/common-failure-modes.md#deployment-smoke-failures` when the response points to auth, readiness, startup, or provider registration drift.
