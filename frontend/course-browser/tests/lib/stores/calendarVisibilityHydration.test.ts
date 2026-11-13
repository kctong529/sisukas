import { describe, expect, it, vi } from 'vitest';

import { calendarGroupKey } from '../../../src/application/calendar/calendarVisibility';
import { createCalendarVisibilitySessionStore } from '../../../src/lib/stores/calendarVisibilitySessionStore.svelte';

import type { CalendarPreferenceResponse } from '../../../src/application/calendar/calendarPreferenceMapping';

const EMPTY: CalendarPreferenceResponse = { hiddenGroups: [], occurrenceOverrides: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('calendar preference hydration (#191)', () => {
  it('keeps unknown and loading separate from confirmed-empty', async () => {
    const request = deferred<CalendarPreferenceResponse>();
    const load = vi.fn(() => request.promise);
    const store = createCalendarVisibilitySessionStore(load);
    store.actions.setAccount('user');
    expect(store.read.stateFor('user', 'plan').status).toBe('unknown');
    const pending = store.actions.ensureLoaded('user', 'plan');
    expect(store.read.stateFor('user', 'plan').status).toBe('loading');
    request.resolve(EMPTY);
    await pending;
    expect(store.read.stateFor('user', 'plan')).toEqual({
      status: 'ready', visibility: { hiddenGroups: [], occurrenceOverrides: {} },
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent GETs and caches ready plans across A → B → A', async () => {
    const load = vi.fn(async (plan: string): Promise<CalendarPreferenceResponse> => ({
      hiddenGroups: [{ courseOfferingId: plan, studyGroupId: 'G01' }],
      occurrenceOverrides: [],
    }));
    const store = createCalendarVisibilitySessionStore(load);
    store.actions.setAccount('user');
    const first = store.actions.ensureLoaded('user', 'A');
    expect(store.actions.ensureLoaded('user', 'A')).toBe(first);
    await first;
    await store.actions.ensureLoaded('user', 'B');
    await store.actions.ensureLoaded('user', 'A');
    expect(load).toHaveBeenCalledTimes(2);
    expect(store.read.stateFor('user', 'A')).toEqual({
      status: 'ready', visibility: {
        hiddenGroups: [calendarGroupKey('A', 'G01')], occurrenceOverrides: {},
      },
    });
  });

  it('records a failed GET without fabricating empty visibility; explicit retry recovers', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(EMPTY);
    const store = createCalendarVisibilitySessionStore(load);
    store.actions.setAccount('user');
    await store.actions.ensureLoaded('user', 'plan');
    expect(store.read.stateFor('user', 'plan')).toEqual({
      status: 'failed', error: 'network unavailable',
    });
    await store.actions.ensureLoaded('user', 'plan');
    expect(load).toHaveBeenCalledTimes(1);
    await store.actions.retryLoad('user', 'plan');
    expect(store.read.stateFor('user', 'plan').status).toBe('ready');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('ignores a previous account response after switching accounts', async () => {
    const old = deferred<CalendarPreferenceResponse>();
    const load = vi.fn()
      .mockImplementationOnce(() => old.promise)
      .mockResolvedValueOnce(EMPTY);
    const store = createCalendarVisibilitySessionStore(load);
    store.actions.setAccount('A');
    const previous = store.actions.ensureLoaded('A', 'plan');
    store.actions.setAccount('B');
    await store.actions.ensureLoaded('B', 'plan');
    old.resolve({ hiddenGroups: [{ courseOfferingId: 'private', studyGroupId: 'G' }], occurrenceOverrides: [] });
    await previous;
    expect(store.read.stateFor('A', 'plan').status).toBe('unknown');
    expect(store.read.stateFor('B', 'plan').status).toBe('ready');
    expect(store.read.stateFor('B', 'plan')).toEqual({
      status: 'ready', visibility: { hiddenGroups: [], occurrenceOverrides: {} },
    });
  });

  it('ignores late failures after sign-out and never reactivates an old account', async () => {
    const request = deferred<CalendarPreferenceResponse>();
    const load = vi.fn(() => request.promise);
    const store = createCalendarVisibilitySessionStore(load);
    store.actions.setAccount('A');
    const pending = store.actions.ensureLoaded('A', 'plan');
    store.actions.clear();
    request.reject(new Error('obsolete failure'));
    await pending;
    await store.actions.ensureLoaded('A', 'plan');
    expect(store.read.stateFor('A', 'plan').status).toBe('unknown');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not reset hydration for repeated observations of the same account', async () => {
    const store = createCalendarVisibilitySessionStore(async () => EMPTY);
    store.actions.setAccount('A');
    await store.actions.ensureLoaded('A', 'plan');
    store.actions.setAccount('A');
    expect(store.read.stateFor('A', 'plan').status).toBe('ready');
  });

  it('handles prototype-like plan identifiers as data', async () => {
    const store = createCalendarVisibilitySessionStore(async () => EMPTY);
    store.actions.setAccount('user');
    await store.actions.ensureLoaded('user', '__proto__');
    expect(store.read.stateFor('user', '__proto__').status).toBe('ready');
    expect(store.read.stateFor('user', 'constructor').status).toBe('unknown');
  });
});
