import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("license surface", () => {
  it("publishes the MIT license text at the repository root", () => {
    const license = readRepoFile("LICENSE");

    for (const expected of [
      "MIT License",
      "Copyright (c) 2026 TempMailSo",
      "Permission is hereby granted, free of charge",
      'THE SOFTWARE IS PROVIDED "AS IS"',
    ]) {
      expect(license).toContain(expected);
    }
  });

  it("declares the matching SPDX identifier in package metadata", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      license?: string;
    };
    const packageLock = JSON.parse(readRepoFile("package-lock.json")) as {
      packages?: Record<string, { license?: string }>;
    };

    expect(packageJson.license).toBe("MIT");
    expect(packageLock.packages?.[""]?.license).toBe("MIT");
  });

  it("links the license from the README trust surface", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("## License");
    expect(readme).toContain("MIT License");
    expect(readme).toContain("LICENSE");
    expect(readme).toContain("SPDX identifier in `package.json`");
  });
});
