import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("common failure modes guide", () => {
  it("is linked from first-run entry points", () => {
    const docs = [readRepoFile("README.md"), readRepoFile("docs/first-request-quickstart.md")].join(
      "\n",
    );

    expect(docs).toContain("docs/common-failure-modes.md");
  });

  it("documents the gateway failure categories and operator checks", () => {
    const guide = readRepoFile("docs/common-failure-modes.md");

    for (const expected of [
      "curl -s http://localhost:8080/readyz",
      "missing_bearer_token",
      "invalid_bearer_token",
      "request_schema_invalid",
      "unknown_provider",
      "policy_rejected",
      "budget_exceeded",
      "request_body_too_large",
      "input_too_large",
      "provider_error",
      "provider_upstream_error",
      "provider_bad_response",
      "provider_timeout",
      "AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS",
      "AGENT_GATEWAY_MAX_INPUT_TOKENS",
      "make deployment-status",
      "make deployment-diagnose",
      "make observability-status",
      "make observability-inspect",
      "docs/observability/runbooks/gateway-observability.md",
    ]) {
      expect(guide).toContain(expected);
    }
  });
});
