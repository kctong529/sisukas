import { describe, expect, it, vi } from 'vitest';

import { calendarGroupKey } from '@application/calendar/calendarVisibility';
import { createCalendarVisibilitySessionStore } from '@lib/stores/calendarVisibilitySessionStore.svelte';

import type { CalendarPreferenceResponse } from '@application/calendar/calendarPreferenceMapping';

const EMPTY: CalendarPreferenceResponse = { hiddenGroups: [], occurrenceOverrides: [] };
const group = { courseOfferingId: 'offering', studyGroupId: 'group' };
const key = JSON.stringify(['series', 'offering', 'group', 'series-1', 1790000000000]);

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function tick(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

describe('Calendar optimistic preference mutations (#191 Step 5)', () => {
  it('hides a group immediately and confirms it only after PUT succeeds', async () => {
    const request = deferred();
    const put = vi.fn(() => request.promise);
    const store = createCalendarVisibilitySessionStore(async () => EMPTY, put);
    store.actions.setAccount('user');
    await store.actions.ensureLoaded('user', 'plan');
    store.actions.setGroupHidden('user', 'plan', group, true);
    expect(store.read.displayFor('user', 'plan')?.hiddenGroups).toContain(calendarGroupKey('offering', 'group'));
    expect(store.read.writesFor('user', 'plan')).toEqual({ pending: 1, failed: 0 });
    expect(put).toHaveBeenCalledWith('plan', group, true);
    request.resolve();
    await tick();
    expect(store.read.writesFor('user', 'plan')).toEqual({ pending: 0, failed: 0 });
    expect(store.read.stateFor('user', 'plan')).toMatchObject({ status: 'ready' });
  });

  it('serializes rapid hide then restore for the same group', async () => {
    const first = deferred();
    const put = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const store = createCalendarVisibilitySessionStore(async () => EMPTY, put);
    store.actions.setAccount('user');
    await store.actions.ensureLoaded('user', 'plan');
    store.actions.setGroupHidden('user', 'plan', group, true);
    store.actions.setGroupHidden('user', 'plan', group, false);
    expect(put).toHaveBeenCalledTimes(1);
    expect(store.read.displayFor('user', 'plan')?.hiddenGroups).toEqual([]);
    first.resolve();
    await tick();
    expect(put).toHaveBeenNthCalledWith(2, 'plan', group, false);
    expect(store.read.writesFor('user', 'plan')).toEqual({ pending: 0, failed: 0 });
    expect(store.read.displayFor('user', 'plan')?.hiddenGroups).toEqual([]);
  });

  it('keeps a failed optimistic edit visible and retries only that identity', async () => {
    const put = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const store = createCalendarVisibilitySessionStore(async () => EMPTY, put);
    store.actions.setAccount('user');
    await store.actions.ensureLoaded('user', 'plan');
    store.actions.setGroupHidden('user', 'plan', group, true);
    await tick();
    expect(store.read.writesFor('user', 'plan')).toEqual({ pending: 0, failed: 1 });
    expect(store.read.displayFor('user', 'plan')?.hiddenGroups).toContain(calendarGroupKey('offering', 'group'));
    store.actions.retryFailedWrites('user', 'plan');
    await tick();
    expect(put).toHaveBeenCalledTimes(2);
    expect(store.read.writesFor('user', 'plan')).toEqual({ pending: 0, failed: 0 });
  });

  it('saves occurrence override and reset using exact identity and scope', async () => {
    const putOccurrence = vi.fn().mockResolvedValue(undefined);
    const store = createCalendarVisibilitySessionStore(async () => EMPTY, vi.fn(), putOccurrence);
    store.actions.setAccount('user');
    await store.actions.ensureLoaded('user', 'plan');
    store.actions.setOccurrenceVisibility('user', 'plan', key, 'hidden');
    await tick();
    expect(putOccurrence).toHaveBeenCalledWith('plan', {
      ...group, occurrenceKeyVersion: 1, occurrenceKey: key,
    }, 'hidden');
    expect(store.read.displayFor('user', 'plan')?.occurrenceOverrides[key]).toBe('hidden');
    store.actions.setOccurrenceVisibility('user', 'plan', key, null);
    await tick();
    expect(putOccurrence).toHaveBeenLastCalledWith('plan', {
      ...group, occurrenceKeyVersion: 1, occurrenceKey: key,
    }, null);
    expect(store.read.displayFor('user', 'plan')?.occurrenceOverrides[key]).toBeUndefined();
  });

  it('discards completion of an old account write after switching accounts', async () => {
    const first = deferred();
    const put = vi.fn(() => first.promise);
    const store = createCalendarVisibilitySessionStore(async () => EMPTY, put);
    store.actions.setAccount('A');
    await store.actions.ensureLoaded('A', 'plan');
    store.actions.setGroupHidden('A', 'plan', group, true);
    store.actions.setAccount('B');
    await store.actions.ensureLoaded('B', 'plan');
    first.resolve();
    await tick();
    expect(store.read.writesFor('B', 'plan')).toEqual({ pending: 0, failed: 0 });
    expect(store.read.displayFor('B', 'plan')?.hiddenGroups).toEqual([]);
  });
});
