import { calendarGroupKey } from './calendarVisibility';

import type { CalendarVisibility } from './calendarVisibility';

export interface CalendarGroupPreference {
  courseOfferingId: string;
  studyGroupId: string;
}

export interface CalendarOccurrencePreference extends CalendarGroupPreference {
  occurrenceKeyVersion: 1;
  occurrenceKey: string;
  visibility: 'visible' | 'hidden';
}

export interface CalendarPreferenceResponse {
  hiddenGroups: CalendarGroupPreference[];
  occurrenceOverrides: CalendarOccurrencePreference[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGroup(value: unknown): value is CalendarGroupPreference {
  return isRecord(value) &&
    typeof value.courseOfferingId === 'string' && value.courseOfferingId.length > 0 &&
    typeof value.studyGroupId === 'string' && value.studyGroupId.length > 0;
}

function isValidOccurrenceKey(record: CalendarOccurrencePreference): boolean {
  try {
    const fields: unknown = JSON.parse(record.occurrenceKey);
    if (!Array.isArray(fields) || JSON.stringify(fields) !== record.occurrenceKey) return false;
    if (fields[1] !== record.courseOfferingId || fields[2] !== record.studyGroupId) return false;
    if (fields[0] === 'series') {
      return fields.length === 5 && typeof fields[3] === 'string' && fields[3].length > 0 &&
        typeof fields[4] === 'number' && Number.isSafeInteger(fields[4]);
    }
    if (fields[0] === 'fallback') {
      return fields.length === 9 &&
        typeof fields[3] === 'number' && Number.isSafeInteger(fields[3]) &&
        typeof fields[4] === 'number' && Number.isSafeInteger(fields[4]) &&
        Array.isArray(fields[5]) && fields[5].every((id: unknown) => typeof id === 'string') &&
        typeof fields[6] === 'boolean' && typeof fields[7] === 'boolean' &&
        (fields[8] === null || typeof fields[8] === 'string');
    }
    return false;
  } catch {
    return false;
  }
}

function isOccurrence(value: unknown): value is CalendarOccurrencePreference {
  if (!isRecord(value) || !isGroup(value)) return false;
  const record: Record<string, unknown> = value;
  return record.occurrenceKeyVersion === 1 &&
    typeof record.occurrenceKey === 'string' &&
    (record.visibility === 'visible' || record.visibility === 'hidden') &&
    isValidOccurrenceKey(record as unknown as CalendarOccurrencePreference);
}

/** Reject unexpected payloads instead of treating a failed/partial load as default visibility. */
export function parseCalendarPreferenceResponse(value: unknown): CalendarPreferenceResponse {
  if (!isRecord(value) || !Array.isArray(value.hiddenGroups) ||
    !Array.isArray(value.occurrenceOverrides) ||
    !value.hiddenGroups.every(isGroup) || !value.occurrenceOverrides.every(isOccurrence)) {
    throw new Error('Invalid Calendar preference response');
  }
  return {
    hiddenGroups: value.hiddenGroups,
    occurrenceOverrides: value.occurrenceOverrides,
  };
}

/** Keep the current local visibility model and preserve unmatched/dormant preferences. */
export function toCalendarVisibility(response: CalendarPreferenceResponse): CalendarVisibility {
  const hiddenGroups = new Set<string>();
  const occurrenceOverrides: Record<string, 'visible' | 'hidden'> = Object.create(null);
  for (const group of response.hiddenGroups) {
    hiddenGroups.add(calendarGroupKey(group.courseOfferingId, group.studyGroupId));
  }
  for (const occurrence of response.occurrenceOverrides) {
    const previous = occurrenceOverrides[occurrence.occurrenceKey];
    if (previous !== undefined && previous !== occurrence.visibility) {
      throw new Error('Conflicting Calendar occurrence preferences');
    }
    occurrenceOverrides[occurrence.occurrenceKey] = occurrence.visibility;
  }
  return { hiddenGroups: [...hiddenGroups], occurrenceOverrides };
}
