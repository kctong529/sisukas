import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const pathname = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(pathname) : pathname.endsWith(".ts") ? [pathname] : [];
  });
}

describe("backend authentication import boundary", () => {
  it("keeps Better Auth SDK imports inside the authentication module", () => {
    const violations = sourceFiles(sourceRoot).filter((pathname) => {
      const rel = relative(sourceRoot, pathname).replaceAll("\\", "/");
      if (rel.startsWith("modules/auth/")) return false;
      const content = readFileSync(pathname, "utf8");
      return /(?:from\s*|import\s*\()\s*["']better-auth(?:\/[^"']*)?["']/.test(content);
    });
    expect(violations).toEqual([]);
  });

  it("does not expose the Better Auth instance from the public module API", () => {
    const publicApi = readFileSync(join(sourceRoot, "modules/auth/index.ts"), "utf8");
    expect(publicApi).not.toMatch(/export\s*\{[^}]*\bauth\b/);
  });

  it("does not retain old production authentication compatibility paths", () => {
    const violations = sourceFiles(sourceRoot).filter((pathname) => {
      const rel = relative(sourceRoot, pathname).replaceAll("\\", "/");
      if (rel.startsWith("modules/auth/")) return false;
      const content = readFileSync(pathname, "utf8");
      return /(?:from\s*|import\s*\()\s*["'][^"']*\/(?:lib\/auth|lib\/accountLinkingPolicy)["']/.test(content);
    });
    expect(violations).toEqual([]);
  });
});
