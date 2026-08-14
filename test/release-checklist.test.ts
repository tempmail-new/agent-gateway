import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("release checklist", () => {
  it("is linked from the README and contributor guide", () => {
    const readme = readRepoFile("README.md");
    const contributing = readRepoFile("CONTRIBUTING.md");

    for (const expected of [
      "docs/release-checklist.md",
      "validation, versioning, release-note, and tag-cut expectations",
      "semantic versioning expectations",
      "minimal `main` tag flow",
    ]) {
      expect(readme).toContain(expected);
    }

    for (const expected of [
      "## Release Hygiene",
      "docs/release-checklist.md",
      "semantic versioning policy",
      "release-note expectations",
      "validation order",
      "minimal `main` tag flow",
    ]) {
      expect(contributing).toContain(expected);
    }
  });

  it("documents versioning, notes, validation, and tag flow", () => {
    const checklist = readRepoFile("docs/release-checklist.md");

    for (const expected of [
      "# Release Checklist",
      "Use semantic versions with `v`-prefixed git tags",
      "Patch",
      "Minor",
      "Major",
      "package.json",
      "package-lock.json",
      "Every GitHub release note should include",
      "Validation evidence from the release candidate",
      "npm ci",
      "npm run fmt",
      "npm run lint",
      "npm test",
      "npm run build",
      "make validate",
      "git diff --check",
      "make deployment-smoke",
      "make observability-smoke",
      "git fetch origin",
      "git pull --ff-only origin main",
      "git tag -a v0.1.1",
      "git push origin v0.1.1",
    ]) {
      expect(checklist).toContain(expected);
    }
  });
});
