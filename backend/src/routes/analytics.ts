// backend/src/routes/analytics.ts
//
// Analytics routes (transport layer)
//
// This file intentionally owns:
// - HTTP request/response DTOs
// - validation + defaults
// - mapping nested frontend payloads -> domain "choices" model
// - returning warnings (capped / evaluated / totalPossible)

import { Router } from "express";

import type { ChoiceEntity } from "../domain/analytics/intervalOverlap/choices";
import { searchTopKCombinations } from "../domain/analytics/intervalOverlap/choices";

const router = Router();

/**
 * --- Request / Response models (HTTP-facing) ---
 * These are intentionally defined in the route layer.
 */

export type ComputeSchedulePairsRequest = {
  /**
   * Return the best K combinations (lower score is better).
   * Defaults to 20.
   */
  topK?: number;

  /**
   * Hard safety cap for enumeration to prevent accidental blow-ups.
   * Defaults to 100_000 (matches domain default).
   */
  capCombinations?: number;

  /**
   * Scoring mode.
   * - minOverlap: minimize totalOverlapMs
   * - minMaxConcurrentThenOverlap: minimize maxConcurrent first, then overlap
   */
  scoreMode?: "minOverlap" | "minMaxConcurrentThenOverlap";

  /**
   * What extra fields to include in the response.
   * Keep segments off by default; they can get large.
   */
  include?: {
    durationByConcurrentMs?: boolean;
    segments?: boolean;
  };

  /**
   * The full schedule input.
   */
  courseInstances: CourseInstanceInput[];
};

export type CourseInstanceInput = {
  courseInstanceId: string;
  courseCode: string;
  name: string;
  blocks: BlockInput[];
};

export type BlockInput = {
  blockId: string;
  name: string;
  studyGroups: StudyGroupInput[];
};

export type StudyGroupInput = {
  studyGroupId: string;
  name: string;
  events: StudyEventInput[];
};

export type StudyEventInput = {
  eventId: string;
  start: string; // ISO timestamp (should include timezone, e.g. ...Z or +02:00)
  end: string; // ISO timestamp (should include timezone)
  location?: string;
};

export type ComputeSchedulePairsResponse = {
  top: Array<{
    score: number;

    totalOverlapMs: number;
    maxConcurrent: number;

    /**
     * One chosen study group per block (entity).
     * This is the "schedule pair" output we can project into UI.
     */
    selection: Array<{
      courseInstanceId: string;
      courseCode: string;
      courseName: string;

      blockId: string;
      blockName: string;

      studyGroupId: string;
      studyGroupName: string;
    }>;

    /**
     * Optional heavy fields.
     */
    durationByConcurrentMs?: Record<number, number>;
    segments?: Array<{
      startMs: number;
      endMs: number;
      concurrent: number;
      concurrentIds: string[];
    }>;
  }>;

  evaluated: number;
  totalPossible: number;
  capped: boolean;
  capCombinations: number;

  warnings: Array<{
    code: "CAP_REACHED" | "EMPTY_INPUT" | "INVALID_INPUT";
    message: string;
  }>;
};

/**
 * --- Internal helper types / utilities ---
 */

type EntityMeta = {
  courseInstanceId: string;
  courseCode: string;
  courseName: string;
  blockId: string;
  blockName: string;
};

type OptionMeta = {
  studyGroupId: string;
  studyGroupName: string;
};

/**
 * Basic runtime type guard helpers (kept lightweight).
 */
function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function asNumber(x: unknown): number | undefined {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  return undefined;
}

function asString(x: unknown): string | undefined {
  if (typeof x === "string") return x;
  return undefined;
}

function clampInt(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(x)));
}

/**
 * Compile the nested schedule request into the domain "choices" model.
 *
 * Mapping:
 * - Entity = a block (within a course instance)
 * - Option = a study group within that block
 * - Interval list = that study group's events
 *
 * We also build meta lookups so we can convert domain selections back into
 * human-friendly response objects without the frontend re-joining names.
 */
function compileScheduleChoices(input: ComputeSchedulePairsRequest): {
  entities: ChoiceEntity[];
  entityMetaById: Map<string, EntityMeta>;
  optionMetaById: Map<string, OptionMeta>;
} {
  const entities: ChoiceEntity[] = [];
  const entityMetaById = new Map<string, EntityMeta>();
  const optionMetaById = new Map<string, OptionMeta>();

  for (const ci of input.courseInstances) {
    for (const block of ci.blocks) {
      // Make entity IDs unambiguous across course instances.
      const entityId = `${ci.courseInstanceId}:${block.blockId}`;

      const entityMeta: EntityMeta = {
        courseInstanceId: ci.courseInstanceId,
        courseCode: ci.courseCode,
        courseName: ci.name,
        blockId: block.blockId,
        blockName: block.name,
      };
      entityMetaById.set(entityId, entityMeta);

      const options = block.studyGroups.map((sg) => {
        // Make option IDs unique across all entities (helps debugging).
        const optionId = `${entityId}:${sg.studyGroupId}`;

        optionMetaById.set(optionId, {
          studyGroupId: sg.studyGroupId,
          studyGroupName: sg.name,
        });

        return {
          id: optionId,
          intervals: sg.events.map((ev) => ({
            id: ev.eventId,
            start: ev.start,
            end: ev.end,
          })),
        };
      });

      entities.push({ id: entityId, options });
    }
  }

  return { entities, entityMetaById, optionMetaById };
}

/**
 * Score function selection.
 *
 * - minOverlap: totalOverlapMs only
 * - minMaxConcurrentThenOverlap: lexicographic (maxConcurrent first)
 *
 * The large multiplier ensures maxConcurrent dominates overlap.
 */
function buildScoreFn(
  scoreMode: ComputeSchedulePairsRequest["scoreMode"] | undefined
) {
  if (scoreMode === "minMaxConcurrentThenOverlap") {
    return (a: { maxConcurrent: number; totalOverlapMs: number }) =>
      a.maxConcurrent * 1_000_000_000_000 + a.totalOverlapMs;
  }
  // Default: minimize overlap only
  return (a: { totalOverlapMs: number }) => a.totalOverlapMs;
}

/**
 * --- Route handlers ---
 *
 * POST /api/analytics/schedule-pairs/topk
 *
 * This endpoint is designed to be called from the LEGO view:
 * - frontend sends courseInstances -> blocks -> studyGroups -> events
 * - backend returns top-K combinations and overlap metrics
 */
router.post("/schedule-pairs/topk", (req, res) => {
  try {
    if (!isObject(req.body)) {
      const out: ComputeSchedulePairsResponse = {
        top: [],
        evaluated: 0,
        totalPossible: 0,
        capped: false,
        capCombinations: 100_000,
        warnings: [
          {
            code: "INVALID_INPUT",
            message: "Request body must be a JSON object.",
          },
        ],
      };
      return res.status(400).json(out);
    }

    const body = req.body as Partial<ComputeSchedulePairsRequest>;

    const topK = clampInt(asNumber(body.topK) ?? 20, 1, 200);
    const capCombinations = clampInt(
      asNumber(body.capCombinations) ?? 100_000,
      1,
      5_000_000 // safety upper bound; tune as you like
    );

    const scoreMode = body.scoreMode ?? "minOverlap";
    const include = body.include ?? {};
    const includeHistogram = !!include.durationByConcurrentMs;
    const includeSegments = !!include.segments;

    const courseInstances = Array.isArray(body.courseInstances)
      ? (body.courseInstances as CourseInstanceInput[])
      : [];

    if (courseInstances.length === 0) {
      const out: ComputeSchedulePairsResponse = {
        top: [],
        evaluated: 0,
        totalPossible: 0,
        capped: false,
        capCombinations,
        warnings: [
          {
            code: "EMPTY_INPUT",
            message: "No courseInstances provided.",
          },
        ],
      };
      return res.status(200).json(out);
    }

    const request: ComputeSchedulePairsRequest = {
      topK,
      capCombinations,
      scoreMode,
      include: { durationByConcurrentMs: includeHistogram, segments: includeSegments },
      courseInstances,
    };

    const { entities, entityMetaById, optionMetaById } =
      compileScheduleChoices(request);

    // If there are no blocks/entities or some block has zero options,
    // totalPossible becomes 0 and enumeration yields nothing.
    const scoreFn = buildScoreFn(scoreMode);

    const domainResult = searchTopKCombinations(entities, {
      k: topK,
      capCombinations,
      scoreFn: (analytics, selection) =>
        // Domain scoreFn signature includes selection; we ignore it here
        // but keep the signature for future tie-breakers.
        scoreFn(analytics),
    });

    const warnings: ComputeSchedulePairsResponse["warnings"] = [];

    if (domainResult.totalPossible === 0) {
      warnings.push({
        code: "EMPTY_INPUT",
        message:
          "No valid combinations: ensure each block has at least one study group.",
      });
    }

    if (domainResult.capped) {
      warnings.push({
        code: "CAP_REACHED",
        message: `Combination search capped at ${domainResult.capCombinations} of ${domainResult.totalPossible} possible combinations.`,
      });
    }

    const top: ComputeSchedulePairsResponse["top"] = domainResult.top.map(
      (r) => {
        const selection = r.selection.optionIdByEntity.map((optionId) => {
          // optionId is `${courseInstanceId}:${blockId}:${studyGroupId}`
          // but we stored entityId in optionId prefix, so we can recover entityId.
          // entityId is `${courseInstanceId}:${blockId}`
          const lastColon = optionId.lastIndexOf(":");
          const entityId = optionId.slice(0, lastColon);

          const eMeta = entityMetaById.get(entityId);
          const oMeta = optionMetaById.get(optionId);

          // If something is missing, still return a safe record.
          return {
            courseInstanceId: eMeta?.courseInstanceId ?? "unknown",
            courseCode: eMeta?.courseCode ?? "unknown",
            courseName: eMeta?.courseName ?? "unknown",
            blockId: eMeta?.blockId ?? "unknown",
            blockName: eMeta?.blockName ?? "unknown",
            studyGroupId: oMeta?.studyGroupId ?? "unknown",
            studyGroupName: oMeta?.studyGroupName ?? "unknown",
          };
        });

        const out: ComputeSchedulePairsResponse["top"][number] = {
          score: r.score,
          totalOverlapMs: r.analytics.totalOverlapMs,
          maxConcurrent: r.analytics.maxConcurrent,
          selection,
        };

        if (includeHistogram) {
          out.durationByConcurrentMs = r.analytics.durationByConcurrentMs;
        }
        if (includeSegments) {
          out.segments = r.analytics.segments.map((s) => ({
            startMs: s.startMs,
            endMs: s.endMs,
            concurrent: s.concurrent,
            concurrentIds: s.concurrentIds,
          }));
        }

        return out;
      }
    );

    const out: ComputeSchedulePairsResponse = {
      top,
      evaluated: domainResult.evaluated,
      totalPossible: domainResult.totalPossible,
      capped: domainResult.capped,
      capCombinations: domainResult.capCombinations,
      warnings,
    };

    return res.status(200).json(out);
  } catch (err) {
    // Keep error responses simple; do not leak internals.
    const out: ComputeSchedulePairsResponse = {
      top: [],
      evaluated: 0,
      totalPossible: 0,
      capped: false,
      capCombinations: 100_000,
      warnings: [
        {
          code: "INVALID_INPUT",
          message: "Unexpected server error while computing analytics.",
        },
      ],
    };
    return res.status(500).json(out);
  }
});

export default router;