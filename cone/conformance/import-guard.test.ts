import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMemoryEventStore } from "../index";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

describe("NF-C15 headless portability", () => {
  it("loads the public boundary without a browser global", () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(typeof globalThis.document).toBe("undefined");
    expect(createMemoryEventStore().list()).toEqual([]);
  });

  it("keeps forbidden modules and identifiers out of NuForge source", () => {
    const files = sourceFiles(sourceRoot);
    expect(files.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const relative = file.slice(sourceRoot.length);
      for (const specifier of quotedStrings(source)) {
        const problem = specifierProblem(specifier);
        if (problem !== undefined) failures.push(`${relative}: ${problem}`);
      }
      for (const snippet of bannedSnippets()) {
        if (source.toLowerCase().includes(snippet.toLowerCase())) {
          failures.push(`${relative}: ${snippet}`);
        }
      }
      if (/\bwindow\s*\./.test(source) || /\bdocument\s*\./.test(source)) {
        failures.push(`${relative}: browser global`);
      }
    }
    expect(failures).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "conformance") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path));
      continue;
    }
    if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

function quotedStrings(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/["']([^"']+)["']/g)) {
    const value = match[1];
    if (value !== undefined) found.push(value);
  }
  return found;
}

function specifierProblem(specifier: string): string | undefined {
  const normalized = specifier.replaceAll("\\", "/");
  const packages = ["vue", "quasar", "pinia"];
  for (const name of packages) {
    if (
      normalized === name ||
      normalized.startsWith(`${name}/`) ||
      normalized.includes(`/${name}/`) ||
      normalized.endsWith(`/${name}`)
    ) {
      return normalized;
    }
  }
  if (normalized.startsWith("@/")) return normalized;
  if (normalized.includes("services/esi") || normalized.includes("src/pages")) {
    return normalized;
  }
  const domain = ["co", "ne"].join("");
  if (
    normalized === domain ||
    normalized.startsWith(`${domain}/`) ||
    normalized.includes(`/${domain}/`) ||
    normalized.endsWith(`/${domain}`)
  ) {
    return normalized;
  }
  return undefined;
}

function bannedSnippets(): readonly string[] {
  return [
    ["local", "Storage"].join(""),
    ["session", "Storage"].join(""),
    ["indexed", "DB"].join(""),
    ["fire", "base"].join(""),
    ["paleo", "cybernetics"].join(""),
    String(60015140 + 8),
    String(25000 + 885)
  ];
}
