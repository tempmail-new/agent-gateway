import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function publishedComposePorts(compose: string): string[] {
  return Array.from(compose.matchAll(/-\s+"(\d+):\d+"/g), (match) => match[1]).sort();
}

function preflightDefaultPorts(preflightScript: string): string[] {
  const match = preflightScript.match(/DEPLOYMENT_EXAMPLE_PORTS:-(?<ports>[^}]+)}/);

  expect(match?.groups?.ports).toBeDefined();

  return match?.groups?.ports.split(/\s+/).sort() ?? [];
}

describe("deployment example assets", () => {
  it("ships a compose example using mounted secret files and readiness health", () => {
    const compose = readRepoFile("compose.deployment-example.yaml");

    expect(compose).toContain("AGENT_GATEWAY_API_KEYS_FILE: /run/secrets/agent_gateway_api_keys");
    expect(compose).toContain(
      "AGENT_GATEWAY_OPENAI_API_KEY_FILE: /run/secrets/agent_gateway_openai_api_key",
    );
    expect(compose).toContain("AGENT_GATEWAY_DEFAULT_PROVIDER: echo");
    expect(compose).toContain('AGENT_GATEWAY_MAX_INPUT_BYTES: "4096"');
    expect(compose).toContain('AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES: "8192"');
    expect(compose).toContain("NODE_ENV: production");
    expect(compose).toContain('"18080:8080"');
    expect(compose).toContain(
      "file: ./docs/deployment/container-example/secrets/gateway-api-keys.example",
    );
    expect(compose).toContain(
      "file: ./docs/deployment/container-example/secrets/openai-api-key.example",
    );
  });

  it("documents and scripts the deployment smoke path", () => {
    const docs = [readRepoFile("README.md"), readRepoFile("docs/deployment/README.md")].join("\n");
    const compose = readRepoFile("compose.deployment-example.yaml");
    const makefile = readRepoFile("Makefile");
    const diagnoseScript = readRepoFile("docs/deployment/container-example/diagnose.sh");
    const lifecycleScript = readRepoFile("docs/deployment/container-example/lifecycle.sh");
    const preflightScript = readRepoFile("docs/deployment/container-example/preflight.sh");
    const smokeScript = readRepoFile("docs/deployment/container-example/smoke.sh");
    const dockerfile = readRepoFile("Dockerfile");

    expect(docs).toContain("make deployment-smoke");
    expect(docs).toContain("make deployment-preflight");
    expect(docs).toContain("make deployment-up");
    expect(docs).toContain("make deployment-ready");
    expect(docs).toContain("make deployment-request");
    expect(docs).toContain("make deployment-diagnose");
    expect(docs).toContain("make deployment-logs");
    expect(docs).toContain("make deployment-down");
    expect(docs).toContain("mounted secret files");
    expect(docs).toContain("request-size guardrails");
    expect(docs).toContain("AGENT_GATEWAY_DEFAULT_PROVIDER=echo");
    expect(docs).toContain("AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES=8192");
    expect(docs).toContain("http://localhost:18080/readyz");
    expect(docs).toContain("Startup fails before listening");
    expect(docs).toContain("default deployment port `18080`");
    expect(docs).toContain("readable and non-empty");
    expect(makefile).toContain("deployment-smoke:");
    expect(makefile).toContain("docs/deployment/container-example/smoke.sh");
    expect(makefile).toContain("deployment-diagnose:");
    expect(makefile).toContain("docs/deployment/container-example/diagnose.sh");
    expect(makefile).toContain("deployment-preflight:");
    expect(makefile).toContain("docs/deployment/container-example/preflight.sh");
    expect(makefile).toContain("deployment-up:");
    expect(makefile).toContain("docs/deployment/container-example/lifecycle.sh up");
    expect(makefile).toContain("deployment-ready:");
    expect(makefile).toContain("docs/deployment/container-example/lifecycle.sh ready");
    expect(makefile).toContain("deployment-request:");
    expect(makefile).toContain("docs/deployment/container-example/lifecycle.sh request");
    expect(makefile).toContain("deployment-logs:");
    expect(makefile).toContain("docs/deployment/container-example/lifecycle.sh logs");
    expect(makefile).toContain("deployment-down:");
    expect(makefile).toContain("docs/deployment/container-example/lifecycle.sh down");
    expect(diagnoseScript).toContain("compose ps --all");
    expect(diagnoseScript).toContain("docker inspect --format");
    expect(diagnoseScript).toContain("gateway readiness");
    expect(diagnoseScript).toContain('compose logs --tail="$LOG_TAIL" gateway');
    expect(lifecycleScript).toContain("wait_for_readyz");
    expect(lifecycleScript).toContain("wait_for_container_health");
    expect(lifecycleScript).toContain("/v1/requests");
    expect(lifecycleScript).toContain("compose logs -f");
    expect(lifecycleScript).toContain("compose down --remove-orphans");
    expect(lifecycleScript).toContain("docs/deployment/container-example/preflight.sh");
    expect(preflightScript).toContain("docker info");
    expect(preflightScript).toContain("docker compose version");
    expect(preflightScript).toContain('docker compose -f "$COMPOSE_FILE" config');
    expect(preflightScript).toContain("DEPLOYMENT_EXAMPLE_PORTS:-18080");
    expect(preflightScript).toContain("port %s is already in use");
    expect(preflightScript).toContain("DEPLOYMENT_EXAMPLE_SECRET_FILES");
    expect(preflightScript).toContain("gateway-api-keys.example");
    expect(preflightScript).toContain("openai-api-key.example");
    expect(preflightScript).toContain("secret file is readable and non-empty");
    expect(preflightScript).toContain("make deployment-down");
    expect(preflightScript).toContain("agent-gateway-deployment-example");
    expect(preflightDefaultPorts(preflightScript)).toEqual(publishedComposePorts(compose));
    expect(smokeScript).toContain("verify_default_provider_validation");
    expect(smokeScript).toContain("Unknown provider 'missing'");
    expect(smokeScript).toContain("wait_for_readyz");
    expect(smokeScript).toContain("wait_for_container_health");
    expect(smokeScript).toContain("/v1/requests");
    expect(smokeScript).toContain("docs/deployment/container-example/preflight.sh");
    expect(smokeScript).toContain("docs/deployment/container-example/diagnose.sh");
    expect(smokeScript).toContain("deployment smoke failed during");
    expect(dockerfile).toContain("/readyz");
  });
});
