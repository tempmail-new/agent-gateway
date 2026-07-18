# Observability Operations Pack

This pack gives operators a first concrete path from the gateway's OTLP output to collector wiring, Prometheus-compatible dashboards, and alert response. It is intentionally small and tied to the metrics emitted by the service today.

## Assets

- `collector/otel-collector.yaml`: local OpenTelemetry Collector example that receives OTLP HTTP/gRPC, exports traces to the debug exporter, and exposes metrics for Prometheus scraping.
- `dashboards/grafana-agent-gateway.json`: Grafana dashboard import for HTTP volume/latency and provider volume/errors/latency.
- `alerts/prometheus-rules.yaml`: starter Prometheus alert rules for HTTP 5xx rate, provider error rate, and provider latency, tuned with minimum traffic gates for low-volume services.
- `runbooks/gateway-observability.md`: operator runbook for triage and tuning.
- `local-demo/`: Docker Compose support, Prometheus scrape config, Grafana provisioning, and sample traffic for a local end-to-end smoke run.

## Gateway Configuration

Point the gateway at the collector:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
export OTEL_SERVICE_NAME=agent-gateway
```

The base endpoint configures both:

- `http://otel-collector:4318/v1/traces`
- `http://otel-collector:4318/v1/metrics`

Use `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` or `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` only when traces and metrics must go to different receivers.

## Metric Surface

The gateway currently emits these OpenTelemetry instruments:

| Instrument                           | Type      | Key attributes                                                                                       |
| ------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `agent_gateway.http.server.requests` | Counter   | `http.request.method`, `http.route`, `http.response.status_code`                                     |
| `agent_gateway.http.server.duration` | Histogram | `http.request.method`, `http.route`, `http.response.status_code`                                     |
| `agent_gateway.provider.calls`       | Counter   | `agent_gateway.provider.name`, `agent_gateway.provider.outcome`, `agent_gateway.provider.error_code` |
| `agent_gateway.provider.duration`    | Histogram | `agent_gateway.provider.name`, `agent_gateway.provider.outcome`, `agent_gateway.provider.error_code` |

When exported through the collector's Prometheus exporter, dots become underscores and counters/histograms receive backend-specific suffixes such as `_total` and `_bucket`.

## Local Demo

Run the gateway, collector, Prometheus, and Grafana together:

```bash
make observability-up
```

Generate sample traffic:

```bash
make observability-traffic
```

Then inspect:

- Gateway readiness: `http://localhost:8080/readyz`
- Raw metrics: `http://localhost:9464/metrics`
- Prometheus rules and targets: `http://localhost:9090`
- Grafana dashboard: `http://localhost:3000/d/agent-gateway-ops/agent-gateway`

Use `make observability-smoke` to start the stack, wait for readiness, generate traffic, and verify metric scrape output and Prometheus rule loading in one command. Stop the stack with `make observability-down`.

See `docs/observability/local-demo/README.md` for the full smoke workflow.

## Manual Collector Smoke Test

Run the gateway and collector together, then scrape the Prometheus exporter:

```bash
docker run --rm -p 4317:4317 -p 4318:4318 -p 9464:9464 \
  -v "$PWD/docs/observability/collector/otel-collector.yaml:/etc/otelcol/config.yaml:ro" \
  otel/opentelemetry-collector-contrib:latest

OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npm run dev

curl -s http://localhost:9464/metrics | grep agent_gateway
```

## Traffic Tuning Baseline

Use one normal operating window before tightening thresholds. For a local baseline, generate a mix of successful requests, authentication failures, and policy or budget rejections, then compare dashboard ratios with the raw metric scrape.

Starter alert gates now require enough samples before firing:

- HTTP 5xx ratio: at least 20 gateway requests in the rolling 10 minute window.
- Provider error ratio: at least 10 provider calls in the rolling 10 minute window.
- Provider p95 latency: sustained provider traffic above 0.05 calls per second before evaluating the 10 second p95 threshold.

Keep the gates close to observed traffic. Lower them only for very quiet deployments where missing a single failed request matters more than alert noise; raise them for busier deployments once baseline request volume is known.
