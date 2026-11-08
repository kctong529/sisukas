import { describe, expect, it } from 'vitest';
import type { StudyEvent } from '../../../src/modules/study-groups/models/StudyEvent';
import { aggregateStudyEventsByTimeSlot } from '../../../src/lib/analytics/aggregateStudyEventsByTimeSlot';

const START = '2026-11-02T10:15:00';
const END = '2026-11-02T12:00:00';

function event(overrides: Partial<StudyEvent> = {}): StudyEvent {
  return {
    id: 'group:0', start: START, end: END,
    cancelled: false, excluded: false, locationIds: [], locations: [],
    ...overrides,
  };
}

describe('aggregateStudyEventsByTimeSlot: equivalence classes and boundaries', () => {
  it('returns an empty array for an empty input', () => {
    expect(aggregateStudyEventsByTimeSlot([])).toEqual([]);
  });

  it('keeps one event as one slot and excludes source identity/status metadata', () => {
    expect(aggregateStudyEventsByTimeSlot([event({
      seriesId: 'series-A', cancelled: true, excluded: true, notice: 'Cancelled', location: 'A',
    })])).toEqual([{ start: START, end: END, startIso: undefined, endIso: undefined, location: 'A' }]);
  });

  it('merges equal time slots, locations in encounter order, and keeps first timestamps', () => {
    const slots = aggregateStudyEventsByTimeSlot([
      event({ id: '1', location: ' Room A ', startIso: '2026-11-02T10:15:00+02:00' }),
      event({ id: '2', seriesId: 'different-series', location: 'Room B', startIso: 'different' }),
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({
      start: START, end: END, startIso: '2026-11-02T10:15:00+02:00',
      endIso: undefined, location: 'Room A, Room B',
    });
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['whitespace', '   '],
  ])('skips %s locations', (_label, location) => {
    const result = aggregateStudyEventsByTimeSlot([
      event({ location }), event({ location: 'Room A' }),
    ]);
    expect(result[0].location).toBe('Room A');
  });

  it('returns undefined location when none is meaningful', () => {
    expect(aggregateStudyEventsByTimeSlot([event({ location: '  ' }), event()])[0].location)
      .toBeUndefined();
  });

  it('treats touching intervals as distinct rather than overlapping/merging', () => {
    const slots = aggregateStudyEventsByTimeSlot([
      event({ start: '2026-11-02T09:00:00', end: '2026-11-02T10:00:00' }),
      event({ start: '2026-11-02T10:00:00', end: '2026-11-02T11:00:00' }),
    ]);
    expect(slots).toHaveLength(2);
  });

  it('does not merge equal starts with different ends or equal ends with different starts', () => {
    const slots = aggregateStudyEventsByTimeSlot([
      event(), event({ end: '2026-11-02T12:01:00' }),
      event({ start: '2026-11-02T10:16:00' }),
    ]);
    expect(slots).toHaveLength(3);
  });

  it('preserves first-encounter order of distinct slots', () => {
    const slots = aggregateStudyEventsByTimeSlot([
      event({ start: 'C', end: 'D', location: 'first' }),
      event({ start: 'A', end: 'B', location: 'second' }),
      event({ start: 'C', end: 'D', location: 'third' }),
    ]);
    expect(slots.map(s => s.start)).toEqual(['C', 'A']);
    expect(slots[0].location).toBe('first, third');
  });

  it('does not accidentally collide keys containing separator characters', () => {
    const slots = aggregateStudyEventsByTimeSlot([
      event({ start: 'a:b', end: 'c' }),
      event({ start: 'a', end: 'b:c' }),
    ]);
    expect(slots).toHaveLength(2);
  });

  it('groups by original start/end strings, even when ISO representations differ', () => {
    const slots = aggregateStudyEventsByTimeSlot([
      event({ startIso: '2026-11-02T10:15:00+02:00' }),
      event({ startIso: '2026-11-02T09:15:00+01:00' }),
    ]);
    expect(slots).toHaveLength(1);
  });

  it('does not normalize equivalent instants expressed with different original strings', () => {
    const slots = aggregateStudyEventsByTimeSlot([
      event({ start: '2026-11-02T10:15:00+02:00', end: '2026-11-02T12:00:00+02:00' }),
      event({ start: '2026-11-02T08:15:00Z', end: '2026-11-02T10:00:00Z' }),
    ]);
    expect(slots).toHaveLength(2);
  });

  it('leaves the original array and nested source objects unchanged', () => {
    const input = [event({ locationIds: ['r1'], locations: [{ id: 'r1', name: 'Room A' }] })];
    const before = structuredClone(input);
    const result = aggregateStudyEventsByTimeSlot(input);
    expect(input).toEqual(before);
    result[0].location = 'changed';
    expect(input).toEqual(before);
  });
});
