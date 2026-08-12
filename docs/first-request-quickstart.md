# First Request Quickstart

Use this path when you want the shortest local proof that the gateway clones, installs, starts, accepts an authenticated request, and exposes a readiness surface.

## Prerequisites

- Node.js `22.12.0` or newer.
- `curl`.

## 1. Clone

```bash
git clone https://github.com/tempmail-new/agent-gateway.git
cd agent-gateway
```

## 2. Install

```bash
npm install
```

## 3. Run The Gateway

Start the local server in one terminal:

```bash
npm run dev
```

The development default API token is `dev-token`, and the default provider is the local `echo` provider. No external model API key is needed for this first run.

## 4. Check Readiness

In a second terminal:

```bash
curl -s http://localhost:8080/readyz
```

Expected shape:

```json
{
  "defaultProvider": "echo",
  "providers": ["echo"],
  "service": "agent-gateway",
  "status": "ready"
}
```

## 5. Send One Authenticated Request

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

Expected shape:

```json
{
  "id": "req-1",
  "model": "local-test",
  "output": "{\"input\":\"Summarize the handoff\",\"metadata\":{\"tenant\":\"demo\"},\"model\":\"local-test\",\"requestId\":\"req-1\"}",
  "provider": "echo",
  "usage": {
    "inputTokens": 6
  }
}
```

The request id and duration vary per run. The important result is `provider: "echo"` with an `output` JSON string that mirrors the request payload.

## 6. Run One Basic Diagnosis

If an authenticated request fails, first confirm the gateway is reachable and then prove auth is the expected gate:

```bash
curl -s http://localhost:8080/readyz

curl -s -i http://localhost:8080/v1/requests \
  -H 'content-type: application/json' \
  -d '{
    "model": "local-test",
    "input": "This should be rejected"
  }'
```

The second command should return `401` with:

```json
{ "error": "missing_bearer_token" }
```

If `/readyz` fails, the process is not listening on `localhost:8080` or did not finish startup. If `/readyz` succeeds but the request returns `missing_bearer_token`, add `-H 'authorization: Bearer dev-token'` to the request.

## Next Paths

- Use `docs/operator-journey-index.md` when you want to choose the next guide by operator goal.
- Use `docs/openai-compatible-provider-quickstart.md` to move from the local `echo` proof to one real `openai-compatible` provider request.
- Use `docs/operator-env-reference.md` when you need to choose local, provider, deployment, guardrail, or telemetry environment variables.
- Use `docs/common-failure-modes.md` when a request, readiness check, deployment smoke, or observability smoke fails.
- Run `make validate` before changing code.
- Run `make deployment-smoke` to prove the production-shaped container path.
- Run `make observability-smoke` to prove telemetry export, Prometheus rules, and Grafana provisioning.
