# ADR 0001: Start With a Provider Boundary and Local Echo Adapter

## Status

Accepted

## Context

The portfolio needs a real backend slice for agent and LLM workloads, but the first increment should avoid external API credentials and broad platform scope. The gateway still needs to show how provider routing, authentication, and observability will fit together.

## Decision

Create a TypeScript Fastify service with a provider interface, registry, and local `echo` provider. Requests are authenticated before provider routing, then executed inside an OpenTelemetry API span.

## Consequences

- CI can run the full gateway flow without networked model providers.
- Future adapters can implement `AgentProvider` and register with the gateway.
- Budget, policy, and provider-specific retry behavior remain future work instead of being hidden inside the first scaffold.
