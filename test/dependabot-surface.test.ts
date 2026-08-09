import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("dependency maintenance surface", () => {
  it("configures Dependabot for npm and GitHub Actions", () => {
    const dependabot = readRepoFile(".github/dependabot.yml");

    for (const expected of [
      'package-ecosystem: "npm"',
      'package-ecosystem: "github-actions"',
      'directory: "/"',
      'interval: "weekly"',
      'timezone: "Asia/Ho_Chi_Minh"',
      "open-pull-requests-limit: 3",
    ]) {
      expect(dependabot).toContain(expected);
    }
  });

  it("groups dependency update pull requests by review intent", () => {
    const dependabot = readRepoFile(".github/dependabot.yml");

    for (const expected of [
      "npm-production:",
      'dependency-type: "production"',
      "npm-development:",
      'dependency-type: "development"',
      "github-actions:",
    ]) {
      expect(dependabot).toContain(expected);
    }
  });

  it("documents the maintenance surface for visitors and contributors", () => {
    const readme = readRepoFile("README.md");
    const contributing = readRepoFile("CONTRIBUTING.md");

    for (const expected of [
      "## Maintenance",
      "Dependabot is configured in `.github/dependabot.yml`",
      "npm dependencies and GitHub Actions weekly",
      "grouped production, development, and workflow update pull requests",
    ]) {
      expect(readme).toContain(expected);
    }

    for (const expected of [
      "## Dependency Maintenance",
      "Dependabot checks npm dependencies and GitHub Actions weekly",
      ".github/dependabot.yml",
      "format, lint, tests, build, and `make validate`",
    ]) {
      expect(contributing).toContain(expected);
    }
  });
});
