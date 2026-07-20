import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("deployment example assets", () => {
  it("ships a compose example using mounted secret files and readiness health", () => {
    const compose = readRepoFile("compose.deployment-example.yaml");

    expect(compose).toContain("AGENT_GATEWAY_API_KEYS_FILE: /run/secrets/agent_gateway_api_keys");
    expect(compose).toContain(
      "AGENT_GATEWAY_OPENAI_API_KEY_FILE: /run/secrets/agent_gateway_openai_api_key",
    );
    expect(compose).toContain("AGENT_GATEWAY_DEFAULT_PROVIDER: echo");
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
    const makefile = readRepoFile("Makefile");
    const lifecycleScript = readRepoFile("docs/deployment/container-example/lifecycle.sh");
    const smokeScript = readRepoFile("docs/deployment/container-example/smoke.sh");
    const dockerfile = readRepoFile("Dockerfile");

    expect(docs).toContain("make deployment-smoke");
    expect(docs).toContain("make deployment-up");
    expect(docs).toContain("make deployment-ready");
    expect(docs).toContain("make deployment-request");
    expect(docs).toContain("make deployment-logs");
    expect(docs).toContain("make deployment-down");
    expect(docs).toContain("mounted secret files");
    expect(docs).toContain("AGENT_GATEWAY_DEFAULT_PROVIDER=echo");
    expect(docs).toContain("http://localhost:18080/readyz");
    expect(docs).toContain("Startup fails before listening");
    expect(makefile).toContain("deployment-smoke:");
    expect(makefile).toContain("docs/deployment/container-example/smoke.sh");
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
    expect(lifecycleScript).toContain("wait_for_readyz");
    expect(lifecycleScript).toContain("wait_for_container_health");
    expect(lifecycleScript).toContain("/v1/requests");
    expect(lifecycleScript).toContain("compose logs -f");
    expect(lifecycleScript).toContain("compose down --remove-orphans");
    expect(smokeScript).toContain("verify_default_provider_validation");
    expect(smokeScript).toContain("Unknown provider 'missing'");
    expect(smokeScript).toContain("wait_for_readyz");
    expect(smokeScript).toContain("wait_for_container_health");
    expect(smokeScript).toContain("/v1/requests");
    expect(dockerfile).toContain("/readyz");
  });
});
