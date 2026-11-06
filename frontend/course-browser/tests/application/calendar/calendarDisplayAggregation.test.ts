import { describe, expect, it } from 'vitest';
import { aggregateCalendarDisplayEntries, displayEntryLocations } from '../../../src/application/calendar/calendarDisplayAggregation';
import { layoutCalendarWeek } from '../../../src/domain/services/calendar/layout/WeeklyCalendarLayout';
import { denseOverlapPresentation } from '../../../src/application/calendar/denseOverlapPresentation';
import { fixed } from '../../domain/services/calendar/layout/fixtures';
import type { FixedCalendarOccurrence } from '../../../src/domain/models/CalendarEntry';
import scenario from '../../fixtures/calendar/december-2026-multi-room.json';

function inRoom(id: string, room: string, options: {
  offering?: string; group?: string; series?: string | null; notice?: string;
  cancelled?: boolean; start?: string; end?: string;
} = {}): FixedCalendarOccurrence {
  const entry = fixed(id, options.start ?? '2026-11-02T10:00:00+02:00',
    options.end ?? '2026-11-02T11:00:00+02:00',
    { group: options.group ?? 'exam' });
  return {
    ...entry,
    source: {
      ...entry.source,
      courseOfferingId: options.offering ?? 'math',
      seriesId: options.series === undefined ? id : options.series,
      event: {
        ...entry.source.event,
        cancelled: options.cancelled ?? false,
        notice: options.notice ?? null,
        locationIds: [room],
        locations: [{ id: room, name: room, buildingName: 'Undergraduate Centre' }],
      },
    },
  };
}

describe('calendar display aggregation', () => {
  it('folds distinct room records while preserving every original source member', () => {
    const source = [inRoom('a', 'U157'), inRoom('b', 'Y122'), inRoom('c', 'Y202a')];
    const snapshot = JSON.stringify(source);
    const result = aggregateCalendarDisplayEntries(source);
    expect(result.entries).toHaveLength(1);
    const members = result.membersByEntry.get(result.entries[0]);
    expect(members).toHaveLength(3);
    expect(new Set(members)).toEqual(new Set(source));
    expect(displayEntryLocations(members!)).toEqual([
      'Undergraduate Centre · U157',
      'Undergraduate Centre · Y122',
      'Undergraduate Centre · Y202a',
    ]);
    expect(JSON.stringify(source)).toBe(snapshot);
  });

  it('never merges distinct offerings or study-group identities', () => {
    const entries = [inRoom('a', 'U157'), inRoom('b', 'Y122', { group: 'retake' }),
      inRoom('c', 'Y202a', { offering: 'other' })];
    expect(aggregateCalendarDisplayEntries(entries).entries).toHaveLength(3);
  });

  it('keeps distinct intervals, cancellation and notices separate', () => {
    const entries = [inRoom('a', 'U157'),
      inRoom('b', 'Y122', { end: '2026-11-02T12:00:00+02:00' }),
      inRoom('c', 'Y202a', { cancelled: true }),
      inRoom('d', 'Y203a', { notice: 'Special arrangements' })];
    expect(aggregateCalendarDisplayEntries(entries).entries).toHaveLength(4);
  });

  it('leaves ambiguous rooms, repeated series and missing locations unmerged', () => {
    const repeated = [inRoom('a', 'U157'), inRoom('b', 'U157')];
    const sameSeries = [inRoom('a', 'U157', { series: 'same' }),
      inRoom('b', 'Y122', { series: 'same' })];
    const missing = [inRoom('a', 'U157'), inRoom('b', '')];
    for (const entries of [repeated, sameSeries, missing]) {
      expect(aggregateCalendarDisplayEntries(entries).entries).toHaveLength(2);
    }
  });

  it('preserves distinct source identities and deterministic representatives when reordered', () => {
    const entries = [inRoom('a', 'U157'), inRoom('b', 'Y122'), inRoom('c', 'Y202a')];
    const first = aggregateCalendarDisplayEntries(entries);
    const reversed = aggregateCalendarDisplayEntries([...entries].reverse());
    expect(first.entries[0]).toBe(reversed.entries[0]);
    expect(first.membersByEntry.get(first.entries[0])).toEqual(reversed.membersByEntry.get(reversed.entries[0]));
  });

  it('reproduces the 23-source-event December 1 exam case as three visual items', () => {
    const entries: FixedCalendarOccurrence[] = scenario.map((record, index) => {
      const entry = fixed(`source-${index}`, record.startIso, record.endIso);
      return {
        ...entry,
        source: {
          ...entry.source,
          courseOfferingId: record.offeringId,
          studyGroupId: record.groupId,
          studyGroupName: record.groupName,
          studyGroupType: record.type,
          seriesId: record.seriesId,
          event: {
            ...entry.source.event,
            seriesId: record.seriesId,
            locationIds: record.locations.map(room => room.id),
            locations: record.locations.map(room => ({
              id: room.id, name: room.name,
              buildingName: room.building_name,
              buildingId: room.building_id,
              address: room.address,
            })),
          },
        },
      };
    });
    const display = aggregateCalendarDisplayEntries(entries);
    expect(entries).toHaveLength(23);
    expect(display.entries).toHaveLength(3);
    const counts = display.entries.map(entry => display.membersByEntry.get(entry)?.length ?? 1).sort((a, b) => a - b);
    expect(counts).toEqual([1, 11, 11]);
    const layout = layoutCalendarWeek(display.entries, '2026-11-30');
    expect(layout.segments).toHaveLength(3);
    expect(Math.max(...layout.segments.map(segment => segment.columnCount))).toBe(3);
    expect(denseOverlapPresentation(layout).displays).toHaveLength(0);
  });
});
