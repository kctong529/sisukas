import type { StudyEvent } from "@modules/study-groups";
import type { CalendarInterval } from "../services/calendar/CalendarTime";

/** Source association carried by every calendar entry.
 * courseOfferingId refers to Course.id and Plan.instanceIds entries.
 */
export interface CalendarEntrySource {
  courseOfferingId: string;
  studyGroupId: string;
  /** Human-readable source group name/type, independent of internal identity. */
  studyGroupName?: string;
  studyGroupType?: string;
  /** Source-series identity; not a unique expanded-occurrence identifier. */
  seriesId: string | null;
  /** The original normalized source event, retained for traceability. */
  event: StudyEvent;
}

/**
 * Evidence required before interpreting an interval as a flexible window.
 * Only verified mappings may populate this contract; names and durations alone
 * are not classification evidence.
 */
export interface FlexibleWindowEvidence {
  kind: "verified-source-classification";
  /** Identifies the documented upstream field or mapping rule. */
  sourceField: string;
  /** The verified value used by that mapping. */
  sourceValue: string;
}

interface CalendarEntryBase {
  /** Snapshot-scoped key; null if the identity contract detected a collision. */
  occurrenceKey: string | null;
  /** Validated absolute instants in epoch milliseconds, half-open. */
  interval: CalendarInterval;
  source: CalendarEntrySource;
}

export interface FixedCalendarOccurrence extends CalendarEntryBase {
  kind: "fixed";
}

export interface FlexibleCalendarWindow extends CalendarEntryBase {
  kind: "flexible-window";
  evidence: FlexibleWindowEvidence;
}

/** #137 defines these variants; #138 decides which records to project. */
export type CalendarEntry = FixedCalendarOccurrence | FlexibleCalendarWindow;
