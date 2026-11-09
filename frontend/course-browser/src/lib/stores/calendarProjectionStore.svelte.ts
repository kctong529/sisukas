import { createSubscriber } from "svelte/reactivity";
import { get } from "svelte/store";

import { activePlanStudyGroupRequests } from "@app/study-group-loading/activePlanRequests";
import {
  type CalendarProjectionSources,
  projectPlanFromSources,
} from "@application/calendar/calendarProjectionAdapter";
import { getStudyGroupDataRuntime } from "@modules/study-groups";

import { courseIndexStore } from "./courseIndexStore.svelte";
import { plansStore } from "./plansStore.svelte";

import type { CalendarProjectionResult } from "@domain/services/calendar/CalendarProjection";
import type { StudyGroupEntry, StudyGroupRequest } from "@modules/study-groups";

/** Reactive reader of the authoritative runtime; no independent cache or retrieval. */
const readers = new Map<string, () => StudyGroupEntry>();

function entryFor(unitId: string, offeringId: string): StudyGroupEntry {
  const request: StudyGroupRequest = {
    courseUnitId: unitId,
    courseOfferingId: offeringId,
  };
  const key = JSON.stringify([unitId, offeringId]);
  let read = readers.get(key);
  if (!read) {
    const entry = getStudyGroupDataRuntime().entry(request);
    const track = createSubscriber(update =>
      entry.subscribe(() => update()),
    );
    read = () => {
      track();
      // Reads outside reactive effects must still reflect the current cache.
      return get(entry);
    };
    readers.set(key, read);
  }
  return read();
}

const sources: CalendarProjectionSources = {
  resolveCourse: id => courseIndexStore.read.resolveByInstanceId(id),
  readGroups: (unitId, offeringId) => entryFor(unitId, offeringId).groups,
  isLoading: (unitId, offeringId) => {
    const entry = entryFor(unitId, offeringId);
    return entry.groups === null && (entry.status === "queued" || entry.status === "loading");
  },
  isStale: (unitId, offeringId) => {
    const entry = entryFor(unitId, offeringId);
    return entry.groups !== null && (entry.refreshing || entry.error !== null);
  },
  hasFailed: (unitId, offeringId) => {
    const entry = entryFor(unitId, offeringId);
    return entry.groups === null && entry.status === "failed";
  },
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
  /** Observe full groups from the same runtime used for calendar projection. */
  readGroups(unitId: string, offeringId: string) {
    return entryFor(unitId, offeringId).groups;
  },
  /** Explicit user retry; the app lifecycle owns the default loading policy. */
  retryUnavailableGroups(): void {
    const plan = plansStore.read.getActive();
    if (!plan) return;
    const requests = activePlanStudyGroupRequests(
      plan,
      id => courseIndexStore.read.resolveByInstanceId(id),
    ).filter(request => {
      const entry = entryFor(request.courseUnitId, request.courseOfferingId);
      return entry.groups === null && entry.status !== "queued" && entry.status !== "loading";
    });
    if (requests.length) {
      void getStudyGroupDataRuntime().refresh(requests);
    }
  },
};
