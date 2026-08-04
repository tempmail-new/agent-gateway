import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("operator journey index", () => {
  it("is linked from the README and relevant operator docs", () => {
    const readme = readRepoFile("README.md");
    const firstRequest = readRepoFile("docs/first-request-quickstart.md");
    const acceptanceChecklist = readRepoFile("docs/operator-acceptance-checklist.md");

    expect(readme).toContain("docs/operator-journey-index.md");
    expect(readme).toContain("Choose the right operator guide");
    expect(firstRequest).toContain("docs/operator-journey-index.md");
    expect(acceptanceChecklist).toContain("docs/operator-journey-index.md");
  });

  it("routes supported operator goals to existing shortest paths", () => {
    const index = readRepoFile("docs/operator-journey-index.md");

    for (const expected of [
      "Make the first authenticated local request",
      "docs/first-request-quickstart.md",
      "Make the first real provider request",
      "docs/openai-compatible-provider-quickstart.md",
      "Run the production-shaped deployment smoke",
      "docs/deployment-smoke-quickstart.md",
      "Prove local guardrail rejections",
      "docs/guardrail-verification-quickstart.md",
      "Inspect observability wiring",
      "docs/observability/README.md",
      "Check pilot readiness",
      "docs/operator-acceptance-checklist.md",
      "Record narrow pilot decisions",
      "docs/pilot-configuration-template.md",
      "Create a tracked pilot issue",
      ".github/ISSUE_TEMPLATE/pilot.yml",
      "Rehearse a narrow pilot before traffic",
      "docs/pilot-dry-run-runbook.md",
    ]) {
      expect(index).toContain(expected);
    }
  });

  it("keeps diagnostics and proof signals tied to documented surfaces", () => {
    const index = readRepoFile("docs/operator-journey-index.md");

    for (const expected of [
      'status: "ready"',
      'provider: "echo"',
      'provider: "openai-compatible"',
      "make deployment-bootstrap-secrets",
      "make deployment-smoke",
      "make deployment-status",
      "make deployment-diagnose",
      "invalid_request",
      "policy_rejected",
      "request_body_too_large",
      "budget_exceeded",
      "make observability-smoke",
      "make observability-status",
      "make observability-inspect",
      "make validate",
      "docs/common-failure-modes.md",
      "docs/operator-env-reference.md",
    ]) {
      expect(index).toContain(expected);
    }
  });
});
