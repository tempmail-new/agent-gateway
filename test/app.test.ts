import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { OpenAICompatibleProvider } from "../src/providers/index.js";
import type { ProviderError } from "../src/providers/index.js";

const config = loadConfig({
  AGENT_GATEWAY_API_KEYS: "test-token",
  NODE_ENV: "test",
  OTEL_SERVICE_NAME: "agent-gateway-test",
});

describe("agent gateway app", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports health without authentication", async () => {
    const app = buildApp(config);
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      providers: ["echo"],
      service: "agent-gateway-test",
      status: "ok",
    });
  });

  it("rejects unauthenticated gateway requests", async () => {
    const app = buildApp(config);
    const response = await app.inject({
      method: "POST",
      url: "/v1/requests",
      payload: { input: "hello", model: "test-model" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_bearer_token" });
  });

  it("routes authenticated requests to the echo provider with trace metadata", async () => {
    const app = buildApp(config);
    const response = await app.inject({
      headers: {
        authorization: "Bearer test-token",
        "x-request-id": "req_123",
      },
      method: "POST",
      payload: {
        input: "summarize this",
        metadata: { tenant: "demo" },
        model: "local-test",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "req_123",
      model: "local-test",
      provider: "echo",
      trace: {
        requestId: "req_123",
      },
      usage: {
        inputTokens: 4,
      },
    });
    expect(JSON.parse(response.json().output)).toMatchObject({
      input: "summarize this",
      metadata: { tenant: "demo" },
      model: "local-test",
      requestId: "req_123",
    });
  });

  it("returns a typed error for unknown providers", async () => {
    const app = buildApp(config);
    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "local-test",
        provider: "missing",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "unknown_provider",
      provider: "missing",
      supportedProviders: ["echo"],
    });
  });

  it("registers the OpenAI-compatible provider when credentials are configured", async () => {
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      providers: ["echo", "openai-compatible"],
      service: "agent-gateway-test",
      status: "ok",
    });
  });

  it("routes OpenAI-compatible requests through the chat completions API", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "A concise summary." } }],
          usage: { completion_tokens: 4, prompt_tokens: 7 },
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        AGENT_GATEWAY_OPENAI_BASE_URL: "https://provider.example/v1",
        AGENT_GATEWAY_OPENAI_TIMEOUT_MS: "1000",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );

    const response = await app.inject({
      headers: {
        authorization: "Bearer test-token",
        "x-request-id": "req_openai",
      },
      method: "POST",
      payload: {
        input: "Summarize the incident report.",
        model: "gpt-compatible",
        provider: "openai-compatible",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "req_openai",
      model: "gpt-compatible",
      output: "A concise summary.",
      provider: "openai-compatible",
      usage: {
        inputTokens: 7,
        outputTokens: 4,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({
          messages: [{ content: "Summarize the incident report.", role: "user" }],
          model: "gpt-compatible",
        }),
        headers: {
          authorization: "Bearer provider-token",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
  });

  it("normalizes unsuccessful OpenAI-compatible responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
        });
      }),
    );
    const app = buildApp(
      loadConfig({
        AGENT_GATEWAY_API_KEYS: "test-token",
        AGENT_GATEWAY_OPENAI_API_KEY: "provider-token",
        NODE_ENV: "test",
        OTEL_SERVICE_NAME: "agent-gateway-test",
      }),
    );

    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      payload: {
        input: "hello",
        model: "gpt-compatible",
        provider: "openai-compatible",
      },
      url: "/v1/requests",
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      code: "provider_upstream_error",
      details: { upstreamStatus: 429 },
      error: "provider_error",
      message: "Provider returned an unsuccessful response",
      provider: "openai-compatible",
    });
  });
});

describe("OpenAICompatibleProvider", () => {
  it("normalizes provider timeouts", async () => {
    const fetchMock = vi.fn(async () => {
      throw Object.assign(new Error("deadline exceeded"), { name: "TimeoutError" });
    });
    const provider = new OpenAICompatibleProvider(
      {
        apiKey: "provider-token",
        baseUrl: "https://provider.example/v1",
        timeoutMs: 1,
      },
      fetchMock,
    );

    await expect(
      provider.complete({
        input: "hello",
        model: "gpt-compatible",
        provider: "openai-compatible",
      }),
    ).rejects.toMatchObject<Partial<ProviderError>>({
      code: "provider_timeout",
      provider: "openai-compatible",
      statusCode: 504,
    });
  });
});
