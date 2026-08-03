# Pilot Dry Run Runbook

Use this runbook after a narrow pilot issue is opened from `.github/ISSUE_TEMPLATE/pilot.yml` and before the team sends real pilot traffic. It turns the recorded pilot decisions into one rehearsal with explicit pass, rollback, and evidence checks.

Keep the dry run small: one owner, one gateway version, one deployment path, one provider route, one expected-success request, and the failure responses the team already recorded in `docs/pilot-configuration-template.md`.

## Inputs

Start only when these inputs are present in the pilot issue:

- Owner and review date.
- Workflow or tenant allowed into the pilot.
- Gateway commit or version to run.
- Deployment path: local first request, OpenAI-compatible provider quickstart, deployment smoke example, or team-owned deployment.
- Success signal and rollback trigger.
- `AGENT_GATEWAY_DEFAULT_PROVIDER` and `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS`.
- Request body, parsed input, and input-token limits: `AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES`, `AGENT_GATEWAY_MAX_INPUT_BYTES`, and `AGENT_GATEWAY_MAX_INPUT_TOKENS`.
- Gateway and provider secret sources.
- `OTEL_SERVICE_NAME` and OTLP trace or metric endpoint choices.
- Expected handling for `invalid_request`, `policy_rejected`, `request_body_too_large`, `input_too_large`, `budget_exceeded`, and `provider_error`.

## Dry Run Steps

| Step                                    | Run                                                                          | Pass signal                                                                                                  | Record in the pilot issue                                           |
| --------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Confirm the checked-out gateway version | `git rev-parse --short HEAD`                                                 | The commit matches the pilot issue or the issue is updated with the commit actually tested.                  | Commit SHA and branch or tag.                                       |
| Validate repository hygiene             | `make validate`                                                              | Formatting, linting, tests, and build pass before changing runtime settings.                                 | Validation command and result.                                      |
| Prove local request intake              | `docs/first-request-quickstart.md`                                           | `/readyz` is ready and an authenticated echo request returns `provider: "echo"`.                             | Readiness output shape and request status.                          |
| Prove the selected provider route       | `docs/openai-compatible-provider-quickstart.md` or the team-owned equivalent | `/readyz` lists the intended provider and one explicit request returns the expected response shape.          | Provider, model, status, and whether retries were enabled.          |
| Prove deployment startup                | `make deployment-smoke` or the team-owned deployment smoke                   | File-backed secrets load, `/readyz` shows the intended default provider, and the healthcheck passes.         | Deployment path, secret-source shape, and readiness URL.            |
| Prove expected guardrails               | `docs/guardrail-verification-quickstart.md`                                  | Schema, policy, request-size, and budget failures return the expected error codes before provider execution. | Error code, status, and first-check link for each expected failure. |
| Prove telemetry visibility              | `make observability-smoke` or the team's collector check                     | Gateway metrics reach the backend, targets are healthy, and the dashboard or equivalent query is visible.    | Service name, endpoint type, and metric proof.                      |
| Decide go/no-go                         | Compare results with the success signal and rollback trigger                 | The owner explicitly chooses proceed, adjust, or stop.                                                       | Decision, owner, timestamp, and next check date.                    |

Skip a repository-provided command only when the pilot uses a team-owned equivalent. Record the equivalent command or dashboard query so the next operator can repeat the dry run.

## Evidence Block

Copy this block into the pilot issue after the dry run:

```markdown
Dry run date:
Gateway commit:
Owner:
Deployment path:
Validation result:
Readiness result:
Provider/model tested:
Guardrail failures observed:
Telemetry proof:
Success signal status:
Rollback trigger status:
Decision: proceed / adjust / stop
Next review:
```

## Stop Conditions

Stop before real pilot traffic when any of these happen:

- `make validate` fails from the tested checkout.
- `/readyz` does not show the intended `defaultProvider`, `providers`, or `service`.
- The selected provider route is unavailable or returns an unexpected response shape.
- File-backed secrets are missing, empty, unreadable, or mixed with their inline secret variables.
- `AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS` blocks the intended provider/model or omits the local `echo:local-test` fallback when the team depends on it.
- Expected guardrail failures return different status or error codes than the pilot issue records.
- Telemetry cannot prove gateway request or provider metrics under the chosen `OTEL_SERVICE_NAME`.
- The rollback trigger is already true during rehearsal.

Use `docs/common-failure-modes.md` for request, provider, startup, deployment, and observability checks before changing pilot scope.
