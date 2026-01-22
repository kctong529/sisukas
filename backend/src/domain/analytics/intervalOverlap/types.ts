/**
 * Shared types for interval overlap analytics.
 *
 * This module contains only data shapes — no logic.
 * It defines the vocabulary used by the sweep-line algorithm.
 */

export type ISODateTime = string;

/**
 * Raw interval as provided by callers (API, domain logic, etc).
 * Times are ISO strings with timezone information.
 */
export type IntervalInput = {
  start: ISODateTime;
  end: ISODateTime;
};

/**
 * Interval after validation and normalization.
 * All times are converted to epoch milliseconds.
 */
export type NormalizedInterval = {
  startMs: number;
  endMs: number;
};

/**
 * Description of an input interval that was rejected.
 * Used for diagnostics and debugging.
 */
export type DroppedInterval = {
  index: number;
  reason: "invalid-iso" | "end<=start";
  value: IntervalInput;
};

/**
 * A boundary event used by the sweep-line algorithm.
 * d = +1 means an interval starts
 * d = -1 means an interval ends
 */
export type Boundary = {
  t: number;      // timestamp in milliseconds
  d: 1 | -1;      // delta to active interval count
};

/**
 * A maximal time segment during which the number of
 * concurrent intervals is constant.
 *
 * This is intentionally included even though a histogram
 * alone could summarize overlap, because segments are the
 * key intermediate representation for visualization:
 *
 * - Heatmaps: bucket segments into (weekday, time-bin) cells
 * - Timelines: render concurrency bands over time
 * - Debugging: inspect exactly where peaks happen
 *
 * Intervals are half-open: [startMs, endMs)
 */
export type Segment = {
  startMs: number;
  endMs: number;
  concurrent: number;
};

/**
 * Options controlling how the sweep behaves.
 */
export type ComputeOptions = {
  /**
   * If true, segments with zero duration are not emitted.
   * Recommended default: true.
   */
  dropZeroLengthSegments?: boolean;

  /**
   * If true, emit concurrency=0 segments between the
   * earliest start and latest end.
   *
   * Useful for heatmaps that expect continuous coverage.
   */
  includeGapsWithinSpan?: boolean;
};

/**
 * Raw result of the sweep-line algorithm.
 * This is intentionally low-level and un-opinionated.
 */
export type SweepResult = {
  durationByConcurrentMs: Record<number, number>;
  segments: Segment[];
  maxConcurrent: number;
  minStartMs: number;
  maxEndMs: number;
};

/**
 * Final, domain-level analytics result returned to callers.
 */
export type OverlapAnalytics = {
  totalOverlapMs: number;
  maxConcurrent: number;
  durationByConcurrentMs: Record<number, number>;
  segments: Segment[];

  intervalCountInput: number;
  intervalCountUsed: number;
  dropped: DroppedInterval[];
};
