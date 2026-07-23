import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("gateway config", () => {
  it("uses echo as the default provider when none is configured", () => {
    const config = loadConfig({ NODE_ENV: "test" });

    expect(config.defaultProvider).toBe("echo");
  });

  it("uses the development API key fallback when API keys are unset or blank", () => {
    expect([...loadConfig({ NODE_ENV: "test" }).apiKeys]).toEqual(["dev-token"]);
    expect([...loadConfig({ AGENT_GATEWAY_API_KEYS: " \t\n ", NODE_ENV: "test" }).apiKeys]).toEqual(
      ["dev-token"],
    );
  });

  it("trims configured API keys", () => {
    const config = loadConfig({
      AGENT_GATEWAY_API_KEYS: " first-token , second-token ",
      NODE_ENV: "test",
    });

    expect([...config.apiKeys]).toEqual(["first-token", "second-token"]);
  });

  it.each([
    ["leading comma", ",first-token"],
    ["trailing comma", "first-token,"],
    ["repeated comma", "first-token,,second-token"],
    ["whitespace entry", "first-token,   ,second-token"],
  ])("rejects blank API key entries: %s", (_name, value) => {
    expect(() =>
      loadConfig({
        AGENT_GATEWAY_API_KEYS: value,
        NODE_ENV: "test",
      }),
    ).toThrow("AGENT_GATEWAY_API_KEYS entries must be non-blank");
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

  it.each([
    ["port with trailing text", { PORT: "8080abc" }, "PORT must be an integer between 1 and 65535"],
    [
      "OpenAI-compatible retry attempts with trailing text",
      {
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS: "2x",
      },
      "AGENT_GATEWAY_OPENAI_MAX_ATTEMPTS must be an integer between 1 and 5",
    ],
    [
      "OpenAI-compatible timeout with unit suffix",
      {
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        AGENT_GATEWAY_OPENAI_TIMEOUT_MS: "30000ms",
      },
      "AGENT_GATEWAY_OPENAI_TIMEOUT_MS must be an integer between 1 and 300000",
    ],
    [
      "input token budget with exponent notation",
      { AGENT_GATEWAY_MAX_INPUT_TOKENS: "1e3" },
      "AGENT_GATEWAY_MAX_INPUT_TOKENS must be a positive integer",
    ],
    [
      "request body limit with hexadecimal notation",
      { AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES: "0x1000" },
      "AGENT_GATEWAY_MAX_REQUEST_BODY_BYTES must be a positive integer",
    ],
    [
      "input byte limit with decimal notation",
      { AGENT_GATEWAY_MAX_INPUT_BYTES: "64.5" },
      "AGENT_GATEWAY_MAX_INPUT_BYTES must be a positive integer",
    ],
  ])("rejects non-decimal numeric config values: %s", (_name, env, errorMessage) => {
    expect(() =>
      loadConfig({
        ...env,
        NODE_ENV: "test",
      }),
    ).toThrow(errorMessage);
  });
});
