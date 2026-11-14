import { toCalendarVisibility } from '@application/calendar/calendarPreferenceMapping';
import {
  type CalendarVisibility,
  EMPTY_CALENDAR_VISIBILITY,
  setCalendarGroupHidden,
  setCalendarOccurrenceVisibility,
} from '@application/calendar/calendarVisibility';
import { CalendarPreferencesService } from '@infrastructure/services/CalendarPreferencesService';

import type { CalendarGroupPreference, CalendarPreferenceResponse } from '@application/calendar/calendarPreferenceMapping';

export type CalendarPreferenceLoadState =
  | { status: 'unknown' }
  | { status: 'loading' }
  | { status: 'ready'; visibility: CalendarVisibility }
  | { status: 'failed'; error: string };

type OccurrenceVisibility = 'visible' | 'hidden' | null;

type Mutation =
  | { kind: 'group'; group: CalendarGroupPreference; desired: boolean; phase: 'pending' | 'failed'; error: string | null }
  | { kind: 'occurrence'; group: CalendarGroupPreference; occurrenceKey: string; desired: OccurrenceVisibility; phase: 'pending' | 'failed'; error: string | null };

type PreferenceWrites = {
  pending: number;
  failed: number;
};

const UNKNOWN: CalendarPreferenceLoadState = { status: 'unknown' };

/**
 * Account-scoped Calendar preference hydration and optimistic persistence.
 * The view never renders default visibility before a confirmed server response.
 */
export function createCalendarVisibilitySessionStore(
  load: (planId: string) => Promise<CalendarPreferenceResponse> = CalendarPreferencesService.load,
  writeGroup: typeof CalendarPreferencesService.setGroupHidden = CalendarPreferencesService.setGroupHidden,
  writeOccurrence: typeof CalendarPreferencesService.setOccurrenceVisibility = CalendarPreferencesService.setOccurrenceVisibility,
) {
  const state = $state({
    accountId: null as string | null,
    byPlan: new Map<string, CalendarPreferenceLoadState>(),
    sessionVisibilityByPlan: new Map<string, CalendarVisibility>(),
    mutationsByPlan: new Map<string, Map<string, Mutation>>(),
  });

  let generation = 0;
  const inFlight = new Map<string, Promise<void>>();
  // Private asynchronous locks; not part of the reactive state.
  const writing = new Set<string>();

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

  function mutationId(mutation: Mutation): string {
    return JSON.stringify(mutation.kind === 'group'
      ? ['group', mutation.group.courseOfferingId, mutation.group.studyGroupId]
      : ['occurrence', mutation.occurrenceKey]);
  }

  function putMutation(planId: string, id: string, mutation: Mutation | null): void {
    const byKey = new Map(state.mutationsByPlan.get(planId) ?? []);
    if (mutation) byKey.set(id, mutation);
    else byKey.delete(id);
    state.mutationsByPlan = new Map(state.mutationsByPlan).set(planId, byKey);
  }

  function applyMutation(visibility: CalendarVisibility, mutation: Mutation): CalendarVisibility {
    if (mutation.kind === 'group') {
      return setCalendarGroupHidden(
        visibility, mutation.group.courseOfferingId, mutation.group.studyGroupId, mutation.desired,
      );
    }
    return setCalendarOccurrenceVisibility(visibility, [mutation.occurrenceKey], mutation.desired);
  }

  function scopeForKey(key: string): CalendarGroupPreference {
    const fields: unknown = JSON.parse(key);
    if (!Array.isArray(fields) || JSON.stringify(fields) !== key ||
      (fields[0] !== 'series' && fields[0] !== 'fallback') ||
      typeof fields[1] !== 'string' || typeof fields[2] !== 'string' ||
      !fields[1] || !fields[2]) {
      throw new Error('Invalid occurrence identity');
    }
    return { courseOfferingId: fields[1], studyGroupId: fields[2] };
  }

  /** Serialize writes to each identity; a newer local intent always follows the prior PUT. */
  async function flushMutation(userId: string, planId: string, id: string): Promise<void> {
    const lockKey = JSON.stringify([userId, planId, id, generation]);
    if (writing.has(lockKey)) return;
    writing.add(lockKey);
    const writeGeneration = generation;
    try {
      while (writeGeneration === generation && state.accountId === userId) {
        const mutation = state.mutationsByPlan.get(planId)?.get(id);
        if (!mutation || mutation.phase === 'failed') break;
        const sent = mutation.desired;
        try {
          if (mutation.kind === 'group') {
            await writeGroup(planId, mutation.group, sent as boolean);
          } else {
            await writeOccurrence(planId, {
              ...mutation.group,
              occurrenceKeyVersion: 1,
              occurrenceKey: mutation.occurrenceKey,
            }, sent as OccurrenceVisibility);
          }
        } catch (error) {
          if (writeGeneration !== generation || state.accountId !== userId) break;
          const current = state.mutationsByPlan.get(planId)?.get(id);
          if (!current) break;
          putMutation(planId, id, {
            ...current,
            phase: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
          break;
        }
        if (writeGeneration !== generation || state.accountId !== userId) break;
        const entry = state.byPlan.get(planId);
        if (entry?.status !== 'ready') break;
        // Update confirmed state for the value actually accepted by the server.
        const confirmed = applyMutation(entry.visibility, { ...mutation, desired: sent } as Mutation);
        putPlan(planId, { status: 'ready', visibility: confirmed });
        const current = state.mutationsByPlan.get(planId)?.get(id);
        if (!current) break;
        if (current.desired === sent) {
          putMutation(planId, id, null);
          break;
        }
        // The user changed the value mid-flight; send the latest intent next.
      }
    } finally {
      writing.delete(lockKey);
    }
  }

  function stageMutation(userId: string, planId: string, mutation: Mutation): void {
    if (state.accountId !== userId || state.byPlan.get(planId)?.status !== 'ready') return;
    const id = mutationId(mutation);
    putMutation(planId, id, mutation);
    void flushMutation(userId, planId, id);
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
      const mutations = state.mutationsByPlan.get(planId);
      let visible = state.sessionVisibilityByPlan.get(planId) ?? entry.visibility;
      for (const mutation of mutations?.values() ?? []) visible = applyMutation(visible, mutation);
      return visible;
    },
    hasSessionEdits(userId: string, planId: string): boolean {
      return read.stateFor(userId, planId).status === 'ready'
        && state.sessionVisibilityByPlan.has(planId);
    },
    writesFor(userId: string, planId: string): PreferenceWrites {
      if (read.stateFor(userId, planId).status !== 'ready') return { pending: 0, failed: 0 };
      const values = [...(state.mutationsByPlan.get(planId)?.values() ?? [])];
      return {
        pending: values.filter(item => item.phase === 'pending').length,
        failed: values.filter(item => item.phase === 'failed').length,
      };
    },
    // Legacy #92 interface kept for isolated store consumers/tests.
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
      state.mutationsByPlan = new Map();
      writing.clear();
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
      // Never replace the confirmed snapshot while optimistic writes exist.
      // Otherwise a PUT can finish while status is "loading" and its
      // confirmed result is discarded. Keep failed local intent retryable.
      if ((state.mutationsByPlan.get(planId)?.size ?? 0) > 0) return Promise.resolve();
      // A retry refreshes even a ready plan. Do not replace an in-flight GET.
      return loadPlan(userId, planId);
    },
    setGroupHidden(userId: string, planId: string, group: CalendarGroupPreference, hidden: boolean): void {
      stageMutation(userId, planId, { kind: 'group', group, desired: hidden, phase: 'pending', error: null });
    },
    setOccurrenceVisibility(userId: string, planId: string, occurrenceKey: string, visibility: OccurrenceVisibility): void {
      const group = scopeForKey(occurrenceKey);
      stageMutation(userId, planId, {
        kind: 'occurrence', group, occurrenceKey, desired: visibility, phase: 'pending', error: null,
      });
    },
    retryFailedWrites(userId: string, planId: string): void {
      if (state.accountId !== userId || state.byPlan.get(planId)?.status !== 'ready') return;
      for (const [id, mutation] of state.mutationsByPlan.get(planId) ?? []) {
        if (mutation.phase !== 'failed') continue;
        putMutation(planId, id, { ...mutation, phase: 'pending', error: null });
        void flushMutation(userId, planId, id);
      }
    },
    // Legacy local action, used only by existing #92 tests.
    setForPlan(planId: string, visibility: CalendarVisibility): void {
      state.sessionVisibilityByPlan = new Map(state.sessionVisibilityByPlan)
        .set(planId, visibility);
    },
  };

  return { state, read, actions };
}

export const calendarVisibilitySessionStore = createCalendarVisibilitySessionStore();
