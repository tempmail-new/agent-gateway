import type { FastifyReply, FastifyRequest } from "fastify";

const bearerPrefix = "Bearer ";

export function authenticate(apiKeys: ReadonlySet<string>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authorization = request.headers.authorization;

    if (authorization === undefined || !authorization.startsWith(bearerPrefix)) {
      await reply.code(401).send({ error: "missing_bearer_token" });
      return;
    }

    const token = authorization.slice(bearerPrefix.length).trim();
    if (!apiKeys.has(token)) {
      await reply.code(401).send({ error: "invalid_bearer_token" });
      return;
    }

    request.apiKeyId = fingerprintToken(token);
  };
}

function fingerprintToken(token: string): string {
  return `key_${token.slice(0, 6)}`;
}

declare module "fastify" {
  interface FastifyRequest {
    apiKeyId?: string;
  }
}
