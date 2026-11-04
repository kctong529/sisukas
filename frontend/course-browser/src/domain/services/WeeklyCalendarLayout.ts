import type { CalendarEntry } from "../models/CalendarEntry";
import { resolveHelsinkiWeek } from "./WeeklyCalendarTime";
import { segmentWeek } from "./WeeklyCalendarSegmentation";
import { assignOverlapLanes } from "./WeeklyCalendarOverlap";
import type { WeeklyCalendarSegment, WeeklyCalendarLayoutResult } from "./WeeklyCalendarLayoutTypes";

export type {
  WeeklyCalendarSegment,
  WeeklyCalendarOverlapGroup,
  WeeklyCalendarLayoutDiagnostic,
  WeeklyCalendarLayoutResult,
} from "./WeeklyCalendarLayoutTypes";

function compareFinalSegments(a: WeeklyCalendarSegment, b: WeeklyCalendarSegment): number {
  return a.dayIndex - b.dayIndex || a.interval.startMs - b.interval.startMs ||
    a.interval.endMs - b.interval.endMs || a.id.localeCompare(b.id);
}

/**
 * Produce a renderer-independent layout for one Helsinki-local calendar week.
 * Flexible windows remain outside this layout contract (issue #100).
 */
export function layoutCalendarWeek(
  entries: readonly CalendarEntry[],
  weekStart: string,
): WeeklyCalendarLayoutResult {
  const { days, boundaries } = resolveHelsinkiWeek(weekStart);
  const { segments, diagnostics } = segmentWeek(entries, days, boundaries);
  const overlapGroups = assignOverlapLanes(segments, days);
  segments.sort(compareFinalSegments);
  return { weekStart, days, segments, overlapGroups, diagnostics };
}
