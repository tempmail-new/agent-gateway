import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("contributing guide", () => {
  it("is linked from the README development section", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("CONTRIBUTING.md");
    expect(readme).toContain("Contributor workflow");
  });

  it("documents setup and the required local validation commands", () => {
    const guide = readRepoFile("CONTRIBUTING.md");

    for (const expected of [
      "Node.js `22`",
      "npm ci",
      "npm run dev",
      "npm run fmt",
      "npm run lint",
      "npm test",
      "npm run build",
      "make validate",
    ]) {
      expect(guide).toContain(expected);
    }
  });

  it("keeps contributor expectations tied to operator docs, tests, and secret safety", () => {
    const guide = readRepoFile("CONTRIBUTING.md");

    for (const expected of [
      "docs/operator-env-reference.md",
      "docs/first-request-quickstart.md",
      "docs/openai-compatible-provider-quickstart.md",
      "docs/deployment-smoke-quickstart.md",
      "docs/observability-smoke-quickstart.md",
      "docs/operator-journey-index.md",
      "docs/common-failure-modes.md",
      "deterministic Vitest docs test",
      "do not log prompts, bearer tokens, provider keys, or mounted secret values",
      "Conventional Commit",
    ]) {
      expect(guide).toContain(expected);
    }
  });
});
