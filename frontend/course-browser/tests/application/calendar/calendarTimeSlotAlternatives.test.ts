import { describe, expect, it } from 'vitest';

import { calendarTimeSlotAlternatives } from '@application/calendar/calendarTimeSlotAlternatives';
import { calendarGroupKey } from '@application/calendar/calendarVisibility';

import type { FixedCalendarOccurrence } from '@domain/models/CalendarEntry';
import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';

function segment(id: string, start: number, end: number, offering = 'first', occurrenceKey: string | null = id): WeeklyCalendarSegment {
  const entry: FixedCalendarOccurrence = {
    kind: 'fixed', occurrenceKey,
    interval: { startMs: start, endMs: end },
    source: {
      courseOfferingId: offering, studyGroupId: id, seriesId: id,
      event: { id, start: '', end: '', locationIds: [], locations: [], cancelled: false, excluded: false },
    },
  };
  return { id, entry, dayIndex: 0, localDate: '2026-11-09', interval: entry.interval,
    startMinute: 600, endMinute: 660, startUtcOffsetMinutes: 120, endUtcOffsetMinutes: 120,
    continuesBefore: false, continuesAfter: false, conflictEligible: true,
    overlapGroupId: null, columnIndex: 0, columnCount: 1 };
}

const describeSegment = (s: WeeklyCalendarSegment) => ({
  courseCode: s.entry.source.courseOfferingId,
  courseTitle: s.entry.source.courseOfferingId,
  groupLabel: s.entry.source.studyGroupId,
  locationLabel: null,
});
const getMembers = (s: WeeklyCalendarSegment) => [s.entry];
const getSelection = () => 'candidate' as const;

describe('time-slot alternatives (#103)', () => {
  it('discovers hidden cross-course overlaps, not touching or chain-only events', () => {
    const a = segment('a', 100, 200);
    const b = segment('b', 150, 250, 'other');
    const c = segment('c', 225, 300, 'other');
    const d = segment('d', 200, 250, 'other');
    const hidden = { hiddenGroups: [calendarGroupKey('other', 'b')], occurrenceOverrides: {} };
    const results = calendarTimeSlotAlternatives(a, [a, b, c, d], hidden, getMembers, getSelection, describeSegment);
    expect(results.map(item => item.segment.id)).toEqual(['b']);
    expect(results[0]).toMatchObject({ hidden: true, canRestore: true });
  });

  it('deduplicates day-split occurrences and does not offer unsafe restoration', () => {
    const a = segment('a', 100, 200);
    const b = segment('b', 150, 180, 'other', null);
    const bNextDay = { ...b, id: 'b-next-day', dayIndex: 1 };
    const hidden = { hiddenGroups: [calendarGroupKey('other', 'b')], occurrenceOverrides: {} };
    const results = calendarTimeSlotAlternatives(a, [a, b, bNextDay], hidden, getMembers, getSelection, describeSegment);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ hidden: true, canRestore: false });
  });
});
