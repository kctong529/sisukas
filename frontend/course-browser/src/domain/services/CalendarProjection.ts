import type { Plan } from "../models/Plan";
import type { Course } from "../models/Course";
import type { StudyGroup } from "../models/StudyGroup";
import type { CalendarEntry } from "../models/CalendarEntry";
import type { CalendarDiagnostic } from "../models/CalendarDiagnostic";

/** Explicit availability supplied by the caller, never inferred from [] groups. */
export type StudyGroupAvailability =
  | "available"
  | "stale"
  | "missing"
  | "loading"
  | "failed";

/** The caller supplies full cached data separately from availability metadata. */
export interface StudyGroupSnapshot {
  availability: StudyGroupAvailability;
  /** null means full event data is unavailable; [] means successfully empty. */
  groups: readonly StudyGroup[] | null;
}

/** Only explicit selection qualifies as selected; LEGO blocks are not selections. */
export interface StudyGroupSelection {
  studyGroupIds: readonly string[];
}

/** Pure synchronous lookups. The projector neither fetches nor mutates data. */
export interface CalendarProjectionInput {
  plan: Plan;
  getCourseForOffering(courseOfferingId: string): Course | undefined;
  getStudyGroups(courseUnitId: string, courseOfferingId: string): StudyGroupSnapshot;
  /** Optional explicit selection. Absence means all groups are candidates. */
  getSelection?(courseOfferingId: string): StudyGroupSelection | null;
}

export interface CalendarCompleteness {
  /** Stale data remains usable but makes the overall result partial. */
  status: "complete" | "partial";
  totalCourses: number;
  availableCourses: number;
  staleCourses: number;
  missingCourses: number;
  loadingCourses: number;
  failedCourses: number;
}

/** The counts refer to distinct offering IDs, not event or study-group counts. */
export interface CalendarProjectionResult {
  entries: CalendarEntry[];
  diagnostics: CalendarDiagnostic[];
  completeness: CalendarCompleteness;
}

/**
 * Derives availability for the requested offerings, not the number of entries.
 * A successfully fetched offering with zero groups is still available.
 *
 * Only available and stale may have usable full groups. If the caller has
 * cached full groups during a refresh, it should report stale rather than
 * loading. A failed state must be backed by per-offering evidence.
 */
export function summarizeCalendarCompleteness(
  availabilities: readonly StudyGroupAvailability[],
): CalendarCompleteness {
  const result: CalendarCompleteness = {
    status: "complete",
    totalCourses: availabilities.length,
    availableCourses: 0,
    staleCourses: 0,
    missingCourses: 0,
    loadingCourses: 0,
    failedCourses: 0,
  };
  for (const state of availabilities) {
    switch (state) {
      case "available": result.availableCourses++; break;
      case "stale": result.staleCourses++; break;
      case "missing": result.missingCourses++; break;
      case "loading": result.loadingCourses++; break;
      case "failed": result.failedCourses++; break;
    }
  }
  if (result.availableCourses !== result.totalCourses) result.status = "partial";
  return result;
}
