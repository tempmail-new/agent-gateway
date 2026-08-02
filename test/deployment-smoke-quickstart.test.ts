import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("deployment smoke quickstart", () => {
  it("is linked from the deployment operator entry points", () => {
    const docs = [readRepoFile("README.md"), readRepoFile("docs/deployment/README.md")].join("\n");

    expect(docs).toContain("docs/deployment-smoke-quickstart.md");
    expect(docs).toContain("Run the first deployment smoke");
  });

  it("documents bootstrap, smoke, proof, and first failed-run checks", () => {
    const quickstart = readRepoFile("docs/deployment-smoke-quickstart.md");
    const failureGuide = readRepoFile("docs/common-failure-modes.md");

    for (const expected of [
      "git clone https://github.com/tempmail-new/agent-gateway.git",
      "cd agent-gateway",
      "make deployment-bootstrap-secrets",
      "make deployment-smoke",
      "docs/deployment/container-example/.env.local",
      "docs/deployment/container-example/secrets/gateway-api-keys.local",
      "docs/deployment/container-example/secrets/openai-api-key.local",
      "http://localhost:18080",
      "AGENT_GATEWAY_DEFAULT_PROVIDER=echo",
      "AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN",
      'status: "ready"',
      'provider: "echo"',
      'model: "local-test"',
      "make deployment-status",
      "make deployment-diagnose",
      "docs/common-failure-modes.md#deployment-smoke-failures",
    ]) {
      expect(quickstart).toContain(expected);
    }

    expect(failureGuide).toContain("## Deployment Smoke Failures");
    expect(failureGuide).toContain("make deployment-status");
    expect(failureGuide).toContain("make deployment-diagnose");
  });
});
