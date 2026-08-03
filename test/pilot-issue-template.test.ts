import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("pilot issue template", () => {
  it("is linked from the README operator paths and pilot configuration guide", () => {
    const readme = readRepoFile("README.md");
    const pilotTemplate = readRepoFile("docs/pilot-configuration-template.md");

    expect(readme).toContain(".github/ISSUE_TEMPLATE/pilot.yml");
    expect(readme).toContain("Track a narrow pilot issue");
    expect(pilotTemplate).toContain(".github/ISSUE_TEMPLATE/pilot.yml");
  });

  it("captures the required GitHub-native pilot planning fields", () => {
    const issueTemplate = readRepoFile(".github/ISSUE_TEMPLATE/pilot.yml");

    for (const expected of [
      "name: Narrow pilot plan",
      "docs/operator-acceptance-checklist.md",
      "docs/pilot-configuration-template.md",
      "label: Pilot name",
      "label: Owner",
      "label: Tenant or workflow",
      "label: Review date",
      "label: Deployment path",
      "label: Success signal",
      "label: Rollback trigger",
      "label: Provider/model allow policy",
      "label: Request body, input, and token guardrails",
      "label: Gateway and provider secret sources",
      "label: Telemetry endpoint and service name",
      "label: Expected failure handling",
      "AGENT_GATEWAY_DEFAULT_PROVIDER",
      "AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS",
      "AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES",
      "AGENT_GATEWAY_MAX_INPUT_BYTES",
      "AGENT_GATEWAY_MAX_INPUT_TOKENS",
      "AGENT_GATEWAY_API_KEYS_FILE",
      "AGENT_GATEWAY_OPENAI_API_KEY_FILE",
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
      "make deployment-status",
      "make deployment-diagnose",
      "make observability-status",
      "make observability-inspect",
    ]) {
      expect(issueTemplate).toContain(expected);
    }
  });
});
