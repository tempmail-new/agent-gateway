# Observability Operations Pack

This pack gives operators a first concrete path from the gateway's OTLP output to collector wiring, Prometheus-compatible dashboards, and alert response. It is intentionally small and tied to the metrics emitted by the service today.

## Assets

- `collector/otel-collector.yaml`: local OpenTelemetry Collector example that receives OTLP HTTP/gRPC, exports traces to the debug exporter, and exposes metrics for Prometheus scraping.
- `dashboards/grafana-agent-gateway.json`: Grafana dashboard import for HTTP volume/latency and provider volume/errors/latency.
- `alerts/prometheus-rules.yaml`: starter Prometheus alert rules for HTTP 5xx rate, provider error rate, and provider latency.
- `runbooks/gateway-observability.md`: operator runbook for triage and tuning.

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

## Local Smoke Test

Run the gateway and collector together, then scrape the Prometheus exporter:

```bash
docker run --rm -p 4317:4317 -p 4318:4318 -p 9464:9464 \
  -v "$PWD/docs/observability/collector/otel-collector.yaml:/etc/otelcol/config.yaml:ro" \
  otel/opentelemetry-collector-contrib:latest

OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npm run dev

curl -s http://localhost:9464/metrics | grep agent_gateway
```
