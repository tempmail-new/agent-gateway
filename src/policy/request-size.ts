import type { RequestSizeConfig } from "../config.js";

export type RequestSizeDecision =
  | {
      inputBytes: number;
      type: "allowed";
    }
  | {
      inputBytes: number;
      limit: number;
      reason: "input_bytes_exceeded";
      type: "rejected";
    };

export function evaluateRequestSize(config: RequestSizeConfig, input: string): RequestSizeDecision {
  const inputBytes = Buffer.byteLength(input, "utf8");

  if (config.maxInputBytes !== undefined && inputBytes > config.maxInputBytes) {
    return {
      inputBytes,
      limit: config.maxInputBytes,
      reason: "input_bytes_exceeded",
      type: "rejected",
    };
  }

  return {
    inputBytes,
    type: "allowed",
  };
}
