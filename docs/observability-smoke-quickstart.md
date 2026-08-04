# Observability Smoke Quickstart

Use this path when the local `echo` request works and you want the shortest proof that gateway telemetry reaches the shipped collector, Prometheus rules, and Grafana dashboard. It starts the local observability stack, generates representative traffic, verifies the telemetry surfaces, and tears the stack down.

## Prerequisites

- Docker Engine or Docker Desktop is running.
- Docker Compose plugin is available as `docker compose`.
- Node.js `22` or newer is available for local helper checks.

No live model-provider credentials are required. The smoke path uses the local `echo` provider.

## Run The Smoke

From a fresh clone:

```bash
git clone https://github.com/tempmail-new/agent-gateway.git
cd agent-gateway
make observability-smoke
```

The helper runs `make observability-preflight`, starts the gateway, OpenTelemetry Collector, Prometheus, and Grafana through `compose.observability.yaml`, waits for readiness, sends representative success and rejection traffic, waits for gateway metrics to reach the collector, verifies Prometheus rules and targets, confirms Grafana dashboard provisioning, and then runs cleanup.

The default local endpoints are:

| Surface                       | URL                                                       |
| ----------------------------- | --------------------------------------------------------- |
| Gateway readiness             | `http://localhost:8080/readyz`                            |
| Collector Prometheus exporter | `http://localhost:9464/metrics`                           |
| Prometheus                    | `http://localhost:9090`                                   |
| Grafana dashboard             | `http://localhost:3000/d/agent-gateway-ops/agent-gateway` |

## Expected Proof

A successful run shows the local telemetry path is wired end to end:

- `/readyz` returns `status: "ready"` for the gateway
- collector metrics contain `agent_gateway` series
- Prometheus loads `AgentGatewayElevatedHttp5xxRate`, `AgentGatewayProviderErrorRate`, and `AgentGatewayProviderP95LatencyHigh`
- Prometheus targets are healthy for the collector scrape
- Grafana health succeeds and the `agent-gateway-ops` dashboard is provisioned
- the smoke helper tears the compose stack down before exiting

## First Failed-Run Checks

If the smoke run fails, first run the compact status helper:

```bash
make observability-status
```

It prints compose state, gateway readiness, collector metric presence, Prometheus readiness, Grafana health, and dashboard availability without streaming logs.

When status output is not enough, run the full inspection helper:

```bash
make observability-inspect
```

It runs every local gateway, collector, Prometheus, and Grafana wiring check before returning failure so multiple broken surfaces are visible together.

If preflight fails before the stack starts, fix the specific preflight message first. Common first fixes are starting Docker, installing the Docker Compose plugin, freeing default ports `3000`, `4317`, `4318`, `8080`, `9090`, or `9464`, or running `make observability-down` to remove stale demo containers.

Use `docs/observability/runbooks/gateway-observability.md` when the smoke passes but a real environment shows missing metrics, elevated HTTP errors, provider failures, or slow provider calls. Use `docs/common-failure-modes.md#observability-checks` when you need the broader request, readiness, deployment, and observability failure map.
