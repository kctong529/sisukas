import { describe, expect, it, vi } from 'vitest';

import { calendarGroupKey } from '@application/calendar/calendarVisibility';
import { createCalendarVisibilitySessionStore } from '@lib/stores/calendarVisibilitySessionStore.svelte';

import type { CalendarPreferenceResponse } from '@application/calendar/calendarPreferenceMapping';

const EMPTY: CalendarPreferenceResponse = { hiddenGroups: [], occurrenceOverrides: [] };
const GROUP = { courseOfferingId: 'offering', studyGroupId: 'group' };
const OTHER = { courseOfferingId: 'offering', studyGroupId: 'other' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function settle() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

describe('Calendar persistence race hardening (#191)', () => {
  it('does not refresh authoritative visibility during a pending PUT', async () => {
    const request = deferred<void>();
    const load = vi.fn(async () => EMPTY);
    const write = vi.fn(() => request.promise);
    const store = createCalendarVisibilitySessionStore(load, write);
    store.actions.setAccount('A');
    await store.actions.ensureLoaded('A', 'plan');
    store.actions.setGroupHidden('A', 'plan', GROUP, true);

    await store.actions.retryLoad('A', 'plan');
    expect(load).toHaveBeenCalledTimes(1);
    expect(store.read.stateFor('A', 'plan').status).toBe('ready');
    expect(store.read.writesFor('A', 'plan').pending).toBe(1);

    request.resolve();
    await settle();
    expect(store.read.writesFor('A', 'plan')).toEqual({ pending: 0, failed: 0 });
    expect(store.read.displayFor('A', 'plan')?.hiddenGroups)
      .toContain(calendarGroupKey('offering', 'group'));
  });

  it('preserves failed local edits when a preference refresh is requested', async () => {
    const load = vi.fn(async () => EMPTY);
    const write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const store = createCalendarVisibilitySessionStore(load, write);
    store.actions.setAccount('A');
    await store.actions.ensureLoaded('A', 'plan');
    store.actions.setGroupHidden('A', 'plan', GROUP, true);
    await settle();
    expect(store.read.writesFor('A', 'plan').failed).toBe(1);

    await store.actions.retryLoad('A', 'plan');
    expect(load).toHaveBeenCalledTimes(1);
    expect(store.read.writesFor('A', 'plan').failed).toBe(1);
    store.actions.retryFailedWrites('A', 'plan');
    await settle();
    expect(store.read.writesFor('A', 'plan')).toEqual({ pending: 0, failed: 0 });
    expect(store.read.displayFor('A', 'plan')?.hiddenGroups)
      .toContain(calendarGroupKey('offering', 'group'));
  });

  it('allows a fresh GET after all pending writes have been confirmed', async () => {
    const load = vi.fn(async () => EMPTY);
    const write = vi.fn().mockResolvedValue(undefined);
    const store = createCalendarVisibilitySessionStore(load, write);
    store.actions.setAccount('A');
    await store.actions.ensureLoaded('A', 'plan');
    store.actions.setGroupHidden('A', 'plan', GROUP, true);
    await settle();
    await store.actions.retryLoad('A', 'plan');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not block independent identities behind a slow request', async () => {
    const blocked = deferred<void>();
    const write = vi.fn((_: string, group: typeof GROUP) =>
      group.studyGroupId === 'group' ? blocked.promise : Promise.resolve());
    const store = createCalendarVisibilitySessionStore(async () => EMPTY, write);
    store.actions.setAccount('A');
    await store.actions.ensureLoaded('A', 'plan');
    store.actions.setGroupHidden('A', 'plan', GROUP, true);
    store.actions.setGroupHidden('A', 'plan', OTHER, true);
    await settle();
    expect(write).toHaveBeenCalledTimes(2);
    expect(store.read.writesFor('A', 'plan')).toEqual({ pending: 1, failed: 0 });
    blocked.resolve();
    await settle();
    expect(store.read.writesFor('A', 'plan')).toEqual({ pending: 0, failed: 0 });
  });

  it('keeps later account data isolated when an old PUT rejects', async () => {
    const oldWrite = deferred<void>();
    const store = createCalendarVisibilitySessionStore(async () => EMPTY, () => oldWrite.promise);
    store.actions.setAccount('A');
    await store.actions.ensureLoaded('A', 'shared-plan');
    store.actions.setGroupHidden('A', 'shared-plan', GROUP, true);
    store.actions.setAccount('B');
    await store.actions.ensureLoaded('B', 'shared-plan');
    oldWrite.reject(new Error('late failure'));
    await settle();
    expect(store.read.writesFor('B', 'shared-plan')).toEqual({ pending: 0, failed: 0 });
    expect(store.read.displayFor('B', 'shared-plan')?.hiddenGroups).toEqual([]);
  });
});
