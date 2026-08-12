# Contributing

Agent Gateway is intentionally narrow: one authenticated request intake service, one clear provider boundary, and operator paths that are easy to verify. Keep contributions small enough that a reviewer can connect the code, docs, and tests in one pass.

## Local Setup

Use Node.js `22.12.0` or newer.

```bash
npm ci
npm run dev
```

The local development server uses `AGENT_GATEWAY_API_KEYS=dev-token` by default outside production. Keep real provider keys and local override files out of git; use `docs/operator-env-reference.md` and the ignored `.local` files created by the deployment helpers when you need secrets.

## Before Opening A PR

Run the same checks that CI runs:

```bash
npm run fmt
npm run lint
npm test
npm run build
make validate
```

Use `npm run fmt` before other validation so formatting noise does not hide behavioral changes. `make validate` runs format check, lint, tests, and build in the repository order used for release hygiene.

## Docs And Tests

Update documentation when a change affects setup, configuration, request behavior, deployment, observability, or operator troubleshooting. If the README or an operator guide promises a command, response code, environment variable, or file path, add or update a deterministic Vitest docs test under `test/` so the promise stays covered.

Good starting points:

- `docs/first-request-quickstart.md` for local request intake.
- `docs/openai-compatible-provider-quickstart.md` for one real provider request.
- `docs/deployment-smoke-quickstart.md` for the container smoke path.
- `docs/observability-smoke-quickstart.md` for telemetry export.
- `docs/operator-journey-index.md` when you need the right guide by goal.
- `docs/common-failure-modes.md` when documenting failure handling.

## Runtime Changes

Prefer explicit boundaries over hidden behavior. Keep provider-specific code behind the provider interface, validate request and configuration inputs before provider execution, and do not log prompts, bearer tokens, provider keys, or mounted secret values. New runtime behavior should include focused tests for the successful path and the fastest expected failure path.

## Pull Request Shape

Keep PRs scoped to one outcome and use a truthful Conventional Commit subject. In the PR description, include what changed, how you validated it, and any operator-facing docs that moved with the change.

## Dependency Maintenance

Dependabot checks npm dependencies and GitHub Actions weekly through `.github/dependabot.yml`. Review grouped production, development, and workflow update pull requests with the same validation order as other changes: format, lint, tests, build, and `make validate`.

TypeScript 7 is installed through the `@typescript/native` npm alias so `npm run build` uses the native `tsc` compiler. The `typescript` dependency stays aliased to `@typescript/typescript6` because `typescript-eslint` still needs the TypeScript 6 programmatic API for linting.
