import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const pathname = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(pathname) : /\.(ts|svelte)$/.test(pathname) ? [pathname] : [];
  });
}

describe("frontend authentication import boundary", () => {
  it("prevents Better Auth and internal auth-module imports outside the module", () => {
    const violations = sourceFiles(sourceRoot).filter((pathname) => {
      const rel = relative(sourceRoot, pathname).replaceAll("\\", "/");
      if (rel.startsWith("modules/auth/")) return false;
      const content = readFileSync(pathname, "utf8");
      return /(?:from\s*|import\s*\()\s*["']better-auth(?:\/[^"']*)?["']/.test(content) ||
        /(?:from\s*|import\s*\()\s*["']@modules\/auth\//.test(content) ||
        /(?:from\s*|import\s*\()\s*["'][^"']*\/lib\/authClient["']/.test(content);
    });
    expect(violations).toEqual([]);
  });

  it("does not export the raw SDK client from the public boundary", () => {
    const publicApi = readFileSync(join(sourceRoot, "modules/auth/index.ts"), "utf8");
    expect(publicApi).not.toMatch(/export\s*\{[^}]*\bauthClient\b/);
  });
});
