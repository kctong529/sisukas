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
  hasFailed: (unitId, offeringId) => studyGroupStore.read.hasFailed(unitId, offeringId),
};

/** Development-only choices scoped by plan and offering. No persisted plan is modified. */
export interface CalendarSelectionPreview {
  planId: string;
  choicesByOffering: Readonly<Record<string, Readonly<Record<string, "selected" | "excluded">>>>;
}

let selectionPreview = $state<CalendarSelectionPreview | null>(null);
/** Development-only availability simulation; does not alter the fetch cache. */
export interface CalendarAvailabilityPreview {
  planId: string;
  offeringId: string;
  state: "stale" | "missing" | "loading" | "failed";
}
let availabilityPreview = $state<CalendarAvailabilityPreview | null>(null);
const previewAllowed =
  import.meta.env.DEV ||
  (
    import.meta.env.VITE_DEBUG_PANELS === "true" &&
    import.meta.env.VITE_DEBUG_CALENDAR_PROJECTION_STORE === "true"
  );

const projection = $derived.by((): CalendarProjectionResult | null => {
  const plan = plansStore.read.getActive();
  if (!plan) return null;
  const preview = previewAllowed && selectionPreview?.planId === plan.id
    ? selectionPreview : null;
  const availability = previewAllowed && availabilityPreview?.planId === plan.id &&
    plan.instanceIds.includes(availabilityPreview.offeringId)
    ? availabilityPreview : null;
  const augmented: CalendarProjectionSources = {
    ...sources,
    readGroups: (unitId, offeringId) =>
      availability?.offeringId === offeringId && availability.state !== "stale"
        ? null : sources.readGroups(unitId, offeringId),
    isLoading: (unitId, offeringId) =>
      availability?.offeringId === offeringId
        ? availability.state === "loading" : sources.isLoading(unitId, offeringId),
    isStale: (unitId, offeringId) =>
      availability?.offeringId === offeringId
        ? availability.state === "stale" : sources.isStale(unitId, offeringId),
    hasFailed: (unitId, offeringId) =>
      availability?.offeringId === offeringId
        ? availability.state === "failed" : Boolean(sources.hasFailed?.(unitId, offeringId)),
  };
  return projectPlanFromSources(plan, preview ? {
    ...augmented,
    readSelection: (offeringId) => {
      if (!plan.instanceIds.includes(offeringId)) return null;
      const choices = preview.choicesByOffering[offeringId];
      return choices ? { choices } : null;
    },
  } : augmented);
});

export const calendarProjectionStore = {
  get availabilityPreview() {
    if (!previewAllowed) return null;
    const plan = plansStore.read.getActive();
    return plan && availabilityPreview?.planId === plan.id ? availabilityPreview : null;
  },
  setAvailabilityPreview(preview: CalendarAvailabilityPreview | null): void {
    if (!previewAllowed) return;
    availabilityPreview = preview;
  },
  get selectionPreview() {
    if (!previewAllowed) return null;
    const plan = plansStore.read.getActive();
    return plan && selectionPreview?.planId === plan.id
      ? selectionPreview : null;
  },
  /** Developer-only, local and reversible; never modifies a plan or network cache. */
  setSelectionPreview(preview: CalendarSelectionPreview | null): void {
    if (!previewAllowed) return;
    selectionPreview = preview;
  },
  get projection() { return projection; },
  /** Explicit loading command: call from a mounted calendar view, not during derivation. */
  retryUnavailableGroups(): void {
    const plan = plansStore.read.getActive();
    if (!plan) return;
    const requests = [...new Set(plan.instanceIds)].flatMap(id => {
      const course = courseIndexStore.read.resolveByInstanceId(id);
      if (!course) return [];
      const unitId = course.unitId;
      if (studyGroupStore.read.getCached(unitId, id) !== null) return [];
      return [{ courseUnitId: unitId, courseOfferingId: id }];
    });
    if (requests.length) void studyGroupStore.actions.forceRefreshBatch(requests);
  },
  ensureActivePlanGroups(): void {
    const plan = plansStore.read.getActive();
    if (!plan) return;
    for (const id of new Set(plan.instanceIds)) {
      const course = courseIndexStore.read.resolveByInstanceId(id);
      if (course) studyGroupStore.actions.ensureFetched(course.unitId, id);
    }
  },
};
