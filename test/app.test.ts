import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const config = loadConfig({
  AGENT_GATEWAY_API_KEYS: "test-token",
  NODE_ENV: "test",
  OTEL_SERVICE_NAME: "agent-gateway-test",
});

describe("agent gateway app", () => {
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
});
