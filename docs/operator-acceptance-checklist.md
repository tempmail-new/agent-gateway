# Operator Acceptance Checklist

Use this checklist when a small team is deciding whether the gateway is ready for a pilot. It keeps the evaluation to the proof points that exist in this repository today: local request intake, one real provider path, deployment smoke, guardrail rejection, observability, and repository hygiene. If you are still choosing the right operator guide, start with `docs/operator-journey-index.md`.

## Prerequisites

- Node.js `22.12.0` or newer.
- `curl`.
- Docker and Docker Compose for the deployment and observability smoke paths.
- A provider API key only for the `openai-compatible` provider check.

## Acceptance Proofs

| Proof point                                          | Run                                                              | Pass signal                                                                                                                                          | Follow-up if it fails                                                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Local authenticated request intake                   | `docs/first-request-quickstart.md`                               | `/readyz` returns `status: "ready"` and `POST /v1/requests` returns `provider: "echo"` for `model: "local-test"`.                                    | `docs/common-failure-modes.md#readiness-failures` or `docs/common-failure-modes.md#request-failures`.                        |
| Real outbound provider registration and routing      | `docs/openai-compatible-provider-quickstart.md`                  | `/readyz` includes `openai-compatible`, and an explicit `provider: "openai-compatible"` request returns a non-empty `output`.                        | `docs/common-failure-modes.md#provider-errors`.                                                                              |
| Production-shaped container boot and secret mounting | `make deployment-bootstrap-secrets` then `make deployment-smoke` | The smoke builds the image, mounts file-backed secrets, checks `/readyz`, verifies the Docker healthcheck, and sends one authenticated echo request. | `make deployment-status`, then `make deployment-diagnose`, then `docs/common-failure-modes.md#deployment-smoke-failures`.    |
| Local guardrail rejection before provider execution  | `docs/guardrail-verification-quickstart.md`                      | Schema, policy, request-size, and budget checks return `invalid_request`, `policy_rejected`, `request_body_too_large`, and `budget_exceeded`.        | `docs/operator-env-reference.md#guardrails` and `docs/common-failure-modes.md#request-failures`.                             |
| Telemetry wiring from gateway to dashboard           | `make observability-smoke`                                       | The stack exports gateway metrics, Prometheus rules load, targets are healthy, and the Grafana dashboard is provisioned.                             | `make observability-status`, then `make observability-inspect`, then `docs/observability/runbooks/gateway-observability.md`. |
| Repository hygiene before changes                    | `make validate`                                                  | Formatting, linting, tests, and build all pass from a clean checkout.                                                                                | Fix the first failing validation step before changing runtime behavior.                                                      |

## Minimum Pilot Decision

The gateway is ready for a narrow pilot when the first-request path, one provider path, one deployment smoke, one guardrail rejection run, one observability smoke, and `make validate` all pass in the target developer environment.

Before moving beyond a pilot, record the chosen provider models, request-size and input-token limits, telemetry backend, secret-mounting approach, and expected failure response handling in `docs/pilot-configuration-template.md`. Use `docs/operator-env-reference.md` for the runtime variables and `docs/architecture.md` for the provider-boundary shape.
