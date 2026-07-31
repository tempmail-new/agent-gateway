import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("first request quickstart", () => {
  it("is linked from the README operator paths", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("docs/first-request-quickstart.md");
    expect(readme).toContain("Make the first authenticated local request");
  });

  it("documents the install, readiness, request, and auth diagnosis surfaces", () => {
    const quickstart = readRepoFile("docs/first-request-quickstart.md");

    for (const expected of [
      "npm install",
      "git clone https://github.com/tempmail-new/agent-gateway.git",
      "cd agent-gateway",
      "npm run dev",
      "curl -s http://localhost:8080/readyz",
      "http://localhost:8080/v1/requests",
      "authorization: Bearer dev-token",
      'provider: "echo"',
      "missing_bearer_token",
      "make validate",
      "make deployment-smoke",
      "make observability-smoke",
    ]) {
      expect(quickstart).toContain(expected);
    }
  });
});
