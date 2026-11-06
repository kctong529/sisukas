import { describe, expect, it } from 'vitest';
import { fixed } from '../../domain/services/calendar/layout/fixtures';
import {
  EMPTY_CALENDAR_VISIBILITY, calendarEntryVisible, calendarGroupKey,
  setCalendarGroupHidden, setCalendarOccurrenceVisibility,
} from '../../../src/application/calendar/calendarVisibility';

const a = fixed('occ-a', '2026-11-02T09:00:00+02:00', '2026-11-02T10:00:00+02:00');
const b = fixed('occ-b', '2026-11-03T09:00:00+02:00', '2026-11-03T10:00:00+02:00');

describe('calendar display visibility', () => {
  it('defaults all entries to visible without modifying the source', () => {
    expect(calendarEntryVisible(a, EMPTY_CALENDAR_VISIBILITY)).toBe(true);
    expect(a.source.event.excluded).toBe(false);
  });

  it('hides the group without changing planning choices or adjacent groups', () => {
    const visibility = setCalendarGroupHidden(EMPTY_CALENDAR_VISIBILITY, 'offering', 'group', true);
    const anotherGroup = fixed('other', '2026-11-02T11:00:00+02:00', '2026-11-02T12:00:00+02:00', { group: 'other' });
    expect(calendarEntryVisible(a, visibility)).toBe(false);
    expect(calendarEntryVisible(b, visibility)).toBe(false);
    expect(calendarEntryVisible(anotherGroup, visibility)).toBe(true);
    expect(a.source.event.excluded).toBe(false);
    expect(calendarEntryVisible(a, setCalendarGroupHidden(visibility, 'offering', 'group', false))).toBe(true);
  });

  it('scopes group keys by offering and avoids delimiter collisions', () => {
    expect(calendarGroupKey('a:b', 'c')).not.toBe(calendarGroupKey('a', 'b:c'));
    const otherOffering = { ...a, source: { ...a.source, courseOfferingId: 'different' } };
    const visibility = setCalendarGroupHidden(EMPTY_CALENDAR_VISIBILITY, 'offering', 'group', true);
    expect(calendarEntryVisible(otherOffering, visibility)).toBe(true);
  });

  it('allows a specific occurrence to be restored inside a hidden group', () => {
    const hidden = setCalendarGroupHidden(EMPTY_CALENDAR_VISIBILITY, 'offering', 'group', true);
    const restored = setCalendarOccurrenceVisibility(hidden, ['occ-a'], 'visible');
    expect(calendarEntryVisible(a, restored)).toBe(true);
    expect(calendarEntryVisible(b, restored)).toBe(false);
    const cleared = setCalendarOccurrenceVisibility(restored, ['occ-a'], null);
    expect(calendarEntryVisible(a, cleared)).toBe(false);
  });

  it('hides only one occurrence in a visible group', () => {
    const hidden = setCalendarOccurrenceVisibility(EMPTY_CALENDAR_VISIBILITY, ['occ-a'], 'hidden');
    expect(calendarEntryVisible(a, hidden)).toBe(false);
    expect(calendarEntryVisible(b, hidden)).toBe(true);
    expect(calendarEntryVisible(a, setCalendarOccurrenceVisibility(hidden, ['occ-a'], null))).toBe(true);
  });

  it('retains ambiguous identity entries under group visibility only', () => {
    const ambiguous = { ...a, occurrenceKey: null };
    const visibility = setCalendarOccurrenceVisibility(EMPTY_CALENDAR_VISIBILITY, ['occ-a'], 'hidden');
    expect(calendarEntryVisible(ambiguous, visibility)).toBe(true);
    const groupHidden = setCalendarGroupHidden(visibility, 'offering', 'group', true);
    expect(calendarEntryVisible(ambiguous, groupHidden)).toBe(false);
  });

  it('treats prototype-like keys as data and does not mutate prior state', () => {
    const first = setCalendarOccurrenceVisibility(EMPTY_CALENDAR_VISIBILITY, ['__proto__', 'constructor'], 'hidden');
    expect(first.occurrenceOverrides['__proto__']).toBe('hidden');
    expect(first.occurrenceOverrides['constructor']).toBe('hidden');
    expect(Object.keys(EMPTY_CALENDAR_VISIBILITY.occurrenceOverrides)).toHaveLength(0);
  });
});
