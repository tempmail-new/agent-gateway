import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("architecture and decisions README entry point", () => {
  it("links technical evaluators from the README to the architecture overview and first ADR", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("## Architecture And Decisions");
    expect(readme).toContain("docs/architecture.md");
    expect(readme).toContain("docs/adr/0001-provider-boundary.md");
  });

  it("keeps the linked docs focused on request flow, boundaries, and the provider-boundary decision", () => {
    const architecture = readRepoFile("docs/architecture.md");
    const providerBoundaryAdr = readRepoFile("docs/adr/0001-provider-boundary.md");

    for (const expected of ["## Request Flow", "## Boundaries", "## Current Tradeoffs"]) {
      expect(architecture).toContain(expected);
    }

    for (const expected of [
      "## Status",
      "Accepted",
      "provider interface, registry, and local `echo` provider",
      "Future adapters can implement `AgentProvider`",
    ]) {
      expect(providerBoundaryAdr).toContain(expected);
    }
  });
});
