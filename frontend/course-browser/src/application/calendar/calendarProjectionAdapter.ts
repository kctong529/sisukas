import {
  type CalendarProjectionResult,
  projectActivePlan,
  type StudyGroupSelection,
  type StudyGroupSnapshot,
} from "@domain/services/calendar/CalendarProjection";

import type { Course } from "@domain/models/Course";
import type { Plan } from "@domain/models/Plan";
import type { StudyGroup } from "@modules/study-groups";

/** Store reads are injected so the adapter can be tested without Svelte state. */
export interface CalendarProjectionSources {
  resolveCourse(offeringId: string): Course | undefined;
  readGroups(unitId: string, offeringId: string): readonly StudyGroup[] | null;
  isLoading(unitId: string, offeringId: string): boolean;
  isStale(unitId: string, offeringId: string): boolean;
  hasFailed?(unitId: string, offeringId: string): boolean;
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
    availability: sources.isLoading(unitId, offeringId) ? "loading"
      : sources.hasFailed?.(unitId, offeringId) ? "failed" : "missing",
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
