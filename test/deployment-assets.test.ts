import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function publishedComposePorts(compose: string): string[] {
  return Array.from(
    compose.matchAll(/\$\{DEPLOYMENT_EXAMPLE_GATEWAY_PORT:-(\d+)\}:8080/g),
    (match) => match[1],
  ).sort();
}

function envDefaultValue(envScript: string, name: string): string {
  const match = envScript.match(new RegExp(`${name}="\\$\\{${name}:-(?<value>[^}]+)\\}"`));

  expect(match?.groups?.value).toBeDefined();

  return match?.groups?.value ?? "";
}

describe("deployment example assets", () => {
  it("ships a compose example using mounted secret files and readiness health", () => {
    const compose = readRepoFile("compose.deployment-example.yaml");
    const envScript = readRepoFile("docs/deployment/container-example/env.sh");

    expect(compose).toContain("AGENT_GATEWAY_API_KEYS_FILE: /run/secrets/agent_gateway_api_keys");
    expect(compose).toContain(
      "AGENT_GATEWAY_OPENAI_API_KEY_FILE: /run/secrets/agent_gateway_openai_api_key",
    );
    expect(compose).toContain("AGENT_GATEWAY_DEFAULT_PROVIDER: echo");
    expect(compose).toContain('AGENT_GATEWAY_MAX_INPUT_BYTES: "4096"');
    expect(compose).toContain('AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES: "8192"');
    expect(compose).toContain("NODE_ENV: production");
    expect(compose).toContain('"${DEPLOYMENT_EXAMPLE_GATEWAY_PORT:-18080}:8080"');
    expect(compose).toContain(
      "file: ${DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE:-./docs/deployment/container-example/secrets/gateway-api-keys.example}",
    );
    expect(compose).toContain(
      "file: ${DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE:-./docs/deployment/container-example/secrets/openai-api-key.example}",
    );
    expect(envDefaultValue(envScript, "DEPLOYMENT_EXAMPLE_GATEWAY_PORT")).toBe("18080");
    expect(envDefaultValue(envScript, "DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE")).toBe(
      "./docs/deployment/container-example/secrets/gateway-api-keys.example",
    );
    expect(envDefaultValue(envScript, "DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE")).toBe(
      "./docs/deployment/container-example/secrets/openai-api-key.example",
    );
  });

  it("documents and scripts the deployment smoke path", () => {
    const docs = [readRepoFile("README.md"), readRepoFile("docs/deployment/README.md")].join("\n");
    const compose = readRepoFile("compose.deployment-example.yaml");
    const makefile = readRepoFile("Makefile");
    const bootstrapScript = readRepoFile("docs/deployment/container-example/bootstrap-secrets.sh");
    const diagnoseScript = readRepoFile("docs/deployment/container-example/diagnose.sh");
    const envScript = readRepoFile("docs/deployment/container-example/env.sh");
    const envExample = readRepoFile("docs/deployment/container-example/.env.local.example");
    const gitignore = readRepoFile(".gitignore");
    const lifecycleScript = readRepoFile("docs/deployment/container-example/lifecycle.sh");
    const preflightScript = readRepoFile("docs/deployment/container-example/preflight.sh");
    const smokeScript = readRepoFile("docs/deployment/container-example/smoke.sh");
    const dockerfile = readRepoFile("Dockerfile");

    expect(docs).toContain("make deployment-smoke");
    expect(docs).toContain("make deployment-bootstrap-secrets");
    expect(docs).toContain("make deployment-preflight");
    expect(docs).toContain("make deployment-config");
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
    expect(docs).toContain("docs/deployment/container-example/.env.local");
    expect(docs).toContain("DEPLOYMENT_EXAMPLE_GATEWAY_PORT");
    expect(docs).toContain("DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE");
    expect(docs).toContain("DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE");
    expect(docs).toContain("gateway-api-keys.local");
    expect(docs).toContain("openai-api-key.local");
    expect(docs).toContain("without printing secret values");
    expect(docs).toContain("Startup fails before listening");
    expect(docs).toContain("default deployment port `18080`");
    expect(docs).toContain("readable and non-empty");
    expect(makefile).toContain("deployment-smoke:");
    expect(makefile).toContain("docs/deployment/container-example/smoke.sh");
    expect(makefile).toContain("deployment-bootstrap-secrets:");
    expect(makefile).toContain("docs/deployment/container-example/bootstrap-secrets.sh");
    expect(makefile).toContain("deployment-config:");
    expect(makefile).toContain("docs/deployment/container-example/config.sh");
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
    expect(bootstrapScript).toContain(".env.local.example");
    expect(bootstrapScript).toContain("gateway-api-keys.example");
    expect(bootstrapScript).toContain("openai-api-key.example");
    expect(bootstrapScript).toContain("gateway-api-keys.local");
    expect(bootstrapScript).toContain("openai-api-key.local");
    expect(bootstrapScript).toContain("skip:");
    expect(bootstrapScript).toContain("chmod 600");
    expect(diagnoseScript).toContain("compose ps --all");
    expect(diagnoseScript).toContain("docker inspect --format");
    expect(diagnoseScript).toContain("gateway readiness");
    expect(diagnoseScript).toContain("resolved deployment configuration");
    expect(diagnoseScript).toContain("docs/deployment/container-example/config.sh");
    expect(diagnoseScript).toContain(
      'compose logs --tail="$DEPLOYMENT_EXAMPLE_DIAGNOSE_LOG_TAIL" gateway',
    );
    expect(diagnoseScript).toContain(". docs/deployment/container-example/env.sh");
    expect(envScript).toContain("DEPLOYMENT_EXAMPLE_ENV_FILE");
    expect(envScript).toContain(".env.local");
    expect(envScript).toContain("DEPLOYMENT_EXAMPLE_GATEWAY_URL");
    expect(envExample).toContain("DEPLOYMENT_EXAMPLE_GATEWAY_PORT=18081");
    expect(envExample).toContain("gateway-api-keys.local");
    expect(envExample).toContain("openai-api-key.local");
    expect(gitignore).toContain("docs/deployment/container-example/.env.local");
    expect(gitignore).toContain("docs/deployment/container-example/secrets/*.local");
    expect(lifecycleScript).toContain(". docs/deployment/container-example/env.sh");
    expect(lifecycleScript).toContain("wait_for_readyz");
    expect(lifecycleScript).toContain("wait_for_container_health");
    expect(lifecycleScript).toContain("/v1/requests");
    expect(lifecycleScript).toContain("compose logs -f");
    expect(lifecycleScript).toContain("compose down --remove-orphans");
    expect(lifecycleScript).toContain("docs/deployment/container-example/preflight.sh");
    expect(preflightScript).toContain("docker info");
    expect(preflightScript).toContain("docker compose version");
    expect(preflightScript).toContain(
      'docker compose -f "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE" config',
    );
    expect(preflightScript).toContain(". docs/deployment/container-example/env.sh");
    expect(preflightScript).toContain("DEPLOYMENT_EXAMPLE_GATEWAY_PORT");
    expect(preflightScript).toContain("port %s is already in use");
    expect(preflightScript).toContain("DEPLOYMENT_EXAMPLE_SECRET_FILES");
    expect(envScript).toContain("gateway-api-keys.example");
    expect(envScript).toContain("openai-api-key.example");
    expect(preflightScript).toContain("secret file is readable and non-empty");
    expect(preflightScript).toContain("make deployment-down");
    expect(readRepoFile("docs/deployment/container-example/config.sh")).toContain(
      "deployment example resolved configuration",
    );
    expect(readRepoFile("docs/deployment/container-example/config.sh")).toContain(
      "gateway_api_keys_file",
    );
    expect(readRepoFile("docs/deployment/container-example/config.sh")).toContain(
      "openai_api_key_file",
    );
    expect(readRepoFile("docs/deployment/container-example/config.sh")).toContain(
      "readable-non-empty",
    );
    expect(envScript).toContain("agent-gateway-deployment-example");
    expect([envDefaultValue(envScript, "DEPLOYMENT_EXAMPLE_GATEWAY_PORT")]).toEqual(
      publishedComposePorts(compose),
    );
    expect(smokeScript).toContain(". docs/deployment/container-example/env.sh");
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

  it("bootstraps ignored local deployment secrets without overwriting existing files", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agent-gateway-deployment-"));
    const envFile = path.join(tmp, ".env.local");
    const gatewaySecret = path.join(tmp, "gateway-api-keys.local");
    const openAISecret = path.join(tmp, "openai-api-key.local");

    writeFileSync(
      envFile,
      [
        `DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE=${gatewaySecret}`,
        `DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE=${openAISecret}`,
        "",
      ].join("\n"),
    );

    try {
      const firstRun = spawnSync("sh", ["docs/deployment/container-example/bootstrap-secrets.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, DEPLOYMENT_EXAMPLE_ENV_FILE: envFile },
      });

      expect(firstRun.status).toBe(0);
      expect(firstRun.stdout).toContain("created: gateway API keys file");
      expect(firstRun.stdout).toContain("created: OpenAI-compatible API key file");
      expect(readFileSync(gatewaySecret, "utf8")).toBe(
        readRepoFile("docs/deployment/container-example/secrets/gateway-api-keys.example"),
      );
      expect(readFileSync(openAISecret, "utf8")).toBe(
        readRepoFile("docs/deployment/container-example/secrets/openai-api-key.example"),
      );

      writeFileSync(gatewaySecret, "custom-local-token\n");

      const secondRun = spawnSync(
        "sh",
        ["docs/deployment/container-example/bootstrap-secrets.sh"],
        {
          cwd: repoRoot,
          encoding: "utf8",
          env: { ...process.env, DEPLOYMENT_EXAMPLE_ENV_FILE: envFile },
        },
      );

      expect(secondRun.status).toBe(0);
      expect(secondRun.stdout).toContain(
        `skip: gateway API keys file already exists: ${gatewaySecret}`,
      );
      expect(readFileSync(gatewaySecret, "utf8")).toBe("custom-local-token\n");
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("prints resolved deployment config without secret contents", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agent-gateway-deployment-config-"));
    const envFile = path.join(tmp, ".env.local");
    const gatewaySecret = path.join(tmp, "gateway-api-keys.local");
    const openAISecret = path.join(tmp, "openai-api-key.local");

    writeFileSync(gatewaySecret, "super-secret-gateway-token\n");
    writeFileSync(openAISecret, "super-secret-provider-token\n");
    writeFileSync(
      envFile,
      [
        "DEPLOYMENT_EXAMPLE_GATEWAY_PORT=19080",
        `DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE=${gatewaySecret}`,
        `DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE=${openAISecret}`,
        "",
      ].join("\n"),
    );

    try {
      const result = spawnSync("sh", ["docs/deployment/container-example/config.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, DEPLOYMENT_EXAMPLE_ENV_FILE: envFile },
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("deployment example resolved configuration");
      expect(result.stdout).toContain(`env_file=${envFile}`);
      expect(result.stdout).toContain("gateway_port=19080");
      expect(result.stdout).toContain(
        `gateway_api_keys_file=${gatewaySecret} (readable-non-empty)`,
      );
      expect(result.stdout).toContain(`openai_api_key_file=${openAISecret} (readable-non-empty)`);
      expect(result.stdout).not.toContain("super-secret-gateway-token");
      expect(result.stdout).not.toContain("super-secret-provider-token");
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });
});
