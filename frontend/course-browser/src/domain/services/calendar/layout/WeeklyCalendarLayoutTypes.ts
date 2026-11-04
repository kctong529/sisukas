import type { FixedCalendarOccurrence } from "@domain/models/CalendarEntry";
import type { CalendarInterval } from "../CalendarTime";

/** Layout coordinates are Helsinki wall-clock minutes, not elapsed minutes. */
export interface WeeklyCalendarSegment {
  /** Snapshot-scoped identity; duplicates receive a deterministic ordinal. */
  id: string;
  entry: FixedCalendarOccurrence;
  dayIndex: number;
  localDate: string;
  /** Absolute clipped boundaries; the end is exclusive. */
  interval: CalendarInterval;
  /** Wall-clock minutes in [0, 1440]; seconds are retained as fractions. */
  startMinute: number;
  endMinute: number;
  /** Offset at the segment's first and last occupied instants, in minutes. */
  startUtcOffsetMinutes: number;
  endUtcOffsetMinutes: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  /** Cancelled/excluded entries render but never occupy a conflict lane. */
  conflictEligible: boolean;
  /** Null means the segment is outside occupied-time conflict grouping. */
  overlapGroupId: string | null;
  columnIndex: number;
  columnCount: number;
}

export interface WeeklyCalendarOverlapGroup {
  id: string;
  dayIndex: number;
  /** All eligible segments in this connected overlap component. */
  segmentIds: string[];
  maxConcurrency: number;
  /** Renderer may disclose overflow rather than display all lanes at once. */
  supportsProgressiveDisclosure: boolean;
}

export interface WeeklyCalendarLayoutDiagnostic {
  code: "invalid_interval" | "unpositionable_segment";
  message: string;
  /** Identifies one supplied occurrence when available. */
  entry?: FixedCalendarOccurrence;
}

export interface WeeklyCalendarLayoutResult {
  weekStart: string;
  /** Seven local ISO dates, Monday through Sunday. */
  days: string[];
  segments: WeeklyCalendarSegment[];
  overlapGroups: WeeklyCalendarOverlapGroup[];
  diagnostics: WeeklyCalendarLayoutDiagnostic[];
}

