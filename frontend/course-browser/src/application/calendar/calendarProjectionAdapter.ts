import type { Plan } from "@domain/models/Plan";
import type { Course } from "@domain/models/Course";
import type { StudyGroup } from "@domain/models/StudyGroup";
import {
  projectActivePlan,
  type CalendarProjectionResult,
  type StudyGroupSnapshot,
  type StudyGroupSelection,
} from "@domain/services/calendar/CalendarProjection";

/** Store reads are injected so the adapter can be tested without Svelte state. */
export interface CalendarProjectionSources {
  resolveCourse(offeringId: string): Course | undefined;
  readGroups(unitId: string, offeringId: string): readonly StudyGroup[] | null;
  isLoading(unitId: string, offeringId: string): boolean;
  isStale(unitId: string, offeringId: string): boolean;
  /** Optional explicit choice; do not infer selection from LEGO blocks. */
  readSelection?(offeringId: string): StudyGroupSelection | null;
}

export function readStudyGroupSnapshot(
  sources: CalendarProjectionSources,
  unitId: string,
  offeringId: string,
): StudyGroupSnapshot {
  const groups = sources.readGroups(unitId, offeringId);
  if (groups !== null) {
    return { availability: sources.isStale(unitId, offeringId) ? "stale" : "available", groups };
  }
  return {
    availability: sources.isLoading(unitId, offeringId) ? "loading" : "missing",
    groups: null,
  };
}

export function projectPlanFromSources(
  plan: Plan,
  sources: CalendarProjectionSources,
): CalendarProjectionResult {
  return projectActivePlan({
    plan,
    getCourseForOffering: (id) => sources.resolveCourse(id),
    getStudyGroups: (unitId, offeringId) => readStudyGroupSnapshot(sources, unitId, offeringId),
    getSelection: sources.readSelection ? id => sources.readSelection!(id) : undefined,
  });
}
