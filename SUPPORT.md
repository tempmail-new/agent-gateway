# Support

Agent Gateway is a portfolio repository, so support is intentionally routed through the existing operator and repository workflows instead of a staffed help desk.

## Usage And Setup Questions

Start with `docs/operator-journey-index.md` when you are not sure which guide fits your goal. The shortest usage paths are:

- `docs/first-request-quickstart.md` for the first authenticated local request.
- `docs/openai-compatible-provider-quickstart.md` for one explicit real provider request.
- `docs/deployment-smoke-quickstart.md` for the production-shaped container smoke path.
- `docs/guardrail-verification-quickstart.md` for schema, policy, request-size, input-size, and token-budget rejection proofs.
- `docs/observability-smoke-quickstart.md` for the local telemetry smoke path.
- `docs/common-failure-modes.md` when a request, deployment smoke, provider call, or telemetry run fails.

If those guides do not answer the question, open a GitHub issue with the command you ran, the expected result, the actual result, and any non-sensitive configuration needed to reproduce it.

## Bug Reports

Use a GitHub issue for reproducible bugs in the gateway runtime, documentation, deployment example, observability assets, or validation workflow. Include:

- affected commit, tag, or branch
- Node.js version, operating system, and Docker version when relevant
- the exact command or request shape that failed
- expected behavior and actual behavior
- sanitized logs or responses with bearer tokens, provider keys, mounted secret values, prompts, raw request payloads, and production data removed

Do not file suspected vulnerabilities as ordinary public bug reports. Use `SECURITY.md` instead.

## Pilot Planning

Use `docs/operator-acceptance-checklist.md` first to prove the repository is ready for a narrow pilot. Then record the pilot choices in `docs/pilot-configuration-template.md` and open `.github/ISSUE_TEMPLATE/pilot.yml` to track owner, scope, deployment path, success signal, rollback trigger, provider/model policy, guardrails, secrets, telemetry, and expected failure handling.

Run `docs/pilot-dry-run-runbook.md` before real pilot traffic.

## Security Disclosures

Report suspected vulnerabilities through `SECURITY.md`, preferably with GitHub private vulnerability reporting. Do not include exploit details, bearer tokens, provider keys, mounted secret values, prompts, raw request payloads, screenshots with secrets, or production logs in public issues or pull requests.
