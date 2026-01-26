// // src/domain/analytics/intervalOverlap/sweep.ts

import type {
  Boundary,
  NormalizedInterval,
  Segment,
  SweepResult,
} from "./types";

/**
 * Converts normalized intervals into boundary events
 * used by the sweep-line algorithm.
 *
 * Each interval produces:
 *   - (start, +1)
 *   - (end, -1)
 *
 * Boundaries are sorted so that:
 *   - earlier timestamps come first
 *   - end events are processed before start events
 *     at the same timestamp
 *
 * This enforces half-open interval semantics: [start, end)
 */
export function buildBoundaries(
  normalized: NormalizedInterval[]
): Array<Boundary & { id: string }> {
  const points: Array<Boundary & { id: string }> = [];

  for (const it of normalized) {
    points.push({ t: it.startMs, d: 1, id: it.id });
    points.push({ t: it.endMs, d: -1, id: it.id });
  }

  points.sort((a, b) => (a.t - b.t) || (a.d - b.d));
  return points;
}

/**
 * Computes the outer time span covered by the input intervals.
 *
 * Used to:
 * - optionally include concurrency=0 gaps
 * - know the global analysis window
 */
export function getSpan(
  normalized: NormalizedInterval[]
): { minStartMs: number; maxEndMs: number } {
  let minStartMs = Number.POSITIVE_INFINITY;
  let maxEndMs = Number.NEGATIVE_INFINITY;

  for (const it of normalized) {
    if (it.startMs < minStartMs) minStartMs = it.startMs;
    if (it.endMs > maxEndMs) maxEndMs = it.endMs;
  }

  return { minStartMs, maxEndMs };
}

/**
 * Core sweep-line algorithm.
 *
 * Walks over sorted boundary events and:
 * - tracks the number of active intervals
 * - accumulates duration per concurrency level (histogram)
 * - emits maximal constant-concurrency segments (timeline decomposition)
 * - records the maximum concurrency seen
 *
 * The emitted segments are a deliberate architectural output:
 * - They preserve "where" overlaps occur, enabling projections into heatmaps.
 * - They are compact: O(number of boundary changes), not O(time resolution).
 *
 * This function is intentionally generic and
 * does not apply domain-specific interpretations
 * (e.g. "overlap means >= 2").
 */
export function sweepBoundaries(
  boundaries: Array<{
    t: number;
    d: 1 | -1;
    id: string;  // Track which interval caused this boundary
  }>,
  span: { minStartMs: number; maxEndMs: number },
  opts: {
    dropZeroLengthSegments: boolean;
    includeGapsWithinSpan: boolean;
  }
): SweepResult {
  const { dropZeroLengthSegments, includeGapsWithinSpan } = opts;

  const durationByConcurrentMs: Record<number, number> = {};
  const segments: Segment[] = [];

  let active = 0;
  let maxConcurrent = 0;
  const activeIds = new Set<string>();

  // If including gaps, we start tracking at the earliest start.
  let prevT: number | null = includeGapsWithinSpan ? span.minStartMs : null;

  for (const b of boundaries) {
    const curT = b.t;

    if (prevT !== null && curT > prevT) {
      const dt = curT - prevT;

      durationByConcurrentMs[active] =
        (durationByConcurrentMs[active] ?? 0) + dt;

      if (!dropZeroLengthSegments || dt > 0) {
        segments.push({
          startMs: prevT,
          endMs: curT,
          concurrent: active,
          concurrentIds: Array.from(activeIds),
        });
      }
    }

    if (b.d === 1) {
      activeIds.add(b.id);
    } else {
      activeIds.delete(b.id);
    }

    active += b.d;
    if (active > maxConcurrent) maxConcurrent = active;
    prevT = curT;
  }

  // Optionally close the timeline to the end of the span.
  if (includeGapsWithinSpan && prevT !== null && span.maxEndMs > prevT) {
    const dt = span.maxEndMs - prevT;
    durationByConcurrentMs[active] =
      (durationByConcurrentMs[active] ?? 0) + dt;

    if (!dropZeroLengthSegments || dt > 0) {
      segments.push({
        startMs: prevT,
        endMs: span.maxEndMs,
        concurrent: active,
        concurrentIds: Array.from(activeIds),
      });
    }
  }

  return {
    durationByConcurrentMs,
    segments,
    maxConcurrent,
    minStartMs: span.minStartMs,
    maxEndMs: span.maxEndMs,
  };
}
