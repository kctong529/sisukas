import { plansStore } from "./plansStore.svelte";
import { courseIndexStore } from "./courseIndexStore.svelte";
import { studyGroupStore } from "./studyGroupStore.svelte";
import {
  projectPlanFromSources,
  type CalendarProjectionSources,
} from "@application/calendar/calendarProjectionAdapter";
import type { CalendarProjectionResult } from "@domain/services/calendar/CalendarProjection";

const sources: CalendarProjectionSources = {
  resolveCourse: (id) => courseIndexStore.read.resolveByInstanceId(id),
  readGroups: (unitId, offeringId) => studyGroupStore.read.getCached(unitId, offeringId),
  // getStatus().isLoading ignores requests if summaries exist; the calendar must not.
  isLoading: (unitId, offeringId) => studyGroupStore.read.isLoading(unitId, offeringId),
  isStale: (unitId, offeringId) => studyGroupStore.read.isStale(unitId, offeringId),
};

const projection = $derived.by((): CalendarProjectionResult | null => {
  const plan = plansStore.read.getActive();
  return plan ? projectPlanFromSources(plan, sources) : null;
});

export const calendarProjectionStore = {
  get projection() { return projection; },
  /** Explicit loading command: call from a mounted calendar view, not during derivation. */
  ensureActivePlanGroups(): void {
    const plan = plansStore.read.getActive();
    if (!plan) return;
    for (const id of new Set(plan.instanceIds)) {
      const course = courseIndexStore.read.resolveByInstanceId(id);
      if (course) studyGroupStore.actions.ensureFetched(course.unitId, id);
    }
  },
};
