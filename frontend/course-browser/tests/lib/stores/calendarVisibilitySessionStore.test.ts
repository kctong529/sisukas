import { describe, expect, it } from 'vitest';

import {
  calendarGroupKey,
  setCalendarGroupHidden,
} from '../../../src/application/calendar/calendarVisibility';
import { createCalendarVisibilitySessionStore } from '../../../src/lib/stores/calendarVisibilitySessionStore.svelte';

describe('calendar session visibility store (#92)', () => {
  it("retains one plan's visibility when switching A -> B -> A", () => {
    const store = createCalendarVisibilitySessionStore();

    const aHidden = setCalendarGroupHidden(
      store.read.forPlan('A'),
      'offering-A',
      'exercise',
      true,
    );
    store.actions.setForPlan('A', aHidden);

    expect(store.read.forPlan('B').hiddenGroups).toEqual([]);

    const bHidden = setCalendarGroupHidden(
      store.read.forPlan('B'),
      'offering-B',
      'lecture',
      true,
    );
    store.actions.setForPlan('B', bHidden);

    expect(store.read.forPlan('A').hiddenGroups).toEqual([
      calendarGroupKey('offering-A', 'exercise'),
    ]);
    expect(store.read.forPlan('B').hiddenGroups).toEqual([
      calendarGroupKey('offering-B', 'lecture'),
    ]);
  });

  it('maintains state across consumers but resets when a new session is created', () => {
    const session = createCalendarVisibilitySessionStore();

    session.actions.setForPlan(
      'plan',
      setCalendarGroupHidden(
        session.read.forPlan('plan'),
        'offering',
        'group',
        true,
      ),
    );

    expect(session.read.forPlan('plan').hiddenGroups).toHaveLength(1);
    expect(session.read.forPlan('plan').hiddenGroups).toHaveLength(1);

    expect(
      createCalendarVisibilitySessionStore().read.forPlan('plan').hiddenGroups,
    ).toEqual([]);

    expect(session.read.forPlan(undefined).hiddenGroups).toEqual([]);
  });

  it('treats prototype-like plan IDs as independent identifiers', () => {
    const store = createCalendarVisibilitySessionStore();

    for (const planId of ['__proto__', 'constructor', 'toString']) {
      expect(store.read.forPlan(planId).hiddenGroups).toEqual([]);
    }

    for (const planId of ['__proto__', 'constructor', 'toString']) {
      store.actions.setForPlan(
        planId,
        setCalendarGroupHidden(
          store.read.forPlan(planId),
          `offering-${planId}`,
          'exercise',
          true,
        ),
      );
    }

    for (const planId of ['__proto__', 'constructor', 'toString']) {
      expect(store.read.forPlan(planId).hiddenGroups).toEqual([
        calendarGroupKey(`offering-${planId}`, 'exercise'),
      ]);
    }

    expect(store.read.forPlan('unrelated').hiddenGroups).toEqual([]);
  });

  it('updates one plan without modifying another plan', () => {
    const store = createCalendarVisibilitySessionStore();

    store.actions.setForPlan(
      'A',
      setCalendarGroupHidden(store.read.forPlan('A'), 'offering', 'G01', true),
    );

    store.actions.setForPlan(
      'B',
      setCalendarGroupHidden(store.read.forPlan('B'), 'offering', 'G02', true),
    );

    store.actions.setForPlan(
      'A',
      setCalendarGroupHidden(store.read.forPlan('A'), 'offering', 'G01', false),
    );

    expect(store.read.forPlan('A').hiddenGroups).toEqual([]);
    expect(store.read.forPlan('B').hiddenGroups).toEqual([
      calendarGroupKey('offering', 'G02'),
    ]);
  });
});
