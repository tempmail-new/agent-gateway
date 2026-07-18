# Local Observability Demo

This demo starts the gateway with the shipped OpenTelemetry Collector, Prometheus alert rules, and Grafana dashboard provisioning. It is a local smoke path for the existing observability pack; it does not require live model-provider credentials.

## Start

```bash
docker compose -f compose.observability.yaml up --build
```

Open these local endpoints:

| Service                       | URL                                                       |
| ----------------------------- | --------------------------------------------------------- |
| Gateway readiness             | `http://localhost:8080/readyz`                            |
| Collector Prometheus exporter | `http://localhost:9464/metrics`                           |
| Prometheus                    | `http://localhost:9090`                                   |
| Grafana                       | `http://localhost:3000/d/agent-gateway-ops/agent-gateway` |

Grafana anonymous local access is enabled for the demo stack. The Prometheus datasource and Agent Gateway dashboard are provisioned automatically.

## Generate Traffic

In a second terminal:

```bash
docs/observability/local-demo/generate-traffic.sh
```

The script sends successful echo-provider requests plus authentication, policy, budget, and validation rejections so the HTTP dashboard panels have a useful local shape. Provider panels populate from the successful echo calls.

## Inspect

```bash
curl -s http://localhost:9464/metrics | grep agent_gateway
curl -s http://localhost:9090/api/v1/rules | grep AgentGateway
```

Prometheus loads the starter rules from `docs/observability/alerts/prometheus-rules.yaml`. They are traffic-gated and may stay inactive during a short smoke run; the purpose of the demo is to prove the scrape path, rule loading, and dashboard wiring.

## Stop

```bash
docker compose -f compose.observability.yaml down
```
