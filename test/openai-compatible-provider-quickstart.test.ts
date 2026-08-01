import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("OpenAI-compatible provider quickstart", () => {
  it("is linked from the operator entry points", () => {
    const docs = [readRepoFile("README.md"), readRepoFile("docs/first-request-quickstart.md")].join(
      "\n",
    );

    expect(docs).toContain("docs/openai-compatible-provider-quickstart.md");
    expect(docs).toContain("Make the first real provider request");
  });

  it("documents provider setup, readiness, request routing, and diagnosis", () => {
    const guide = readRepoFile("docs/openai-compatible-provider-quickstart.md");

    for (const expected of [
      "AGENT_GATEWAY_OPENAI_API_KEY",
      "AGENT_GATEWAY_OPENAI_API_KEY_FILE",
      "AGENT_GATEWAY_OPENAI_BASE_URL",
      "AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS='openai-compatible:gpt-4o-mini'",
      "curl -s http://localhost:8080/readyz",
      '"providers": ["echo", "openai-compatible"]',
      "http://localhost:8080/v1/requests",
      "authorization: Bearer dev-token",
      '"provider": "openai-compatible"',
      '"model": "gpt-4o-mini"',
      "provider_error",
      "provider_upstream_error",
      "details.upstreamStatus",
      "provider_timeout",
      "provider_bad_response",
      "docs/common-failure-modes.md#provider-errors",
    ]) {
      expect(guide).toContain(expected);
    }
  });
});
