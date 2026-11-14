import { parseOffsetInstant } from "@domain/services/calendar/CalendarTime";
import { segmentWeek } from "@domain/services/calendar/layout/WeeklyCalendarSegmentation";
import { resolveHelsinkiWeek } from "@domain/services/calendar/layout/WeeklyCalendarTime";

import type { FixedCalendarOccurrence } from "@domain/models/CalendarEntry";

export const NORMAL_WEEK = "2026-11-02";

export function instant(iso: string): number {
  const value = parseOffsetInstant(iso);
  if (value === null) throw new Error(`Invalid test fixture: ${iso}`);
  return value;
}

export function fixed(
  key: string | null,
  start: string,
  end: string,
  options: { group?: string; cancelled?: boolean; excluded?: boolean } = {},
): FixedCalendarOccurrence {
  return {
    kind: "fixed",
    occurrenceKey: key,
    interval: { startMs: instant(start), endMs: instant(end) },
    source: {
      courseOfferingId: "offering",
      studyGroupId: options.group ?? "group",
      seriesId: "series",
      event: {
        id: key ?? "collision",
        start,
        end,
        startIso: start,
        endIso: end,
        cancelled: options.cancelled ?? false,
        excluded: options.excluded ?? false,
        locationIds: [],
        locations: [],
      },
    },
  };
}

export function mondaySegments(entries: FixedCalendarOccurrence[], monday = NORMAL_WEEK) {
  const { days, boundaries } = resolveHelsinkiWeek(monday);
  return { ...segmentWeek(entries, days, boundaries), days, boundaries };
}

export function at(hour: number, minute = 0): string {
  return `2026-11-02T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+02:00`;
}
