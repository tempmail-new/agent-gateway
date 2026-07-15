import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { z } from "zod";

import type { GatewayConfig } from "./config.js";
import { authenticate } from "./http/auth.js";
import { withGatewayTrace } from "./observability/tracing.js";
import { evaluateRequestBudget } from "./policy/request-budget.js";
import { evaluateRequestPolicy } from "./policy/request-policy.js";
import {
  EchoProvider,
  OpenAICompatibleProvider,
  ProviderError,
  ProviderRegistry,
  UnknownProviderError,
} from "./providers/index.js";
import type { GatewayRequest, GatewayResponse, RequestContext } from "./types.js";

const gatewayRequestSchema = z.object({
  input: z.string().min(1),
  metadata: z.record(z.union([z.boolean(), z.number(), z.string()])).optional(),
  model: z.string().min(1),
  provider: z.string().min(1).optional(),
});

export function buildApp(config: GatewayConfig) {
  const app = Fastify({
    logger: true,
    requestIdHeader: "x-request-id",
  });

  const providers = new ProviderRegistry(config.defaultProvider);
  providers.register(new EchoProvider());

  if (config.openAICompatible !== undefined) {
    providers.register(new OpenAICompatibleProvider(config.openAICompatible));
  }

  app.get("/healthz", async () => ({
    service: config.serviceName,
    status: "ok",
    providers: providers.list(),
  }));

  app.post(
    "/v1/requests",
    {
      preHandler: authenticate(config.apiKeys),
    },
    async (request, reply): Promise<GatewayResponse> => {
      const parsedBody = gatewayRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "invalid_request",
          details: parsedBody.error.flatten(),
        }) as never;
      }

      const requestId = request.id || randomUUID();
      const gatewayRequest: GatewayRequest = parsedBody.data;
      const context: RequestContext = {
        apiKeyId: request.apiKeyId ?? "unknown",
        requestId,
      };
      const provider = providers.get(gatewayRequest.provider);
      const policyDecision = evaluateRequestPolicy(
        config.requestPolicy,
        provider.name,
        gatewayRequest.model,
      );

      if (policyDecision.type === "rejected") {
        return reply.code(403).send({
          error: "policy_rejected",
          model: gatewayRequest.model,
          provider: provider.name,
          reason: policyDecision.reason,
        }) as never;
      }

      const budgetDecision = evaluateRequestBudget(config.requestBudget, gatewayRequest.input);

      if (budgetDecision.type === "rejected") {
        return reply.code(402).send({
          error: "budget_exceeded",
          estimatedInputTokens: budgetDecision.estimatedInputTokens,
          limit: budgetDecision.limit,
          reason: budgetDecision.reason,
        }) as never;
      }

      const startedAt = performance.now();

      return withGatewayTrace(
        config.serviceName,
        "gateway.request",
        {
          "agent_gateway.api_key_id": context.apiKeyId,
          "agent_gateway.model": gatewayRequest.model,
          "agent_gateway.provider": provider.name,
          "agent_gateway.request_id": requestId,
        },
        { requestId, traceId: requestId },
        async (traceHandle) => {
          const result = await provider.complete(gatewayRequest, context);
          const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;

          return {
            durationMs,
            id: requestId,
            model: gatewayRequest.model,
            output: result.output,
            provider: provider.name,
            trace: traceHandle,
            usage: result.usage,
          };
        },
      );
    },
  );

  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof UnknownProviderError) {
      await reply.code(400).send({
        error: "unknown_provider",
        provider: error.provider,
        supportedProviders: error.supportedProviders,
      });
      return;
    }

    if (error instanceof ProviderError) {
      await reply.code(error.statusCode).send({
        code: error.code,
        details: error.details,
        error: "provider_error",
        message: error.message,
        provider: error.provider,
      });
      return;
    }

    app.log.error(error);
    await reply.code(500).send({ error: "internal_error" });
  });

  return app;
}
