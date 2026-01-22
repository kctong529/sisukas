import type {
  DroppedInterval,
  IntervalInput,
  NormalizedInterval,
} from "./types";

/**
 * Validates and normalizes raw ISO input intervals.
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

/**
 * Fast-path validation for already-normalized millisecond intervals.
 *
 * Use this in hot loops (combination enumeration) where parsing ISO repeatedly
 * would dominate runtime.
 *
 * Note:
 * - We keep the same dropped format for consistent diagnostics.
 * - There is no ISO parsing here; it assumes caller provides milliseconds.
 */
export function normalizeIntervalsFromMs(
  intervals: Array<{ startMs: number; endMs: number }>
): {
  normalized: NormalizedInterval[];
  dropped: Array<{ index: number; reason: "invalid-ms" | "end<=start"; value: { startMs: number; endMs: number } }>;
} {
  const dropped: Array<{
    index: number;
    reason: "invalid-ms" | "end<=start";
    value: { startMs: number; endMs: number };
  }> = [];
  const normalized: NormalizedInterval[] = [];

  intervals.forEach((it, index) => {
    const s = it.startMs;
    const e = it.endMs;

    if (!Number.isFinite(s) || !Number.isFinite(e)) {
      dropped.push({ index, reason: "invalid-ms", value: it });
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
