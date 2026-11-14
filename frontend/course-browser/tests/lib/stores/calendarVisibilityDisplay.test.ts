import { describe, expect, it } from 'vitest';

import { createCalendarVisibilitySessionStore } from '@lib/stores/calendarVisibilitySessionStore.svelte';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('Calendar display hydration boundary (#191 Step 4)', () => {
  it('never offers default display visibility before a confirmed GET', async () => {
    const response = deferred<{ hiddenGroups: []; occurrenceOverrides: [] }>();
    const store = createCalendarVisibilitySessionStore(() => response.promise);
    store.actions.setAccount('account');
    expect(store.read.displayFor('account', 'plan')).toBeNull();
    const loading = store.actions.ensureLoaded('account', 'plan');
    expect(store.read.displayFor('account', 'plan')).toBeNull();
    response.resolve({ hiddenGroups: [], occurrenceOverrides: [] });
    await loading;
    expect(store.read.displayFor('account', 'plan')).toEqual({ hiddenGroups: [], occurrenceOverrides: {} });
  });

  it('uses authoritative hidden groups then preserves temporary local edits', async () => {
    const store = createCalendarVisibilitySessionStore(async () => ({
      hiddenGroups: [{ courseOfferingId: 'offering', studyGroupId: 'group' }],
      occurrenceOverrides: [],
    }));
    store.actions.setAccount('account');
    await store.actions.ensureLoaded('account', 'plan');
    const authoritative = store.read.displayFor('account', 'plan');
    expect(authoritative?.hiddenGroups).toHaveLength(1);
    expect(store.read.hasSessionEdits('account', 'plan')).toBe(false);
    store.actions.setForPlan('plan', { hiddenGroups: [], occurrenceOverrides: {} });
    expect(store.read.displayFor('account', 'plan')?.hiddenGroups).toEqual([]);
    expect(store.read.hasSessionEdits('account', 'plan')).toBe(true);
    store.actions.setAccount('other');
    expect(store.read.displayFor('account', 'plan')).toBeNull();
    expect(store.read.hasSessionEdits('account', 'plan')).toBe(false);
  });

  it('does not disclose calendar visibility on load failure', async () => {
    const store = createCalendarVisibilitySessionStore(async () => { throw Error('offline'); });
    store.actions.setAccount('account');
    await store.actions.ensureLoaded('account', 'plan');
    expect(store.read.stateFor('account', 'plan').status).toBe('failed');
    expect(store.read.displayFor('account', 'plan')).toBeNull();
  });
});
