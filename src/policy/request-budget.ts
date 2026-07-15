import type { RequestBudgetConfig } from "../config.js";
import { estimateTokens } from "../providers/token-estimate.js";

export type RequestBudgetDecision =
  | {
      estimatedInputTokens: number;
      type: "allowed";
    }
  | {
      estimatedInputTokens: number;
      limit: number;
      reason: "estimated_input_tokens_exceeded";
      type: "rejected";
    };

export function evaluateRequestBudget(
  config: RequestBudgetConfig,
  input: string,
): RequestBudgetDecision {
  const estimatedInputTokens = estimateTokens(input);

  if (config.maxInputTokens !== undefined && estimatedInputTokens > config.maxInputTokens) {
    return {
      estimatedInputTokens,
      limit: config.maxInputTokens,
      reason: "estimated_input_tokens_exceeded",
      type: "rejected",
    };
  }

  return {
    estimatedInputTokens,
    type: "allowed",
  };
}
