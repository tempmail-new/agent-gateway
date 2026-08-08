import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("security policy", () => {
  it("is linked from the README with public secret-handling expectations", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("## Security");
    expect(readme).toContain("SECURITY.md");
    expect(readme).toContain("do not disclose bearer tokens");
    expect(readme).toContain("provider keys");
    expect(readme).toContain("public issues or pull requests");
  });

  it("documents the vulnerability reporting path and safe report contents", () => {
    const policy = readRepoFile("SECURITY.md");

    for (const expected of [
      "https://github.com/tempmail-new/agent-gateway/security/advisories/new",
      "If private reporting is unavailable",
      "affected commit, tag, or branch",
      "gateway configuration with secret values redacted",
      "minimal safe reproduction steps",
    ]) {
      expect(policy).toContain(expected);
    }
  });

  it("keeps scope and response expectations clear for a solo-maintained repo", () => {
    const policy = readRepoFile("SECURITY.md");

    for (const expected of [
      "current `main` branch",
      "TypeScript gateway runtime",
      "provider boundary",
      "file-backed secret handling",
      "acknowledgment within 7 days",
      "initial triage within 14 days",
      "coordinated public disclosure only after a fix or mitigation is available",
    ]) {
      expect(policy).toContain(expected);
    }
  });
});
