import { describe, expect, it } from 'vitest';

import {
  parseCalendarPreferenceResponse,
  toCalendarVisibility,
} from '@application/calendar/calendarPreferenceMapping';
import { calendarGroupKey } from '@application/calendar/calendarVisibility';

const key = JSON.stringify(['series', 'offering-a', 'group-a', 'series-1', 1790000000000]);

function snapshot() {
  return {
    hiddenGroups: [{ courseOfferingId: 'offering-a', studyGroupId: 'group-a' }],
    occurrenceOverrides: [{
      courseOfferingId: 'offering-a', studyGroupId: 'group-a',
      occurrenceKeyVersion: 1, occurrenceKey: key, visibility: 'visible',
    }],
  };
}

describe('Calendar preference API mapping', () => {
  it('converts confirmed-empty response to empty local visibility', () => {
    const visibility = toCalendarVisibility(parseCalendarPreferenceResponse({
      hiddenGroups: [], occurrenceOverrides: [],
    }));
    expect(visibility.hiddenGroups).toEqual([]);
    expect(visibility.occurrenceOverrides).toEqual({});
  });

  it('preserves scoped hidden groups and exact explicit-visible occurrence keys', () => {
    const visibility = toCalendarVisibility(parseCalendarPreferenceResponse(snapshot()));
    expect(visibility.hiddenGroups).toEqual([calendarGroupKey('offering-a', 'group-a')]);
    expect(visibility.occurrenceOverrides[key]).toBe('visible');
  });

  it('keeps dormant keys rather than filtering them against current offerings', () => {
    const snapshotWithDormant = snapshot();
    snapshotWithDormant.hiddenGroups.push({ courseOfferingId: 'absent', studyGroupId: 'group-b' });
    const visibility = toCalendarVisibility(parseCalendarPreferenceResponse(snapshotWithDormant));
    expect(visibility.hiddenGroups).toContain(calendarGroupKey('absent', 'group-b'));
  });

  it.each([
    null, {}, { hiddenGroups: [] },
    { hiddenGroups: [], occurrenceOverrides: null },
    { hiddenGroups: [{ courseOfferingId: 'a' }], occurrenceOverrides: [] },
  ])('rejects malformed or incomplete payloads: %j', (input) => {
    expect(() => parseCalendarPreferenceResponse(input)).toThrow('Invalid Calendar preference response');
  });

  it('rejects a record whose serialized identity belongs to another group', () => {
    const input = snapshot();
    input.occurrenceOverrides[0].studyGroupId = 'different';
    expect(() => parseCalendarPreferenceResponse(input)).toThrow();
  });

  it('rejects invalid versions, visibility and noncanonical occurrence keys', () => {
    for (const update of [
      { occurrenceKeyVersion: 2 },
      { visibility: 'inherit' },
      { occurrenceKey: '[ "series", "offering-a", "group-a", "series-1", 1790000000000 ]' },
    ]) {
      const input = snapshot();
      Object.assign(input.occurrenceOverrides[0], update);
      expect(() => parseCalendarPreferenceResponse(input)).toThrow();
    }
  });

  it('rejects conflicting duplicate occurrence overrides', () => {
    const parsed = parseCalendarPreferenceResponse(snapshot());
    parsed.occurrenceOverrides.push({ ...parsed.occurrenceOverrides[0], visibility: 'hidden' });
    expect(() => toCalendarVisibility(parsed)).toThrow('Conflicting Calendar occurrence preferences');
  });
});
