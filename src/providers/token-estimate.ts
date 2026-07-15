export function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.trim().length / 4));
}
