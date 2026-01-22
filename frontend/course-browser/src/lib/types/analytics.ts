// src/lib/types/analytics.ts
//
// Frontend types for analytics responses.
// These mirror what the backend sends in ComputeSchedulePairsResponse.

/**
 * A maximal time segment where concurrency is constant.
 * 
 * Represents one "row" in the sweep-line decomposition of a schedule.
 * Used by ScheduleHeatmap to visualize conflict intensity over time.
 */
export interface Segment {
  startMs: number;    // Epoch milliseconds (absolute timeline)
  endMs: number;      // Epoch milliseconds
  concurrent: number; // How many events overlap in this segment
  concurrentIds: string[];
}

/**
 * Summary of overlap metrics: for each concurrency level, duration in that state.
 * 
 * Example:
 *   { 1: 28800000, 2: 3600000, 3: 1800000 }
 *   = 8 hours at concurrency 1
 *   = 1 hour at concurrency 2
 *   = 30 min at concurrency 3
 */
export type DurationByConcurrentMs = Record<number, number>;

/**
 * One schedule candidate from the analytics API response.
 * 
 * Contains:
 * - How good this schedule is (overlap metrics)
 * - What courses/study groups were chosen (selection)
 * - Timeline decomposition for visualization (segments)
 */
export interface ScheduleCandidate {
  score: number;
  totalOverlapMs: number;
  maxConcurrent: number;

  /**
   * The actual choices made: which study group for each block.
   * Used to display the course details table.
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
   * Timeline decomposition (segments where concurrency is constant).
   * Used by ScheduleHeatmap to visualize conflict intensity.
   */
  segments: Segment[];

  /**
   * Optional: histogram of durations by concurrency level.
   */
  durationByConcurrentMs?: DurationByConcurrentMs;
}

/**
 * Complete response from /api/analytics/schedule-pairs/topk
 */
export interface AnalyticsResponse {
  top: ScheduleCandidate[];

  evaluated: number;
  totalPossible: number;
  capped: boolean;
  capCombinations: number;

  warnings: Array<{
    code: "CAP_REACHED" | "EMPTY_INPUT" | "INVALID_INPUT";
    message: string;
  }>;
}