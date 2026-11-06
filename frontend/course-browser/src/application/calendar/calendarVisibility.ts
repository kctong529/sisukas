import type { CalendarEntry } from '@domain/models/CalendarEntry';

/** Local display preferences only. Never changes planning choices or source records. */
export interface CalendarVisibility {
  hiddenGroups: readonly string[];
  /** Explicit overrides take priority over group-wide visibility. */
  occurrenceOverrides: Readonly<Record<string, 'visible' | 'hidden'>>;
}

export const EMPTY_CALENDAR_VISIBILITY: CalendarVisibility = {
  hiddenGroups: [],
  occurrenceOverrides: {},
};

/** Group IDs are only unique within their course offering. */
export function calendarGroupKey(offeringId: string, groupId: string): string {
  return JSON.stringify([offeringId, groupId]);
}

export function calendarEntryVisible(entry: CalendarEntry, visibility: CalendarVisibility): boolean {
  const override = entry.occurrenceKey !== null &&
    Object.hasOwn(visibility.occurrenceOverrides, entry.occurrenceKey)
    ? visibility.occurrenceOverrides[entry.occurrenceKey] : undefined;
  if (override) return override === 'visible';
  return !visibility.hiddenGroups.includes(calendarGroupKey(
    entry.source.courseOfferingId, entry.source.studyGroupId,
  ));
}

export function setCalendarGroupHidden(
  visibility: CalendarVisibility, offeringId: string, groupId: string, hidden: boolean,
): CalendarVisibility {
  const key = calendarGroupKey(offeringId, groupId);
  return {
    ...visibility,
    hiddenGroups: hidden
      ? [...new Set([...visibility.hiddenGroups, key])]
      : visibility.hiddenGroups.filter(item => item !== key),
  };
}

export function setCalendarOccurrenceVisibility(
  visibility: CalendarVisibility, occurrenceKeys: readonly string[],
  state: 'visible' | 'hidden' | null,
): CalendarVisibility {
  const overrides: Record<string, 'visible' | 'hidden'> = Object.assign(
    Object.create(null), visibility.occurrenceOverrides,
  );
  for (const key of occurrenceKeys) {
    if (state === null) delete overrides[key];
    else overrides[key] = state;
  }
  return { ...visibility, occurrenceOverrides: overrides };
}
