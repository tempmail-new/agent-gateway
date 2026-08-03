import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("pilot configuration template", () => {
  it("is linked from the README operator paths and acceptance checklist", () => {
    const readme = readRepoFile("README.md");
    const checklist = readRepoFile("docs/operator-acceptance-checklist.md");

    expect(readme).toContain("docs/pilot-configuration-template.md");
    expect(readme).toContain("Record narrow pilot configuration choices");
    expect(checklist).toContain("docs/pilot-configuration-template.md");
  });

  it("captures the required pilot decision areas", () => {
    const template = readRepoFile("docs/pilot-configuration-template.md");

    for (const expected of [
      "AGENT_GATEWAY_DEFAULT_PROVIDER",
      "AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS",
      "AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES",
      "AGENT_GATEWAY_MAX_INPUT_BYTES",
      "AGENT_GATEWAY_MAX_INPUT_TOKENS",
      "AGENT_GATEWAY_API_KEYS_FILE",
      "AGENT_GATEWAY_OPENAI_API_KEY_FILE",
      "AGENT_GATEWAY_OPENAI_BASE_URL",
      "AGENT_GATEWAY_OPENAI_TIMEOUT_MS",
      "AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS",
      "OTEL_SERVICE_NAME",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
      "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
      "invalid_request",
      "policy_rejected",
      "request_body_too_large",
      "input_too_large",
      "budget_exceeded",
      "provider_error",
      "docs/common-failure-modes.md#provider-errors",
      "make deployment-status",
      "make deployment-diagnose",
      "make observability-status",
      "make observability-inspect",
      "docs/operator-env-reference.md",
      "docs/operator-acceptance-checklist.md",
      "docs/guardrail-verification-quickstart.md",
    ]) {
      expect(template).toContain(expected);
    }
  });
});
