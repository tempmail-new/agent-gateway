# Security Policy

Agent Gateway is a portfolio service, but security reports are still welcome and should be handled away from public exploit threads when possible.

## Reporting a Vulnerability

Use GitHub private vulnerability reporting for this repository:

https://github.com/tempmail-new/agent-gateway/security/advisories/new

If private reporting is unavailable, open a GitHub issue with only a brief impact summary and ask for a private follow-up channel. Do not include proof-of-concept exploit details, bearer tokens, provider API keys, mounted secret values, prompts, raw request payloads, screenshots with secrets, or production logs in a public issue or pull request.

Include enough non-sensitive context to reproduce and triage the report:

- affected commit, tag, or branch
- relevant gateway configuration with secret values redacted
- impacted path, such as authentication, request validation, provider routing, file-backed secrets, Docker deployment assets, or observability export
- expected behavior, actual behavior, and the security impact
- minimal safe reproduction steps when they can be shared without exposing secrets or third-party systems

## Supported Scope

Security reports are in scope for the current `main` branch and the latest published repository content, including the TypeScript gateway runtime, provider boundary, request guardrails, authentication checks, file-backed secret handling, Docker deployment example, observability assets, CI, and repository documentation.

Out of scope: unsupported forks, private deployment environments, third-party provider outages, social engineering, denial-of-service testing against systems you do not own, and findings that require exposing real user secrets, prompts, or production data.

## Response Expectations

This is a solo-maintained portfolio repository, not a staffed commercial support channel. Reasonable expectations are:

- acknowledgment within 7 days
- initial triage within 14 days
- remediation plan, documentation correction, or out-of-scope explanation after triage
- coordinated public disclosure only after a fix or mitigation is available when the report is valid and sensitive

Urgent fixes will prioritize protecting gateway authentication, request isolation, provider credentials, mounted secret files, and telemetry paths from leaking sensitive data.
