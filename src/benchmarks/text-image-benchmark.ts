import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { estimateTokens } from "../providers/token-estimate.js";

const sampleSizes = [100, 1000] as const;
const defaultIterations = 25;
const svgWidth = 1200;
const horizontalPadding = 56;
const verticalPadding = 48;
const fontSize = 22;
const lineHeight = 32;
const averageCharacterWidth = 11;
const maxLineCharacters = Math.floor((svgWidth - horizontalPadding * 2) / averageCharacterWidth);

const vocabulary = [
  "agent",
  "gateway",
  "provider",
  "routing",
  "policy",
  "budget",
  "telemetry",
  "latency",
  "request",
  "operator",
  "deployment",
  "readiness",
  "metrics",
  "trace",
  "retry",
  "secret",
  "model",
  "tenant",
  "validation",
  "observability",
];

export type BenchmarkSampleSize = (typeof sampleSizes)[number];

export type TextImageBenchmarkCase = {
  imageBytes: number;
  imageDataUrl: string;
  imageEstimatedTokens: number;
  imageHeight: number;
  imageLineCount: number;
  nativeEstimatedTokens: number;
  nativeText: string;
  nativeBytes: number;
  wordCount: BenchmarkSampleSize;
};

export type TextImageBenchmarkRow = Omit<TextImageBenchmarkCase, "imageDataUrl" | "nativeText"> & {
  estimatedTokenDelta: number;
  estimatedTokenRatio: number;
  imageMedianGatewayMs: number;
  latencyDeltaMs: number;
  latencyRatio: number;
  nativeMedianGatewayMs: number;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function generateBenchmarkText(wordCount: BenchmarkSampleSize): string {
  const words = Array.from({ length: wordCount }, (_, index) => {
    const word = vocabulary[index % vocabulary.length];
    return index % 29 === 28 ? `${word}.` : word;
  });

  return words.join(" ");
}

function wrapText(text: string): string[] {
  const lines: string[] = [];
  let currentLine = "";

  for (const word of text.split(" ")) {
    const nextLine = currentLine.length === 0 ? word : `${currentLine} ${word}`;
    if (nextLine.length <= maxLineCharacters) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

function renderSvgDataUrl(text: string) {
  const lines = wrapText(text);
  const imageHeight = verticalPadding * 2 + Math.max(1, lines.length) * lineHeight;
  const tspans = lines
    .map((line, index) => {
      const y = verticalPadding + fontSize + index * lineHeight;
      return `<tspan x="${horizontalPadding}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${imageHeight}" viewBox="0 0 ${svgWidth} ${imageHeight}"><rect width="100%" height="100%" fill="#fff"/><text font-family="Arial, sans-serif" font-size="${fontSize}" fill="#111">${tspans}</text></svg>`;
  const imageDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return {
    imageBytes: Buffer.byteLength(imageDataUrl, "utf8"),
    imageDataUrl,
    imageHeight,
    imageLineCount: lines.length,
  };
}

export function buildTextImageBenchmarkCases(): TextImageBenchmarkCase[] {
  return sampleSizes.map((wordCount) => {
    const nativeText = generateBenchmarkText(wordCount);
    const image = renderSvgDataUrl(nativeText);

    return {
      ...image,
      imageEstimatedTokens: estimateTokens(image.imageDataUrl),
      nativeBytes: Buffer.byteLength(nativeText, "utf8"),
      nativeEstimatedTokens: estimateTokens(nativeText),
      nativeText,
      wordCount,
    };
  });
}

async function medianGatewayLatencyMs(input: string, iterations: number): Promise<number> {
  const app = buildApp(
    loadConfig({
      AGENT_GATEWAY_API_KEYS: "benchmark-token",
      NODE_ENV: "test",
      OTEL_SERVICE_NAME: "agent-gateway-benchmark",
    }),
    { logger: false },
  );
  const timings: number[] = [];

  try {
    for (let index = 0; index < iterations; index += 1) {
      const startedAt = performance.now();
      const response = await app.inject({
        headers: { authorization: "Bearer benchmark-token" },
        method: "POST",
        payload: {
          input,
          metadata: { benchmark: "text-vs-image" },
          model: "local-test",
        },
        url: "/v1/requests",
      });
      timings.push(performance.now() - startedAt);

      if (response.statusCode !== 200) {
        throw new Error(`benchmark request failed with HTTP ${response.statusCode}`);
      }
    }
  } finally {
    await app.close();
  }

  return median(timings);
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted[middle];

  if (value === undefined) {
    throw new Error("cannot calculate a median without values");
  }

  return value;
}

export async function runTextImageBenchmark(
  iterations = defaultIterations,
): Promise<TextImageBenchmarkRow[]> {
  const cases = buildTextImageBenchmarkCases();
  const rows: TextImageBenchmarkRow[] = [];

  for (const benchmarkCase of cases) {
    const nativeMedianGatewayMs = await medianGatewayLatencyMs(
      benchmarkCase.nativeText,
      iterations,
    );
    const imageMedianGatewayMs = await medianGatewayLatencyMs(
      benchmarkCase.imageDataUrl,
      iterations,
    );

    rows.push({
      imageBytes: benchmarkCase.imageBytes,
      imageEstimatedTokens: benchmarkCase.imageEstimatedTokens,
      imageHeight: benchmarkCase.imageHeight,
      imageLineCount: benchmarkCase.imageLineCount,
      estimatedTokenDelta: benchmarkCase.imageEstimatedTokens - benchmarkCase.nativeEstimatedTokens,
      estimatedTokenRatio: benchmarkCase.imageEstimatedTokens / benchmarkCase.nativeEstimatedTokens,
      imageMedianGatewayMs,
      latencyDeltaMs: imageMedianGatewayMs - nativeMedianGatewayMs,
      latencyRatio: imageMedianGatewayMs / nativeMedianGatewayMs,
      nativeBytes: benchmarkCase.nativeBytes,
      nativeEstimatedTokens: benchmarkCase.nativeEstimatedTokens,
      nativeMedianGatewayMs,
      wordCount: benchmarkCase.wordCount,
    });
  }

  return rows;
}

export function formatTextImageBenchmarkMarkdown(
  rows: TextImageBenchmarkRow[],
  iterations = defaultIterations,
): string {
  const header =
    "| words | native estimated tokens | image data-url estimated tokens | token ratio | native median gateway ms | image median gateway ms | latency ratio |";
  const divider = "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |";
  const body = rows.map(
    (row) =>
      `| ${row.wordCount} | ${row.nativeEstimatedTokens} | ${row.imageEstimatedTokens} | ${formatNumber(row.estimatedTokenRatio)}x | ${formatNumber(row.nativeMedianGatewayMs)} | ${formatNumber(row.imageMedianGatewayMs)} | ${formatNumber(row.latencyRatio)}x |`,
  );

  return [
    "# Text vs Image Benchmark",
    "",
    header,
    divider,
    ...body,
    "",
    `Iterations per variant: ${iterations}`,
  ].join("\n");
}

function formatNumber(value: number): string {
  return value.toFixed(2);
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  const parsedIterations = Number.parseInt(process.env.TEXT_IMAGE_BENCHMARK_ITERATIONS ?? "", 10);
  const iterations =
    Number.isInteger(parsedIterations) && parsedIterations > 0
      ? parsedIterations
      : defaultIterations;

  runTextImageBenchmark(iterations)
    .then((rows) => {
      console.log(formatTextImageBenchmarkMarkdown(rows, iterations));
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
