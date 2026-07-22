import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("gateway config", () => {
  it("uses echo as the default provider when none is configured", () => {
    const config = loadConfig({ NODE_ENV: "test" });

    expect(config.defaultProvider).toBe("echo");
  });

  it("trims the configured default provider", () => {
    const config = loadConfig({
      AGENT_GATEWAY_DEFAULT_PROVIDER: "  openai-compatible  ",
      AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
      NODE_ENV: "test",
    });

    expect(config.defaultProvider).toBe("openai-compatible");
    expect(config.openAICompatible).toBeDefined();
  });

  it("rejects blank default providers", () => {
    expect(() =>
      loadConfig({
        AGENT_GATEWAY_DEFAULT_PROVIDER: " \t\n ",
        NODE_ENV: "test",
      }),
    ).toThrow("AGENT_GATEWAY_DEFAULT_PROVIDER must be a non-blank provider name");
  });

  it("trims configured provider/model allow-list entries", () => {
    const config = loadConfig({
      AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS:
        " echo : local-test , openai-compatible : gpt-4o-mini ",
      NODE_ENV: "test",
    });

    expect(config.requestPolicy.allowedProviderModels).toEqual([
      { model: "local-test", provider: "echo" },
      { model: "gpt-4o-mini", provider: "openai-compatible" },
    ]);
  });

  it.each([
    ["blank entry", "echo:local-test,,openai-compatible:gpt-4o-mini"],
    ["blank provider", " :local-test"],
    ["blank model", "echo:   "],
    ["missing separator", "echo/local-test"],
    ["extra separator", "echo:local:test"],
  ])("rejects malformed provider/model allow-list entries: %s", (_name, value) => {
    expect(() =>
      loadConfig({
        AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS: value,
        NODE_ENV: "test",
      }),
    ).toThrow(
      "AGENT_GATEWAY_ALLOWED_PROVIDER_MODELS entries must use non-blank provider:model format",
    );
  });
});
