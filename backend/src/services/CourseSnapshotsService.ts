// src/services/CourseSnapshotsService.ts
import crypto from "crypto";
import { db } from "../db";
import { courseSnapshots } from "../db/schema";
import { and, eq, isNull, or, gt, sql } from "drizzle-orm";
import type { ResolveResponse, CourseSnapshot } from "../domain/models/CourseSnapshot";

function normalizeCourseCode(code: string): string {
  return code.trim().toUpperCase();
}

// Stable stringify for hashing (good enough for JSON payload hashing)
function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  const stringify = (v: any): any => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return "[Circular]";
    seen.add(v);

    if (Array.isArray(v)) return v.map(stringify);

    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      out[k] = stringify(v[k]);
    }
    return out;
  };

  return JSON.stringify(stringify(value));
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function parseIsoDateString(x: unknown): string | null {
  if (typeof x !== "string") return null;
  // minimal guard; db column is DATE
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return null;
  return x;
}

function pickString(x: unknown): string | null {
  return typeof x === "string" && x.length ? x : null;
}

export class CourseSnapshotsService {
  // TTL policy: extend on every request
  static DEFAULT_TTL_DAYS = 180;

  /**
   * Return non-expired snapshots for a course code (no resolver call).
   */
  static async getSnapshotsByCourseCode(courseCode: string): Promise<CourseSnapshot[]> {
    const code = normalizeCourseCode(courseCode);

    // Treat expiresAt null as "never expires"
    const rows = await db
      .select()
      .from(courseSnapshots)
      .where(
        and(
          eq(courseSnapshots.courseCode, code),
          or(isNull(courseSnapshots.expiresAt), gt(courseSnapshots.expiresAt, new Date()))
        )
      );

    return rows as unknown as CourseSnapshot[];
  }

  /**
   * Store resolve response matches as snapshots.
   * Upserts by (courseCode, curId). Increments requestedCount and extends TTL.
   */
  static async upsertFromResolveResponse(
    userId: string,
    resolve: ResolveResponse,
    opts?: { source?: "user_request" | "pipeline_backfill"; ttlDays?: number }
  ): Promise<CourseSnapshot[]> {
    const code = normalizeCourseCode(resolve.courseCode);
    const source = opts?.source ?? "user_request";
    const ttlDays = opts?.ttlDays ?? this.DEFAULT_TTL_DAYS;

    // No matches => nothing to store
    if (!resolve.matches || resolve.matches.length === 0) {
      return [];
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

    // Upsert each match (CUR payload)
    for (const m of resolve.matches) {
      const payload = (m ?? {}) as Record<string, unknown>;

      const courseId = pickString(payload["id"]);
      if (!courseId) continue;

      const courseUnitId = pickString(payload["courseUnitId"]);
      const startDate = parseIsoDateString(payload["startDate"]);
      const endDate = parseIsoDateString(payload["endDate"]);

      const snapshotHash = sha256Hex(stableStringify(payload));

      // Postgres ON CONFLICT needs insert().onConflictDoUpdate(...)
      await db
        .insert(courseSnapshots)
        .values({
          courseCode: code,
          courseId,
          courseUnitId: courseUnitId ?? undefined,
          startDate: startDate ?? undefined,
          endDate: endDate ?? undefined,

          payload,
          snapshotHash,

          resolverStatus: resolve.status,
          source,

          requestedCount: 1,
          firstRequestedAt: now,
          lastRequestedAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [courseSnapshots.courseCode, courseSnapshots.courseId],
          set: {
            // If hash changes, update payload+hash; otherwise harmless
            payload,
            snapshotHash,

            resolverStatus: resolve.status,
            source,

            requestedCount: sql`${courseSnapshots.requestedCount} + 1`,
            lastRequestedAt: now,

            // Extend TTL
            expiresAt,
            updatedAt: now,
          },
        });
    }

    return this.getSnapshotsByCourseCode(code);
  }

  /**
   * Snapshot presence signals for UI.
   *
   * - hasAny: at least one snapshot row exists for this code (expired or not)
   * - hasLive: at least one non-expired snapshot exists for this code
   * - totalCount: total rows (expired + live)
   * - liveCount: non-expired rows
   */
  static async getSnapshotStatusByCourseCode(courseCode: string): Promise<{
    courseCode: string;
    hasAny: boolean;
    hasLive: boolean;
    totalCount: number;
    liveCount: number;
    oldestCreatedAt: Date | null;
    newestCreatedAt: Date | null;
  }> {
    const code = normalizeCourseCode(courseCode);
    const now = new Date();

    // total count (includes expired)
    const total = await db
      .select({
        totalCount: sql<number>`count(*)`,
        oldestCreatedAt: sql<Date | null>`min(${courseSnapshots.createdAt})`,
        newestCreatedAt: sql<Date | null>`max(${courseSnapshots.createdAt})`,
      })
      .from(courseSnapshots)
      .where(eq(courseSnapshots.courseCode, code));

    const totalCount = Number(total[0]?.totalCount ?? 0);

    // live count (non-expired OR expiresAt is null)
    const live = await db
      .select({
        liveCount: sql<number>`count(*)`,
      })
      .from(courseSnapshots)
      .where(
        and(
          eq(courseSnapshots.courseCode, code),
          or(isNull(courseSnapshots.expiresAt), gt(courseSnapshots.expiresAt, now)),
        ),
      );

    const liveCount = Number(live[0]?.liveCount ?? 0);

    return {
      courseCode: code,
      hasAny: totalCount > 0,
      hasLive: liveCount > 0,
      totalCount,
      liveCount,
      oldestCreatedAt: total[0]?.oldestCreatedAt ?? null,
      newestCreatedAt: total[0]?.newestCreatedAt ?? null,
    };
  }
}
