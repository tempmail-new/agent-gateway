import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("support surface", () => {
  it("is linked from the README as the repository support router", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("## Support");
    expect(readme).toContain("SUPPORT.md");
    expect(readme).toContain("usage questions");
    expect(readme).toContain("reproducible bugs");
    expect(readme).toContain("narrow pilot planning");
    expect(readme).toContain("security disclosures");
  });

  it("routes usage questions to the shortest existing operator paths", () => {
    const support = readRepoFile("SUPPORT.md");

    for (const expected of [
      "docs/operator-journey-index.md",
      "docs/first-request-quickstart.md",
      "docs/openai-compatible-provider-quickstart.md",
      "docs/deployment-smoke-quickstart.md",
      "docs/guardrail-verification-quickstart.md",
      "docs/observability-smoke-quickstart.md",
      "docs/common-failure-modes.md",
    ]) {
      expect(support).toContain(expected);
    }
  });

  it("separates bugs, pilot planning, and security disclosures", () => {
    const support = readRepoFile("SUPPORT.md");

    for (const expected of [
      "affected commit, tag, or branch",
      "sanitized logs or responses",
      "Do not file suspected vulnerabilities as ordinary public bug reports",
      "docs/operator-acceptance-checklist.md",
      "docs/pilot-configuration-template.md",
      ".github/ISSUE_TEMPLATE/pilot.yml",
      "docs/pilot-dry-run-runbook.md",
      "Report suspected vulnerabilities through `SECURITY.md`",
      "GitHub private vulnerability reporting",
    ]) {
      expect(support).toContain(expected);
    }
  });
});
