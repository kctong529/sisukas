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

/** Development-only choices scoped by plan and offering. No persisted plan is modified. */
export interface CalendarSelectionPreview {
  planId: string;
  choicesByOffering: Readonly<Record<string, Readonly<Record<string, "selected" | "excluded">>>>;
}

let selectionPreview = $state<CalendarSelectionPreview | null>(null);
const previewAllowed = import.meta.env.DEV;

const projection = $derived.by((): CalendarProjectionResult | null => {
  const plan = plansStore.read.getActive();
  if (!plan) return null;
  const preview = previewAllowed && selectionPreview?.planId === plan.id
    ? selectionPreview : null;
  return projectPlanFromSources(plan, preview ? {
    ...sources,
    readSelection: (offeringId) => {
      if (!plan.instanceIds.includes(offeringId)) return null;
      const choices = preview.choicesByOffering[offeringId];
      return choices ? { choices } : null;
    },
  } : sources);
});

export const calendarProjectionStore = {
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
  ensureActivePlanGroups(): void {
    const plan = plansStore.read.getActive();
    if (!plan) return;
    for (const id of new Set(plan.instanceIds)) {
      const course = courseIndexStore.read.resolveByInstanceId(id);
      if (course) studyGroupStore.actions.ensureFetched(course.unitId, id);
    }
  },
};
