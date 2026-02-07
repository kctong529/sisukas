// src/lib/buildInfo.ts
import fs from "node:fs";
import path from "node:path";

function readPackageVersion(): string {
  try {
    // resolves relative to compiled JS location in dist/
    // adjust "../package.json" if your dist structure differs
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    return typeof pkg.version === "string" ? `v${pkg.version}` : "";
  } catch {
    return "";
  }
}

export const buildInfo = Object.freeze({
  service: process.env.SERVICE_NAME ?? "sisukas-backend",
  environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
  version: process.env.APP_VERSION ?? readPackageVersion(),
  commit: process.env.GIT_COMMIT_SHA ?? "",
  buildTime: process.env.BUILD_TIME_ISO ?? "",
  startedAt: new Date(),
});
