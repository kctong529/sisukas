import { calendarGroupKey } from './calendarVisibility';

import type { CalendarVisibility } from './calendarVisibility';

export interface GroupChoice {
  id: string;
  type: string;
}

export interface GroupVisibilityChange {
  groupId: string;
  hidden: boolean;
}

export interface CalendarVisibilityChanges {
  groups: readonly GroupVisibilityChange[];
  occurrenceKeysToReset: readonly string[];
}

/** Choosing a group affects only sibling groups of the same teaching type. */
export function chooseCalendarGroup(
  offeringId: string,
  selectedId: string,
  groups: readonly GroupChoice[],
  visibility: CalendarVisibility,
): CalendarVisibilityChanges {
  const selected = groups.find(group => group.id === selectedId);
  if (!selected) return { groups: [], occurrenceKeysToReset: [] };
  const groupType = selected.type.trim().toLowerCase();
  const changes: GroupVisibilityChange[] = [];
  for (const group of groups) {
    if (group.type.trim().toLowerCase() !== groupType) continue;
    const hidden = group.id !== selectedId;
    if (visibility.hiddenGroups.includes(calendarGroupKey(offeringId, group.id)) !== hidden) {
      changes.push({ groupId: group.id, hidden });
    }
  }
  const siblingIds = new Set(groups.filter(group => group.id !== selectedId &&
    group.type.trim().toLowerCase() === groupType).map(group => group.id));
  const occurrenceKeysToReset = Object.entries(visibility.occurrenceOverrides)
    .filter(([key, value]) => {
      const identity = parseIdentity(key);
      return value === 'visible' && identity?.[1] === offeringId &&
        typeof identity[2] === 'string' && siblingIds.has(identity[2]);
    }).map(([key]) => key);
  return { groups: changes, occurrenceKeysToReset };
}

function parseIdentity(key: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(key);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function offeringHasVisibilityChanges(offeringId: string, visibility: CalendarVisibility): boolean {
  const changes = showAllCalendarGroups(offeringId, visibility);
  return changes.groups.length > 0 || changes.occurrenceKeysToReset.length > 0;
}

/** Restore the entire offering, including dormant group and occurrence preferences. */
export function showAllCalendarGroups(
  offeringId: string,
  visibility: CalendarVisibility,
): CalendarVisibilityChanges {
  const groups: GroupVisibilityChange[] = [];
  for (const key of visibility.hiddenGroups) {
    const identity = parseIdentity(key);
    if (identity && identity.length === 2 && identity[0] === offeringId &&
      typeof identity[1] === 'string') {
      groups.push({ groupId: identity[1], hidden: false });
    }
  }
  const occurrenceKeysToReset = Object.keys(visibility.occurrenceOverrides).filter(key => {
    // The stable occurrence contract uses [namespace, offeringId, groupId, ...].
    const identity = parseIdentity(key);
    return identity !== null && identity[1] === offeringId &&
      (identity[0] === 'series' || identity[0] === 'fallback');
  });
  return { groups, occurrenceKeysToReset };
}
