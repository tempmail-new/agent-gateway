import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("bug issue template", () => {
  it("is linked from the README support path and support router", () => {
    const readme = readRepoFile("README.md");
    const support = readRepoFile("SUPPORT.md");

    expect(readme).toContain(".github/ISSUE_TEMPLATE/bug.yml");
    expect(support).toContain(".github/ISSUE_TEMPLATE/bug.yml");
    expect(support).toContain(
      "gateway runtime, documentation, deployment example, observability assets, or validation workflow",
    );
  });

  it("captures reproducible bug context without public secret disclosure", () => {
    const issueTemplate = readRepoFile(".github/ISSUE_TEMPLATE/bug.yml");

    for (const expected of [
      "name: Bug report",
      "SUPPORT.md",
      "label: Affected commit, tag, or branch",
      "label: Affected area",
      "Gateway runtime",
      "Documentation",
      "Deployment example",
      "Observability assets",
      "Validation workflow",
      "label: Environment",
      "Node.js version",
      "Docker version",
      "local, provider, deployment, guardrail, or telemetry path",
      "label: Reproduction steps",
      "exact command, request shape, or guide step",
      "label: Expected behavior",
      "label: Actual behavior",
      "label: Sanitized logs or responses",
      "bearer tokens, provider keys, mounted secret values, prompts, raw request payloads, screenshots with secrets, and production data",
      "This is not a suspected vulnerability",
      "SECURITY.md",
    ]) {
      expect(issueTemplate).toContain(expected);
    }
  });
});
