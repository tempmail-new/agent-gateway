import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("operator environment reference", () => {
  it("is linked from the operator entry points", () => {
    const docs = [
      readRepoFile("README.md"),
      readRepoFile("docs/first-request-quickstart.md"),
      readRepoFile("docs/openai-compatible-provider-quickstart.md"),
      readRepoFile("docs/common-failure-modes.md"),
    ].join("\n");

    expect(docs).toContain("docs/operator-env-reference.md");
    expect(docs).toContain("Choose runtime environment variables");
  });

  it("documents local, provider, deployment, guardrail, and telemetry variables", () => {
    const guide = readRepoFile("docs/operator-env-reference.md");

    for (const expected of [
      "AGENT_GATEWAY_API_KEYS",
      "AGENT_GATEWAY_API_KEYS_FILE",
      "AGENT_GATEWAY_DEFAULT_PROVIDER",
      "NODE_ENV=production",
      "PORT",
      "AGENT_GATEWAY_OPENAI_API_KEY",
      "AGENT_GATEWAY_OPENAI_API_KEY_FILE",
      "AGENT_GATEWAY_OPENAI_BASE_URL",
      "AGENT_GATEWAY_OPENAI_TIMEOUT_MS",
      "AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS",
      "AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS",
      "AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES",
      "AGENT_GATEWAY_MAX_INPUT_BYTES",
      "AGENT_GATEWAY_MAX_INPUT_TOKENS",
      "DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE",
      "DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE",
      "AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN",
      "OTEL_SERVICE_NAME",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
      "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
      "OTEL_EXPORTER_OTLP_HEADERS",
      "OTEL_EXPORTER_OTLP_TRACES_HEADERS",
      "OTEL_EXPORTER_OTLP_METRICS_HEADERS",
      "docs/common-failure-modes.md#startup-failures",
      "make deployment-config",
      "make deployment-diagnose",
    ]) {
      expect(guide).toContain(expected);
    }
  });
});
