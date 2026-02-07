// src/routes/health.ts
import type { Request, Response } from "express";
import type { Pool } from "pg";
import { buildInfo } from "../lib/buildInfo";

type Check = {
  name: string;
  status: "ok" | "error";
  latencyMs?: number;
  details?: Record<string, unknown>;
};

const splitCsv = (v: string) =>
  v.split(",").map((s) => s.trim()).filter(Boolean);

export function makeHealthHandler(pool: Pool) {
  return async (_req: Request, res: Response) => {
    const checks: Check[] = [];

    // -----------------------------
    // Dependency checks
    // -----------------------------

    const t0 = Date.now();
    try {
      const r = await pool.query("SELECT NOW() as now");
      checks.push({
        name: "database",
        status: "ok",
        latencyMs: Date.now() - t0,
        details: { dbTime: r.rows[0]?.now },
      });
    } catch (e) {
      checks.push({
        name: "database",
        status: "error",
        latencyMs: Date.now() - t0,
        details: {
          error: e instanceof Error ? e.message : "Unknown error",
        },
      });
    }

    // -----------------------------
    // Aggregate status
    // -----------------------------

    const allOk = checks.every((c) => c.status === "ok");
    const anyOk = checks.some((c) => c.status === "ok");

    const status: "ok" | "degraded" | "error" =
      allOk ? "ok" : anyOk ? "degraded" : "error";

    // -----------------------------
    // Public (safe) runtime config
    // -----------------------------

    const corsOrigins = process.env.CORS_ORIGINS_EFFECTIVE
      ? splitCsv(process.env.CORS_ORIGINS_EFFECTIVE)
      : process.env.CORS_ORIGINS
        ? splitCsv(process.env.CORS_ORIGINS)
        : [];

    // -----------------------------
    // Response
    // -----------------------------

    const body = {
      status,
      service: buildInfo.service,
      environment: buildInfo.environment,
      version: buildInfo.version,
      commit: buildInfo.commit,
      buildTime: buildInfo.buildTime,
      startedAt: buildInfo.startedAt.toISOString(),
      uptimeSec: Math.floor(
        (Date.now() - buildInfo.startedAt.getTime()) / 1000
      ),
      checks,
      publicConfig: {
        frontendUrl: process.env.FRONTEND_URL ?? "",
        backendUrl: process.env.BACKEND_URL ?? "",
        corsOrigins,
      },
    };

    res.status(allOk ? 200 : 503).json(body);
  };
}
