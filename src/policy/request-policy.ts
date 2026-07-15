import type { RequestPolicyConfig } from "../config.js";

export interface RequestPolicyDecision {
  reason?: "provider_model_not_allowed";
  type: "allowed" | "rejected";
}

export function evaluateRequestPolicy(
  policy: RequestPolicyConfig,
  provider: string,
  model: string,
): RequestPolicyDecision {
  if (policy.allowedProviderModels.length === 0) {
    return { type: "allowed" };
  }

  const isAllowed = policy.allowedProviderModels.some((rule) => {
    const providerMatches = rule.provider === "*" || rule.provider === provider;
    const modelMatches = rule.model === "*" || rule.model === model;

    return providerMatches && modelMatches;
  });

  if (isAllowed) {
    return { type: "allowed" };
  }

  return { reason: "provider_model_not_allowed", type: "rejected" };
}
