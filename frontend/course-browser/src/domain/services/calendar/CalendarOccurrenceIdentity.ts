import type { StudyEvent } from "@domain/models/StudyEvent";
import type {
  CalendarDiagnostic,
  CalendarSourceContext,
} from "@domain/models/CalendarDiagnostic";
import type { CalendarInterval } from "./CalendarTime";

/** The context which scopes a source event to one offering and study group. */
export interface CalendarOccurrenceCandidate {
  courseOfferingId: string;
  studyGroupId: string;
  /** Optional for independently constructed candidates and legacy fixtures. */
  studyGroupName?: string;
  studyGroupType?: string;
  event: StudyEvent;
  /** Validated absolute times, obtained from resolveCalendarTime(). */
  interval: CalendarInterval;
}

/** Null means the candidate's identity is unresolved due to a collision. */
export interface CalendarIdentifiedOccurrence {
  candidate: CalendarOccurrenceCandidate;
  occurrenceKey: string | null;
}

export interface CalendarIdentityResult {
  occurrences: CalendarIdentifiedOccurrence[];
  diagnostics: CalendarDiagnostic[];
}

function sourceOf(candidate: CalendarOccurrenceCandidate): CalendarSourceContext {
  return {
    courseOfferingId: candidate.courseOfferingId,
    studyGroupId: candidate.studyGroupId,
    seriesId: candidate.event.seriesId ?? null,
  };
}

/**
 * Builds a deterministic snapshot-scoped key from a validated event.
 *
 * Identity:
 * 1. Scope the key to the course offering and study group.
 * 2. Prefer the source series ID and authoritative occurrence start instant.
 * 3. Without a source series ID, use a namespaced fallback composed of the
 *    authoritative interval, sorted room IDs, status and source notice.
 * 4. Encode fields as JSON arrays to avoid separator/escaping collisions.
 *
 * The fallback is not an assertion of upstream identity. Changes to source
 * attributes or rescheduling may change either kind of key. Duplicate keys
 * must be checked with identifyCalendarOccurrences() before use for rendering.
 */
export function deriveCalendarOccurrenceKey(
  candidate: CalendarOccurrenceCandidate,
): string {
  const { courseOfferingId, studyGroupId, event, interval } = candidate;
  const context = [courseOfferingId, studyGroupId];
  if (event.seriesId) {
    return JSON.stringify(["series", ...context, event.seriesId, interval.startMs]);
  }
  return JSON.stringify([
    "fallback",
    ...context,
    interval.startMs,
    interval.endMs,
    [...event.locationIds].sort(),
    event.cancelled,
    event.excluded,
    event.notice ?? null,
  ]);
}

/**
 * Derives occurrence keys and detects ambiguities without changing source data.
 *
 * Input order is retained. Every candidate remains in the result. When two or
 * more candidates have the same derived key, ALL colliding entries receive a
 * null key and an error diagnostic. This intentionally does not generate
 * position-based IDs or merge source occurrences.
 *
 * The caller must first exclude invalid intervals using resolveCalendarTime().
 */
export function identifyCalendarOccurrences(
  candidates: readonly CalendarOccurrenceCandidate[],
): CalendarIdentityResult {
  const keys = candidates.map(deriveCalendarOccurrenceKey);
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);

  const diagnostics: CalendarDiagnostic[] = [];
  const occurrences = candidates.map((candidate, index) => {
    const source = sourceOf(candidate);
    if (!candidate.event.seriesId) {
      diagnostics.push({
        severity: "warning",
        code: "missing_series_identity",
        source,
        message: "Source series ID is missing; snapshot-scoped attribute fallback used",
      });
    }
    const key = keys[index];
    if ((counts.get(key) ?? 0) > 1) {
      diagnostics.push({
        severity: "error",
        code: "occurrence_key_collision",
        source,
        message: "Occurrence key collides with another source record; identity unresolved",
      });
      return { candidate, occurrenceKey: null };
    }
    return { candidate, occurrenceKey: key };
  });
  return { occurrences, diagnostics };
}
