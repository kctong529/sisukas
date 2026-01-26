// src/domain/analytics/intervalOverlap/choices/evaluate.ts
import type { ComputeOptions, OverlapAnalytics } from "../types";
import type { NormalizedInterval } from "../types";
import type { CombinationSelection, NormalizedChoiceEntity } from "./types";

import { buildBoundaries, getSpan, sweepBoundaries } from "../sweep";
import { computeTotalOverlapMs } from "../index";

/**
 * Compute overlap analytics directly from ms-normalized intervals.
 * This avoids ISO parsing in the hot loop.
 */
export function computeOverlapAnalyticsFromMs(
  normalizedIntervals: NormalizedInterval[],
  options: ComputeOptions = {}
): OverlapAnalytics {
  const dropZeroLengthSegments = options.dropZeroLengthSegments ?? true;
  const includeGapsWithinSpan = options.includeGapsWithinSpan ?? false;

  if (normalizedIntervals.length === 0) {
    return {
      totalOverlapMs: 0,
      maxConcurrent: 0,
      durationByConcurrentMs: {},
      segments: [],
      intervalCountInput: 0,
      intervalCountUsed: 0,
      dropped: [],
    };
  }

  const span = getSpan(normalizedIntervals);
  const boundaries = buildBoundaries(normalizedIntervals);

  const sweep = sweepBoundaries(boundaries, span, {
    dropZeroLengthSegments,
    includeGapsWithinSpan,
  });

  return {
    totalOverlapMs: computeTotalOverlapMs(sweep.durationByConcurrentMs, 2),
    maxConcurrent: sweep.maxConcurrent,
    durationByConcurrentMs: sweep.durationByConcurrentMs,
    segments: sweep.segments,
    intervalCountInput: normalizedIntervals.length,
    intervalCountUsed: normalizedIntervals.length,
    dropped: [],
  };
}

/**
 * Flatten selected options into one interval list for evaluation.
 * Kept separate so we can later optimize allocations (reuse buffers).
 */
export function flattenSelectionIntervals(
  entities: NormalizedChoiceEntity[],
  selection: CombinationSelection
): NormalizedInterval[] {
  const out: NormalizedInterval[] = [];
  for (let i = 0; i < entities.length; i++) {
    const optIdx = selection.optionIndexByEntity[i]!;
    const chosen = entities[i]!.options[optIdx]!;
    for (const iv of chosen.normalized) out.push(iv);
  }
  return out;
}
