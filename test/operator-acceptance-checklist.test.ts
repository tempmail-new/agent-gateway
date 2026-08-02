import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("operator acceptance checklist", () => {
  it("is linked from the README operator paths", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("docs/operator-acceptance-checklist.md");
    expect(readme).toContain("Run the operator acceptance checklist");
  });

  it("ties the existing pilot proof points to their run paths and diagnostics", () => {
    const checklist = readRepoFile("docs/operator-acceptance-checklist.md");

    for (const expected of [
      "docs/first-request-quickstart.md",
      'status: "ready"',
      'provider: "echo"',
      'model: "local-test"',
      "docs/openai-compatible-provider-quickstart.md",
      'provider: "openai-compatible"',
      "make deployment-bootstrap-secrets",
      "make deployment-smoke",
      "make deployment-status",
      "make deployment-diagnose",
      "docs/guardrail-verification-quickstart.md",
      "invalid_request",
      "policy_rejected",
      "request_body_too_large",
      "budget_exceeded",
      "make observability-smoke",
      "make observability-status",
      "make observability-inspect",
      "docs/observability/runbooks/gateway-observability.md",
      "make validate",
      "docs/operator-env-reference.md",
      "docs/architecture.md",
    ]) {
      expect(checklist).toContain(expected);
    }
  });
});
