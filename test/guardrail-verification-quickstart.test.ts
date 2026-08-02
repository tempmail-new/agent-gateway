import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("guardrail verification quickstart", () => {
  it("is linked from the README operator paths", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("docs/guardrail-verification-quickstart.md");
    expect(readme).toContain("Prove local guardrail rejections");
  });

  it("documents the local guardrail setup and rejection proof points", () => {
    const guide = readRepoFile("docs/guardrail-verification-quickstart.md");

    for (const expected of [
      "AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS='echo:local-test'",
      "AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES=120",
      "AGENT_GATEWAY_MAX_INPUT_TOKENS=1",
      "curl -s http://localhost:8080/readyz",
      "authorization: Bearer dev-token",
      "temperature",
      "invalid_request",
      "request_schema_invalid",
      "blocked-model",
      "policy_rejected",
      "provider_model_not_allowed",
      "node -e",
      "request_body_too_large",
      "request_body_bytes_exceeded",
      "budget_exceeded",
      "estimatedInputTokens",
      "estimated_input_tokens_exceeded",
      "AGENT_GATEWAY_MAX_INPUT_BYTES",
      "docs/common-failure-modes.md#request-failures",
      "docs/operator-env-reference.md#guardrails",
    ]) {
      expect(guide).toContain(expected);
    }
  });
});
