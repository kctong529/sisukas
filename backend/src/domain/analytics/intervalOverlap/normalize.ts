import type {
  DroppedInterval,
  IntervalInput,
  NormalizedInterval,
} from "./types";

/**
 * Validates and normalizes raw input intervals.
 *
 * Responsibilities:
 * - Parse ISO timestamps
 * - Enforce end > start
 * - Convert times to epoch milliseconds
 * - Collect diagnostics for rejected intervals
 *
 * This function performs NO overlap logic.
 */
export function normalizeIntervals(intervals: IntervalInput[]): {
  normalized: NormalizedInterval[];
  dropped: DroppedInterval[];
} {
  const dropped: DroppedInterval[] = [];
  const normalized: NormalizedInterval[] = [];

  intervals.forEach((it, index) => {
    const s = Date.parse(it.start);
    const e = Date.parse(it.end);
    // const s = Number(it.start);
    // const e = Number(it.end);

    if (!Number.isFinite(s) || !Number.isFinite(e)) {
      dropped.push({ index, reason: "invalid-iso", value: it });
      return;
    }

    if (e <= s) {
      dropped.push({ index, reason: "end<=start", value: it });
      return;
    }

    normalized.push({ startMs: s, endMs: e });
  });

  return { normalized, dropped };
}
