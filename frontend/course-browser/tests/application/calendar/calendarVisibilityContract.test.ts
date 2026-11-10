import { describe, expect, it } from 'vitest';

import {
  calendarEntryVisible,
  calendarGroupKey,
  EMPTY_CALENDAR_VISIBILITY,
  setCalendarGroupHidden,
  setCalendarOccurrenceVisibility,
} from '@application/calendar/calendarVisibility';
import {
  deriveCalendarOccurrenceKey,
  identifyCalendarOccurrences,
} from '@domain/services/calendar/CalendarOccurrenceIdentity';

import type { CalendarEntry } from '@domain/models/CalendarEntry';
import type { CalendarOccurrenceCandidate } from '@domain/services/calendar/CalendarOccurrenceIdentity';
import type { StudyEvent } from '@modules/study-groups';

function candidate(overrides: Partial<CalendarOccurrenceCandidate> = {}): CalendarOccurrenceCandidate {
  const event: StudyEvent = {
    id: 'legacy:0', start: '2026-11-02T10:00:00', end: '2026-11-02T11:00:00',
    startIso: '2026-11-02T10:00:00+02:00', endIso: '2026-11-02T11:00:00+02:00',
    seriesId: 'series-1', cancelled: false, excluded: false, notice: null,
    locationIds: ['room-2', 'room-1'], locations: [],
  };
  return {
    courseOfferingId: 'offering-1', studyGroupId: 'group-1',
    event, interval: {startMs: 1_000, endMs: 2_000}, ...overrides,
  };
}

function entry(input: CalendarOccurrenceCandidate, occurrenceKey: string | null): CalendarEntry {
  return {
    kind: 'fixed', occurrenceKey, interval: input.interval,
    source: {
      courseOfferingId: input.courseOfferingId, studyGroupId: input.studyGroupId,
      seriesId: input.event.seriesId ?? null, event: input.event,
    },
  };
}

describe('calendar visibility persistence contract (#189)', () => {
  it('keeps the current v1 series key intact, including offering and group scope', () => {
    const key = deriveCalendarOccurrenceKey(candidate());
    expect(JSON.parse(key)).toEqual(['series', 'offering-1', 'group-1', 'series-1', 1_000]);
  });

  it('keeps the fallback key deterministic and distinct from a series key', () => {
    const base = candidate();
    const fallback = candidate({event: {...base.event, seriesId: null}});
    expect(JSON.parse(deriveCalendarOccurrenceKey(fallback))).toEqual([
      'fallback', 'offering-1', 'group-1', 1_000, 2_000,
      ['room-1', 'room-2'], false, false, null,
    ]);
    expect(deriveCalendarOccurrenceKey(fallback)).not.toBe(deriveCalendarOccurrenceKey(base));
  });

  it('preserves explicit visible inside a hidden group after JSON serialization', () => {
    const source = candidate();
    const key = deriveCalendarOccurrenceKey(source);
    const hidden = setCalendarGroupHidden(EMPTY_CALENDAR_VISIBILITY, 'offering-1', 'group-1', true);
    const shown = setCalendarOccurrenceVisibility(hidden, [key], 'visible');
    const restored = JSON.parse(JSON.stringify(shown));
    expect(calendarEntryVisible(entry(source, key), restored)).toBe(true);
    expect(calendarEntryVisible(entry(source, null), restored)).toBe(false);
    const inherited = setCalendarOccurrenceVisibility(restored, [key], null);
    expect(calendarEntryVisible(entry(source, key), inherited)).toBe(false);
  });

  it('keeps group preferences independent when groups share a name or ID across offerings', () => {
    const hidden = setCalendarGroupHidden(EMPTY_CALENDAR_VISIBILITY, 'offering-1', 'group-1', true);
    expect(hidden.hiddenGroups).toContain(calendarGroupKey('offering-1', 'group-1'));
    expect(hidden.hiddenGroups).not.toContain(calendarGroupKey('offering-2', 'group-1'));
    const other = candidate({courseOfferingId: 'offering-2'});
    expect(calendarEntryVisible(entry(other, deriveCalendarOccurrenceKey(other)), hidden)).toBe(true);
  });

  it('does not reapply an old override after a start-time change', () => {
    const before = candidate();
    const after = candidate({interval: {startMs: 3_000, endMs: 4_000}});
    const oldKey = deriveCalendarOccurrenceKey(before);
    const override = setCalendarOccurrenceVisibility(EMPTY_CALENDAR_VISIBILITY, [oldKey], 'hidden');
    expect(calendarEntryVisible(entry(before, oldKey), override)).toBe(false);
    expect(calendarEntryVisible(entry(after, deriveCalendarOccurrenceKey(after)), override)).toBe(true);
    expect(override.occurrenceOverrides[oldKey]).toBe('hidden');
  });

  it('never applies occurrence overrides to collided identities', () => {
    const source = candidate();
    const duplicates = identifyCalendarOccurrences([source, source]);
    expect(duplicates.occurrences.map(item => item.occurrenceKey)).toEqual([null, null]);
    const oldKey = deriveCalendarOccurrenceKey(source);
    const hidden = setCalendarOccurrenceVisibility(EMPTY_CALENDAR_VISIBILITY, [oldKey], 'hidden');
    expect(calendarEntryVisible(entry(source, null), hidden)).toBe(true);
  });
});
