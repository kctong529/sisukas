// src/domain/analytics/intervalOverlap/index.ts

/**
 * Interval Overlap Analytics - Architecture Notes
 *
 * What this module provides
 * -------------------------
 * This module computes interval overlap metrics using a sweep-line algorithm.
 * It returns two complementary outputs:
 *
 * 1) durationByConcurrentMs (a histogram)
 *    - For each concurrency level c, how many milliseconds had exactly c active intervals.
 *    - Great for summary metrics (total overlap time, max concurrency, etc).
 *
 * 2) segments (a timeline decomposition)
 *    - A list of maximal segments [t_i, t_{i+1}) where concurrency is constant.
 *    - This acts as a compact intermediate representation of the schedule.
 *
 * How this feeds weekly heatmaps (conflict intensity)
 * ---------------------------------------------------
 * A weekly heatmap is typically a 2D grid:
 *   - X axis: day-of-week (Mon .. Sun)
 *   - Y axis: time-of-day bins (e.g., 15/30/60 minutes)
 * Each cell stores an "intensity" score.
 *
 * The segments output is designed to be projected into such a grid:
 *   - Each segment has (startMs, endMs, concurrent).
 *   - We convert segment endpoints into local time (Europe/Helsinki),
 *     then accumulate the segment's contribution into the bins it overlaps.
 *
 * Typical intensity functions:
 *   - conflict load: dt * max(0, concurrent - 1)
 *       (counts “extra” events beyond the first; emphasizes conflicts)
 *   - busyness load: dt * concurrent
 *       (shows how packed the schedule is, even with no conflicts)
 *   - amplified conflicts: dt * (concurrent - 1)^2
 *       (makes triple overlaps stand out more than doubles)
 *
 * Why segments (not just histogram)?
 * ---------------------------------
 * durationByConcurrentMs tells us "how much overlap exists" but not "when it occurs".
 * The heatmap needs time localization, which segments preserve.
 *
 * Streaming / memory notes
 * ------------------------
 * If we later want performance optimization:
 * - We can treat segments as a stream and bucket them on-the-fly into a heatmap grid,
 *   without storing all segments (especially useful if there are many intervals).
 *
 * Timezone and week-boundary notes
 * --------------------------------
 * - This module uses epoch milliseconds as an absolute timeline.
 * - Heatmap projection must be done in a chosen timezone and week-frame.
 * - DST weeks can be 23/25 hours locally; decide whether to:
 *     (a) accept uneven bin counts for that week, or
 *     (b) normalize to fixed 7*24h bins using UTC-based bucketing.
 *
 * Separation of concerns
 * ----------------------
 * This module is deliberately timezone-agnostic and "week-agnostic":
 * - It computes overlap on an absolute time axis.
 * - Another module (e.g. src/domain/analytics/heatmap/) should:
 *     - choose timezone/week window
 *     - define bin size and intensity function
 *     - project segments into bins
 */


import type {
  ComputeOptions,
  IntervalInput,
  OverlapAnalytics,
} from "./types";
import { normalizeIntervals } from "./normalize";
import { buildBoundaries, getSpan, sweepBoundaries } from "./sweep";

/**
 * Computes the total duration during which
 * concurrency is at least a given threshold.
 *
 * By default, threshold=2 corresponds to
 * "overlapping intervals".
 */
export function computeTotalOverlapMs(
  durationByConcurrentMs: Record<number, number>,
  threshold = 2
): number {
  let total = 0;

  for (const [k, v] of Object.entries(durationByConcurrentMs)) {
    const c = Number(k);
    if (c >= threshold) total += v;
  }

  return total;
}

/**
 * High-level entry point for interval overlap analytics.
 *
 * This function orchestrates:
 *  1. Input validation and normalization
 *  2. Boundary construction
 *  3. Sweep-line execution
 *  4. Domain-level aggregation of results
 *
 * It is safe to call from controllers, services, or tests.
 */
export function computeOverlapAnalytics(
  intervals: IntervalInput[],
  options: ComputeOptions = {}
): OverlapAnalytics {
  const dropZeroLengthSegments = options.dropZeroLengthSegments ?? true;
  const includeGapsWithinSpan = options.includeGapsWithinSpan ?? false;

  const { normalized, dropped } = normalizeIntervals(intervals);

  if (normalized.length === 0) {
    return {
      totalOverlapMs: 0,
      maxConcurrent: 0,
      durationByConcurrentMs: {},
      segments: [],
      intervalCountInput: intervals.length,
      intervalCountUsed: 0,
      dropped,
    };
  }

  const span = getSpan(normalized);
  const boundaries = buildBoundaries(normalized);

  const sweep = sweepBoundaries(boundaries, span, {
    dropZeroLengthSegments,
    includeGapsWithinSpan,
  });

  return {
    totalOverlapMs: computeTotalOverlapMs(
      sweep.durationByConcurrentMs,
      2
    ),
    maxConcurrent: sweep.maxConcurrent,
    durationByConcurrentMs: sweep.durationByConcurrentMs,
    segments: sweep.segments,
    intervalCountInput: intervals.length,
    intervalCountUsed: normalized.length,
    dropped,
  };
}

/**
 * Convenience helpers for presentation layers.
 */
export function msToMinutes(ms: number): number {
  return ms / 60000;
}

export function msToHours(ms: number): number {
  return ms / 3600000;
}

export * from "./types";
