import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildTextImageBenchmarkCases } from "../src/benchmarks/text-image-benchmark.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function countWords(value: string): number {
  return value.split(/\s+/).filter((word) => word.length > 0).length;
}

describe("text vs image benchmark assets", () => {
  it("generates fixed 100-word and 1000-word comparison cases", () => {
    const cases = buildTextImageBenchmarkCases();

    expect(cases.map((benchmarkCase) => benchmarkCase.wordCount)).toEqual([100, 1000]);

    for (const benchmarkCase of cases) {
      expect(countWords(benchmarkCase.nativeText)).toBe(benchmarkCase.wordCount);
      expect(benchmarkCase.imageDataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(benchmarkCase.imageLineCount).toBeGreaterThan(0);
      expect(benchmarkCase.imageHeight).toBeGreaterThan(0);
      expect(benchmarkCase.imageBytes).toBeGreaterThan(benchmarkCase.nativeBytes);
      expect(benchmarkCase.imageEstimatedTokens).toBeGreaterThan(
        benchmarkCase.nativeEstimatedTokens,
      );
    }
  });

  it("documents the benchmark command and no-build verdict", () => {
    const docs = [readRepoFile("README.md"), readRepoFile("docs/benchmarks/text-vs-image.md")].join(
      "\n",
    );
    const makefile = readRepoFile("Makefile");
    const packageJson = readRepoFile("package.json");

    expect(docs).toContain("make benchmark-text-image");
    expect(docs).toContain("Do not build a text-as-image compression path");
    expect(docs).toContain("1000");
    expect(makefile).toContain("benchmark-text-image:");
    expect(makefile).toContain("npm run benchmark:text-image");
    expect(packageJson).toContain('"benchmark:text-image"');
  });
});
