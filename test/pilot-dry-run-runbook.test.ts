import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("pilot dry run runbook", () => {
  it("is linked from the README, pilot template, and pilot issue form", () => {
    const readme = readRepoFile("README.md");
    const pilotTemplate = readRepoFile("docs/pilot-configuration-template.md");
    const issueTemplate = readRepoFile(".github/ISSUE_TEMPLATE/pilot.yml");

    expect(readme).toContain("docs/pilot-dry-run-runbook.md");
    expect(readme).toContain("Rehearse a narrow pilot before traffic");
    expect(pilotTemplate).toContain("docs/pilot-dry-run-runbook.md");
    expect(issueTemplate).toContain("docs/pilot-dry-run-runbook.md");
  });

  it("covers required dry-run proof points and stop conditions", () => {
    const runbook = readRepoFile("docs/pilot-dry-run-runbook.md");

    for (const expected of [
      ".github/ISSUE_TEMPLATE/pilot.yml",
      "docs/pilot-configuration-template.md",
      "AGENT_GATEWAY_DEFAULT_PROVIDER",
      "AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS",
      "AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES",
      "AGENT_GATEWAY_MAX_INPUT_BYTES",
      "AGENT_GATEWAY_MAX_INPUT_TOKENS",
      "OTEL_SERVICE_NAME",
      "make validate",
      "docs/first-request-quickstart.md",
      "docs/openai-compatible-provider-quickstart.md",
      "make deployment-smoke",
      "docs/guardrail-verification-quickstart.md",
      "make observability-smoke",
      "invalid_request",
      "policy_rejected",
      "request_body_too_large",
      "input_too_large",
      "budget_exceeded",
      "provider_error",
      "Decision: proceed / adjust / stop",
      "docs/common-failure-modes.md",
    ]) {
      expect(runbook).toContain(expected);
    }
  });
});
