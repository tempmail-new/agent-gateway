import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("API contract reference", () => {
  it("is linked from the README API and operator paths", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("docs/api-contract.md");
    expect(readme).toContain("request, response, error, and readiness semantics");
    expect(readme).toContain("Use `docs/api-contract.md` for the full request-body");
  });

  it("documents the gateway request shape, probes, success envelope, and normalized errors", () => {
    const contract = readRepoFile("docs/api-contract.md");

    for (const expected of [
      "GET /healthz",
      "GET /readyz",
      "POST /v1/requests",
      "authorization: Bearer <token>",
      "`input`",
      "`metadata`",
      "`model`",
      "`provider`",
      "`durationMs`",
      "`trace.requestId`",
      "`usage.inputTokens`",
      "missing_bearer_token",
      "invalid_bearer_token",
      "invalid_request",
      "request_schema_invalid",
      "unknown_provider",
      "policy_rejected",
      "provider_model_not_allowed",
      "budget_exceeded",
      "estimated_input_tokens_exceeded",
      "request_body_too_large",
      "request_body_bytes_exceeded",
      "input_too_large",
      "input_bytes_exceeded",
      "provider_error",
      "provider_upstream_error",
      "provider_bad_response",
      "provider_request_failed",
      "provider_timeout",
      "internal_error",
    ]) {
      expect(contract).toContain(expected);
    }
  });
});
