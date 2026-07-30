# Local Observability Demo

This demo starts the gateway with the shipped OpenTelemetry Collector, Prometheus alert rules, and Grafana dashboard provisioning. It is a local smoke path for the existing observability pack; it does not require live model-provider credentials.

## One-Command Smoke

```bash
make observability-smoke
```

The smoke wrapper starts the stack, waits for readiness, generates representative traffic, waits for the collector metric export, runs the inspection checks, and tears the stack down on exit. If any step fails, it prints compose status, readiness probes, Grafana health, and recent service logs before cleanup.

Before startup, the wrapper runs the local demo preflight to verify Docker, Docker Compose, the compose file, default ports `3000`, `4317`, `4318`, `8080`, `9090`, and `9464`, and any stale demo containers from earlier runs. Run it directly when troubleshooting local setup:

```bash
make observability-preflight
```

## Start

```bash
make observability-up
```

Open these local endpoints:

| Service                       | URL                                                       |
| ----------------------------- | --------------------------------------------------------- |
| Gateway readiness             | `http://localhost:8080/readyz`                            |
| Collector Prometheus exporter | `http://localhost:9464/metrics`                           |
| Prometheus                    | `http://localhost:9090`                                   |
| Grafana                       | `http://localhost:3000/d/agent-gateway-ops/agent-gateway` |

Grafana anonymous local access is enabled for the demo stack. The Prometheus datasource and Agent Gateway dashboard are provisioned automatically.

If Docker Compose cannot build or start the demo stack, this command prints compose service state and runs the same inspection checks as `make observability-inspect` before returning the Compose failure.

To wait for the gateway and Prometheus after a detached start:

```bash
make observability-ready
```

If the gateway or Prometheus does not become ready, this command prints compose service state and runs the same inspection checks as `make observability-inspect` before returning a failure.

## Generate Traffic

```bash
make observability-traffic
```

The script sends successful echo-provider requests plus authentication, policy, budget, and validation rejections so the HTTP dashboard panels have a useful local shape. Provider panels populate from the successful echo calls.

If traffic generation cannot reach the gateway or receives an unexpected status for one of the representative requests, this command prints compose service state and runs the same inspection checks as `make observability-inspect` before returning a failure.

## Inspect

```bash
make observability-inspect
```

The inspection script checks gateway readiness, collector metric output, Prometheus rule loading, Prometheus target health for the collector scrape, Grafana health, and Grafana dashboard provisioning. It runs every check before returning a failure so one command shows the full local wiring state instead of stopping at the first unavailable dependency. Prometheus loads the starter rules from `docs/observability/alerts/prometheus-rules.yaml`. They are traffic-gated and may stay inactive during a short smoke run; the purpose of the demo is to prove the scrape path, rule loading, and dashboard wiring.

Use `make observability-logs` to tail container logs while investigating startup or scrape issues. If Docker Compose cannot stream logs, the command prints compose service state and runs the same inspection checks as `make observability-inspect` before returning the original failure.

## Stop

```bash
make observability-down
```

If Docker Compose cannot tear the demo stack down cleanly, this command prints remaining compose service state, cleanup context with the compose project, compose file, and retry command, then runs the same inspection checks as `make observability-inspect` before returning the Compose failure.
