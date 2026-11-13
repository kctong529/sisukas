import { describe, expect, it } from 'vitest';

import { calendarGroupKey } from '@application/calendar/calendarVisibility';
import {
  chooseCalendarGroup,
  offeringHasVisibilityChanges,
  showAllCalendarGroups,
} from '@application/calendar/calendarVisibilityShortcuts';

const groups = [
  { id: 'E1', type: 'Exercise' },
  { id: 'E2', type: ' exercise ' },
  { id: 'L1', type: 'Lecture' },
];
const key = (offering: string, group: string) => JSON.stringify(['series', offering, group, 'series-id', '2026-11-02T08:00:00Z']);

describe('Calendar group preference shortcuts (#101)', () => {
  it('chooses a group without modifying lectures or other courses', () => {
    const changes = chooseCalendarGroup('offering', 'E1', groups, {
      hiddenGroups: [calendarGroupKey('offering', 'E1'), calendarGroupKey('other', 'E2')],
      occurrenceOverrides: {},
    });
    expect(changes.groups).toEqual([{ groupId: 'E1', hidden: false }, { groupId: 'E2', hidden: true }]);
  });
  it('keeps chosen group skips but clears explicitly visible sibling occurrences', () => {
    const chosenKey = key('offering', 'E1');
    const siblingKey = key('offering', 'E2');
    const otherKey = key('elsewhere', 'E2');
    const changes = chooseCalendarGroup('offering', 'E1', groups, {
      hiddenGroups: [calendarGroupKey('offering', 'E2')],
      occurrenceOverrides: { [chosenKey]: 'hidden', [siblingKey]: 'visible', [otherKey]: 'visible' },
    });
    expect(changes.groups).toEqual([]);
    expect(changes.occurrenceKeysToReset).toEqual([siblingKey]);
  });
  it('ignores unknown groups without making arbitrary choices', () => {
    expect(chooseCalendarGroup('offering', 'missing', groups, {
      hiddenGroups: [], occurrenceOverrides: {},
    })).toEqual({ groups: [], occurrenceKeysToReset: [] });
  });
  it('restores hidden groups and all occurrence overrides scoped to the offering', () => {
    const own = key('offering', 'E1');
    const foreign = key('elsewhere', 'E1');
    const visibility = {
      hiddenGroups: [calendarGroupKey('offering', 'E1'), calendarGroupKey('elsewhere', 'E1')],
      occurrenceOverrides: { [own]: 'hidden' as const, [foreign]: 'visible' as const },
    };
    expect(offeringHasVisibilityChanges('offering', visibility)).toBe(true);
    expect(showAllCalendarGroups('offering', visibility)).toEqual({
      groups: [{ groupId: 'E1', hidden: false }], occurrenceKeysToReset: [own],
    });
    expect(offeringHasVisibilityChanges('none', visibility)).toBe(false);
  });
  it('includes dormant preferences for groups absent from loaded teaching data', () => {
    expect(showAllCalendarGroups('offering', {
      hiddenGroups: [calendarGroupKey('offering', 'archived')],
      occurrenceOverrides: { [key('offering', 'archived')]: 'visible' },
    })).toEqual({
      groups: [{ groupId: 'archived', hidden: false }],
      occurrenceKeysToReset: [key('offering', 'archived')],
    });
  });
});
