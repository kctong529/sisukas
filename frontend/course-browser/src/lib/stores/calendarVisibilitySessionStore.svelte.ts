import { toCalendarVisibility } from '@application/calendar/calendarPreferenceMapping';
import {
  type CalendarVisibility,
  EMPTY_CALENDAR_VISIBILITY,
} from '@application/calendar/calendarVisibility';
import { CalendarPreferencesService } from '@infrastructure/services/CalendarPreferencesService';

import type { CalendarPreferenceResponse } from '@application/calendar/calendarPreferenceMapping';

export type CalendarPreferenceLoadState =
  | { status: 'unknown' }
  | { status: 'loading' }
  | { status: 'ready'; visibility: CalendarVisibility }
  | { status: 'failed'; error: string };

const UNKNOWN: CalendarPreferenceLoadState = { status: 'unknown' };

/**
 * Account-scoped preference hydration alongside the temporary #92 local state.
 * Only a ready server response is authoritative; the Calendar view will switch
 * to read.stateFor during #191 Step 4.
 */
export function createCalendarVisibilitySessionStore(
  load: (planId: string) => Promise<CalendarPreferenceResponse> = CalendarPreferencesService.load,
) {
  const state = $state({
    accountId: null as string | null,
    byPlan: new Map<string, CalendarPreferenceLoadState>(),
    sessionVisibilityByPlan: new Map<string, CalendarVisibility>(),
  });

  let generation = 0;
  const inFlight = new Map<string, Promise<void>>();

  function putPlan(planId: string, value: CalendarPreferenceLoadState): void {
    state.byPlan = new Map(state.byPlan).set(planId, value);
  }

  function loadPlan(userId: string, planId: string): Promise<void> {
    if (state.accountId !== userId) return Promise.resolve();

    const existing = inFlight.get(planId);
    if (existing) return existing;

    const requestGeneration = generation;
    putPlan(planId, { status: 'loading' });

    const promise = Promise.resolve()
      .then(() => load(planId))
      .then(response => {
        if (generation !== requestGeneration || state.accountId !== userId) return;
        const visibility = toCalendarVisibility(response);
        putPlan(planId, { status: 'ready', visibility });
      })
      .catch(error => {
        if (generation !== requestGeneration || state.accountId !== userId) return;
        putPlan(planId, {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        if (inFlight.get(planId) === promise) inFlight.delete(planId);
      });

    inFlight.set(planId, promise);
    return promise;
  }

  const read = {
    stateFor(userId: string, planId: string): CalendarPreferenceLoadState {
      if (state.accountId !== userId) return UNKNOWN;
      return state.byPlan.get(planId) ?? UNKNOWN;
    },
    /**
     * Display the server-confirmed preferences, with any temporary local edits
     * made after hydration taking precedence. Never returns a default before
     * the caller has checked that stateFor is ready.
     */
    displayFor(userId: string, planId: string): CalendarVisibility | null {
      const entry = read.stateFor(userId, planId);
      if (entry.status !== 'ready') return null;
      return state.sessionVisibilityByPlan.get(planId) ?? entry.visibility;
    },
    hasSessionEdits(userId: string, planId: string): boolean {
      return read.stateFor(userId, planId).status === 'ready'
        && state.sessionVisibilityByPlan.has(planId);
    },
    // Temporary #92 interface until persisted mutations are wired in Step 5.
    forPlan(planId: string | undefined): CalendarVisibility {
      return planId === undefined
        ? EMPTY_CALENDAR_VISIBILITY
        : state.sessionVisibilityByPlan.get(planId) ?? EMPTY_CALENDAR_VISIBILITY;
    },
  };

  const actions = {
    clear(): void {
      generation += 1;
      state.accountId = null;
      state.byPlan = new Map();
      state.sessionVisibilityByPlan = new Map();
      inFlight.clear();
    },
    setAccount(userId: string | null): void {
      if (state.accountId === userId) return;
      actions.clear();
      state.accountId = userId;
    },
    ensureLoaded(userId: string, planId: string): Promise<void> {
      if (state.accountId !== userId) return Promise.resolve();
      const status = state.byPlan.get(planId)?.status;
      if (status === 'ready' || status === 'failed') return Promise.resolve();
      return loadPlan(userId, planId);
    },
    retryLoad(userId: string, planId: string): Promise<void> {
      if (state.accountId !== userId) return Promise.resolve();
      // A retry refreshes even a ready plan. Do not replace an in-flight GET.
      return loadPlan(userId, planId);
    },
    // Temporary local action; Step 5 replaces it with persisted edits.
    setForPlan(planId: string, visibility: CalendarVisibility): void {
      state.sessionVisibilityByPlan = new Map(state.sessionVisibilityByPlan)
        .set(planId, visibility);
    },
  };

  return { state, read, actions };
}

export const calendarVisibilitySessionStore = createCalendarVisibilitySessionStore();
