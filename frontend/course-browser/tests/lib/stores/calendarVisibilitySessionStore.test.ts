
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
      store.forPlan('A'),
      'offering-A',
      'exercise',
      true,
    );
    store.setForPlan('A', aHidden);

    expect(store.forPlan('B').hiddenGroups).toEqual([]);

    const bHidden = setCalendarGroupHidden(
      store.forPlan('B'),
      'offering-B',
      'lecture',
      true,
    );
    store.setForPlan('B', bHidden);

    expect(store.forPlan('A').hiddenGroups).toEqual([
      calendarGroupKey('offering-A', 'exercise'),
    ]);
    expect(store.forPlan('B').hiddenGroups).toEqual([
      calendarGroupKey('offering-B', 'lecture'),
    ]);
  });

  it('maintains state across consumers but resets when a new session is created', () => {
    const session = createCalendarVisibilitySessionStore();

    session.setForPlan(
      'plan',
      setCalendarGroupHidden(
        session.forPlan('plan'),
        'offering',
        'group',
        true,
      ),
    );

    expect(session.forPlan('plan').hiddenGroups).toHaveLength(1);
    expect(session.forPlan('plan').hiddenGroups).toHaveLength(1);

    expect(
      createCalendarVisibilitySessionStore().forPlan('plan').hiddenGroups,
    ).toEqual([]);

    expect(session.forPlan(undefined).hiddenGroups).toEqual([]);
  });

  it('treats prototype-like plan IDs as independent identifiers', () => {
    const store = createCalendarVisibilitySessionStore();

    for (const planId of ['__proto__', 'constructor', 'toString']) {
      expect(store.forPlan(planId).hiddenGroups).toEqual([]);
    }

    for (const planId of ['__proto__', 'constructor', 'toString']) {
      store.setForPlan(
        planId,
        setCalendarGroupHidden(
          store.forPlan(planId),
          `offering-${planId}`,
          'exercise',
          true,
        ),
      );
    }

    for (const planId of ['__proto__', 'constructor', 'toString']) {
      expect(store.forPlan(planId).hiddenGroups).toEqual([
        calendarGroupKey(`offering-${planId}`, 'exercise'),
      ]);
    }

    expect(store.forPlan('unrelated').hiddenGroups).toEqual([]);
  });

  it('updates one plan without modifying another plan', () => {
    const store = createCalendarVisibilitySessionStore();

    store.setForPlan(
      'A',
      setCalendarGroupHidden(store.forPlan('A'), 'offering', 'G01', true),
    );

    store.setForPlan(
      'B',
      setCalendarGroupHidden(store.forPlan('B'), 'offering', 'G02', true),
    );

    store.setForPlan(
      'A',
      setCalendarGroupHidden(store.forPlan('A'), 'offering', 'G01', false),
    );

    expect(store.forPlan('A').hiddenGroups).toEqual([]);
    expect(store.forPlan('B').hiddenGroups).toEqual([
      calendarGroupKey('offering', 'G02'),
    ]);
  });
});
