# Release Checklist

Use this checklist when cutting an Agent Gateway release from `main`. The service is intentionally narrow, so releases should make the validated request contract, operator paths, and dependency state easy to audit.

## Versioning

Use semantic versions with `v`-prefixed git tags, such as `v0.1.1`.

| Version change | Use when                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Patch          | Documentation fixes, dependency maintenance, CI updates, and compatible bug fixes that preserve the API shape. |
| Minor          | Backward-compatible runtime behavior, new optional configuration, new provider support, or new operator paths. |
| Major          | Breaking changes to `POST /v1/requests`, auth, error bodies, required configuration, deployment, or probes.    |

Keep `package.json` and `package-lock.json` aligned with the version that will be tagged. If a release only documents an unreleased process and does not cut a version, do not change package metadata.

## Release Notes

Every GitHub release note should include:

- The tag and commit SHA from `main`.
- User-facing changes grouped as runtime, operations, docs, and maintenance when those sections apply.
- Any request, response, error, configuration, deployment, observability, or Node.js compatibility changes.
- Validation evidence from the release candidate.
- Upgrade or rollback notes, even when the answer is "none".

Do not include bearer tokens, provider keys, mounted secret values, prompts, raw request payloads, or production logs in release notes.

## Validation Order

Run validation from a clean checkout of the release candidate:

```bash
npm ci
npm run fmt
npm run lint
npm test
npm run build
make validate
git diff --check
```

`npm run fmt` writes formatting changes. The later `make validate` run verifies the same format, lint, test, and build contract that CI enforces.

For releases that change deployment, observability, or provider behavior, also run the matching smoke path before tagging:

- `make deployment-smoke` for container, secret-mount, readiness, or deployment helper changes.
- `make observability-smoke` for telemetry, collector, Prometheus, Grafana, or local observability helper changes.
- `docs/openai-compatible-provider-quickstart.md` for real provider routing changes.
- `docs/guardrail-verification-quickstart.md` for policy, size, schema, or budget guardrail changes.

## Minimal Tag Flow

Cut tags only from validated `main`:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci
npm run fmt
npm run lint
npm test
npm run build
make validate
git diff --check
git tag -a v0.1.1 -m "agent-gateway v0.1.1"
git push origin v0.1.1
```

After pushing the tag, publish a GitHub release using the release-note expectations above. If validation changes files or the release needs a version bump, open a small release PR first, merge it to `main`, then restart this flow from the updated `origin/main`.
