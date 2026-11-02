import type {
  CalendarEntry,
  FixedCalendarOccurrence,
  FlexibleCalendarWindow,
  FlexibleWindowEvidence,
} from "../models/CalendarEntry";
import type { CalendarIdentifiedOccurrence } from "./CalendarOccurrenceIdentity";

/**
 * Builds a fixed entry from an occurrence previously validated and identified
 * by the #137 temporal and identity utilities. It does not infer classification.
 * A null key is preserved for collisions; the caller must retain diagnostics.
 */
export function defineFixedCalendarOccurrence(
  identified: CalendarIdentifiedOccurrence,
): FixedCalendarOccurrence {
  const { candidate, occurrenceKey } = identified;
  return {
    kind: "fixed",
    occurrenceKey,
    interval: { ...candidate.interval },
    source: {
      courseInstanceId: candidate.courseInstanceId,
      studyGroupId: candidate.studyGroupId,
      seriesId: candidate.event.seriesId ?? null,
      event: candidate.event,
    },
  };
}

/**
 * Builds a flexible entry ONLY when a caller supplies verified classification
 * evidence. Empty evidence fields are rejected. The existence and correctness
 * of a source mapping must be established before callers invoke this helper.
 * No activity-name, location, or duration heuristic is applied here.
 */
export function defineFlexibleCalendarWindow(
  identified: CalendarIdentifiedOccurrence,
  evidence: FlexibleWindowEvidence,
): FlexibleCalendarWindow {
  if (!evidence.sourceField.trim() || !evidence.sourceValue.trim()) {
    throw new Error("Flexible calendar windows require nonempty verified source evidence");
  }
  return { ...defineFixedCalendarOccurrence(identified), kind: "flexible-window", evidence: { ...evidence } };
}

/** Stable, source-independent ordering for resolved entries. */
export function compareCalendarEntries(a: CalendarEntry, b: CalendarEntry): number {
  return a.interval.startMs - b.interval.startMs ||
    a.interval.endMs - b.interval.endMs ||
    (a.occurrenceKey ?? "").localeCompare(b.occurrenceKey ?? "") ||
    a.source.courseInstanceId.localeCompare(b.source.courseInstanceId) ||
    a.source.studyGroupId.localeCompare(b.source.studyGroupId);
}
