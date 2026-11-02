import type { Plan } from "../models/Plan";
import type { Course } from "../models/Course";
import type { StudyGroup } from "../models/StudyGroup";
import type { CalendarEntry } from "../models/CalendarEntry";
import type { CalendarDiagnostic } from "../models/CalendarDiagnostic";

import type { CalendarOccurrenceCandidate } from "./CalendarOccurrenceIdentity";
import { identifyCalendarOccurrences } from "./CalendarOccurrenceIdentity";
import { resolveCalendarTime } from "./CalendarTime";
import { defineFixedCalendarOccurrence, compareCalendarEntries } from "./CalendarEntryContract";

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


/**
 * Projects the current plan into fixed calendar occurrences using cached data.
 *
 * Stage 2 is deliberately limited to traversal, source time validation and
 * identity derivation. The selection, exclusion, duplicate-reference and
 * flexible-classification policies are introduced in Stage 3. Thus this
 * function currently projects every group returned by a usable snapshot.
 *
 * No request, store read, persistence operation or input mutation occurs here.
 */
export function projectActivePlan(
  input: CalendarProjectionInput,
): CalendarProjectionResult {
  const entries: CalendarEntry[] = [];
  const diagnostics: CalendarDiagnostic[] = [];
  const availability: StudyGroupAvailability[] = [];
  const candidates: CalendarOccurrenceCandidate[] = [];

  // A plan is a set of course offering IDs, even if legacy data contains repeats.
  for (const courseOfferingId of new Set(input.plan.instanceIds)) {
    const source = { courseOfferingId };
    const course = input.getCourseForOffering(courseOfferingId);
    if (!course) {
      availability.push("missing");
      diagnostics.push({
        severity: "error", code: "missing_course_offering", source,
        message: "Course offering is not available in the course index",
      });
      continue;
    }
    const snapshot = input.getStudyGroups(course.unitId, courseOfferingId);
    const usable = snapshot.availability === "available" || snapshot.availability === "stale";
    if (!usable || snapshot.groups === null) {
      const state = usable ? "missing" : snapshot.availability;
      availability.push(state);
      diagnostics.push({
        severity: state === "stale" ? "warning" : "error",
        code: state === "loading" ? "study_groups_loading" :
          state === "failed" ? "study_groups_failed" : "study_groups_missing",
        source, message: `Full study-group data unavailable (${state})`,
      });
      continue;
    }
    availability.push(snapshot.availability);
    if (snapshot.availability === "stale") {
      diagnostics.push({
        severity: "warning", code: "study_groups_stale", source,
        message: "Using stale study-group data",
      });
    }
    for (const group of snapshot.groups) {
      const groupSource = { courseOfferingId, studyGroupId: group.groupId };
      for (const event of group.studyEvents) {
        const eventSource = { ...groupSource, seriesId: event.seriesId ?? null };
        const result = resolveCalendarTime(event, eventSource);
        diagnostics.push(...result.diagnostics);
        if (!result.interval) continue;
        candidates.push({
          courseOfferingId,
          studyGroupId: group.groupId,
          event,
          interval: result.interval,
        });
      }
    }
  }

  const identified = identifyCalendarOccurrences(candidates);
  diagnostics.push(...identified.diagnostics);
  for (const occurrence of identified.occurrences) {
    entries.push(defineFixedCalendarOccurrence(occurrence));
  }
  entries.sort(compareCalendarEntries);
  return {
    entries,
    diagnostics,
    completeness: summarizeCalendarCompleteness(availability),
  };
}
