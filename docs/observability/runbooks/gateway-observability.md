# Gateway Observability Runbook

Use this runbook when the dashboard or alert rules show elevated gateway errors, provider failures, or slow provider calls.

## First Checks

1. Check `/readyz` on the affected instance and confirm the expected default provider is registered.
2. Confirm the gateway is exporting telemetry by checking the collector logs and Prometheus scrape target for the service.
3. Compare HTTP errors with provider errors to decide whether the failure is at the gateway boundary or the outbound provider boundary.
4. Inspect structured logs for `provider_call_failed` using `requestId`, `provider`, `model`, `attempt`, `retryCount`, `timeout`, and `errorCode`.

## Metrics To Use

| Question                       | Instrument                           | Prometheus-style query starting point                                                                                                                           |
| ------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is gateway traffic flowing?    | `agent_gateway.http.server.requests` | `sum(rate(agent_gateway_http_server_requests_total[5m]))`                                                                                                       |
| Are HTTP errors increasing?    | `agent_gateway.http.server.requests` | `sum(rate(agent_gateway_http_server_requests_total{http_response_status_code=~"5.."}[5m]))`                                                                     |
| Is gateway latency increasing? | `agent_gateway.http.server.duration` | `histogram_quantile(0.95, sum(rate(agent_gateway_http_server_duration_milliseconds_bucket[5m])) by (le, http_route))`                                           |
| Are provider calls failing?    | `agent_gateway.provider.calls`       | `sum(rate(agent_gateway_provider_calls_total{agent_gateway_provider_outcome="error"}[5m])) by (agent_gateway_provider_name, agent_gateway_provider_error_code)` |
| Are provider calls slow?       | `agent_gateway.provider.duration`    | `histogram_quantile(0.95, sum(rate(agent_gateway_provider_duration_milliseconds_bucket[5m])) by (le, agent_gateway_provider_name))`                             |
| Is the alert sample size real? | HTTP and provider counters           | `sum(increase(agent_gateway_http_server_requests_total[10m]))` and `sum(increase(agent_gateway_provider_calls_total[10m]))`                                     |

## Alert Response

### AgentGatewayElevatedHttp5xxRate

- Check whether 5xx responses correlate with `provider_call_failed` logs. If not, inspect gateway validation, auth, and startup logs.
- Confirm the process is ready through `/readyz`; a misconfigured default provider should fail startup rather than receive traffic.
- If traffic is concentrated on one route, isolate the route label before changing global thresholds.
- The starter rule waits for at least 20 requests in the rolling 10 minute window. For quiet deployments, decide whether single-request paging is expected before lowering this gate.

### AgentGatewayProviderErrorRate

- Group failures by `agent_gateway_provider_name` and `agent_gateway_provider_error_code`.
- For `timeout`, compare latency panels with `AGENT_GATEWAY_OPENAI_TIMEOUT_MS` and provider status pages.
- For upstream 429 or 5xx responses, confirm `AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS` is intentionally configured and not amplifying load during an outage.
- The starter rule waits for at least 10 provider calls in the rolling 10 minute window so sparse test traffic does not page as an incident.
- Do not add prompts, metadata, bearer tokens, or provider API keys to logs while debugging.

### AgentGatewayProviderP95LatencyHigh

- Compare provider p95 latency with HTTP p95 latency. If provider latency is high but HTTP latency is not, check for low traffic or scrape gaps.
- Break down by provider before changing timeout settings.
- If retries are enabled, inspect retry counts to determine whether high latency is from successful retries or slow first attempts.
- The starter rule requires sustained provider traffic above 0.05 calls per second. Lower this only if the deployment is intentionally low-volume and latency outliers still require immediate action.

## Tuning Notes

- The included thresholds are starter values for low-volume environments. Tune after observing baseline traffic for at least one normal operating period.
- Tune sample gates and percentages together. A stricter percentage on tiny traffic creates noise; a loose percentage on busy traffic hides real incidents.
- Keep error-code labels bounded. The gateway emits normalized provider error codes; avoid adding raw upstream messages as metric labels.
- Keep collector pipelines boring at first: batch processor, explicit exporters, and separate backend-specific enrichment only after the base signals are reliable.
