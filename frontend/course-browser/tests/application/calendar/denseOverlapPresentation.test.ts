import { describe, expect, it } from 'vitest';

import { denseOverlapDisplays, denseOverlapPresentation } from '../../../src/application/calendar/denseOverlapPresentation';
import { layoutCalendarWeek } from '../../../src/domain/services/calendar/layout/WeeklyCalendarLayout';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

const at = (hour: number, minute = 0) =>
  `2026-11-02T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+02:00`;
const event = (id: string, start = 10, end = 12) => fixed(id, at(start), at(end), { group: id });
const layout = (entries: ReturnType<typeof fixed>[]) => layoutCalendarWeek(entries, '2026-11-02');

describe('denseOverlapPresentation — stable event rendering', () => {
  it('leaves three simultaneous events individually rendered', () => {
    const result = denseOverlapPresentation(layout([event('a'), event('b'), event('c')]));
    expect(result.displays).toEqual([]);
    expect(result.visibleSegments).toHaveLength(3);
  });

  it('marks precisely the interval with four simultaneous events', () => {
    const result = denseOverlapPresentation(layout([
      event('long', 8, 20), event('a', 10, 12), event('b', 10, 12), event('c', 10, 12),
    ]));
    expect(result.displays).toHaveLength(1);
    expect(result.displays[0]).toMatchObject({ startMinute: 600, endMinute: 720 });
    expect(result.displays[0].segments).toHaveLength(4);
    const visible = result.visibleSegments.filter(segment => segment.entry.source.studyGroupId === 'long');
    expect(visible.map(segment => [segment.startMinute, segment.endMinute])).toEqual([[480, 1200]]);
    expect(visible[0].continuesBefore).toBe(false);
    expect(visible[0].continuesAfter).toBe(false);
  });

  it('renders lower-concurrency portions when a connected group contains seven events', () => {
    const result = denseOverlapPresentation(layout([
      event('long', 8, 20), event('a', 10, 12), event('b', 10, 12), event('c', 10, 12),
      event('d', 12, 14), event('e', 12, 14), event('f', 16, 18),
    ]));
    expect(result.displays).toHaveLength(1);
    expect(result.displays[0].segments).toHaveLength(4);
    expect(result.visibleSegments.filter(segment => segment.entry.source.studyGroupId === 'd')).toHaveLength(1);
    expect(result.visibleSegments.filter(segment => segment.entry.source.studyGroupId === 'f')).toHaveLength(1);
    expect(result.visibleSegments.filter(segment => segment.entry.source.studyGroupId === 'long')).toHaveLength(1);
  });

  it('does not treat half-open adjacency as concurrency', () => {
    const result = denseOverlapPresentation(layout([
      event('long', 8, 20), event('a', 10, 12), event('b', 10, 12), event('c', 12, 14),
    ]));
    expect(result.displays).toEqual([]);
  });

  it('preserves duplicate associations and cancelled entries', () => {
    const result = denseOverlapPresentation(layout([
      event('a'), event('b'), event('c'), event('d'),
      fixed('cancelled', at(10), at(12), { cancelled: true }),
    ]));
    expect(result.displays).toHaveLength(1);
    expect(result.displays[0].segments).toHaveLength(4);
    expect(result.visibleSegments).toHaveLength(5);
    expect(result.visibleSegments.filter(segment => !segment.conflictEligible)).toHaveLength(1);
  });

  it('merges consecutive dense windows while retaining every member', () => {
    const result = denseOverlapPresentation(layout([
      event('long', 8, 20), event('a', 10, 12), event('b', 10, 12), event('c', 10, 11),
      event('d', 11, 12),
    ]));
    expect(result.displays).toHaveLength(1);
    expect(result.displays[0]).toMatchObject({ startMinute: 600, endMinute: 720 });
    expect(result.displays[0].segments).toHaveLength(5);
  });

  it('keeps separated dense windows distinct', () => {
    const result = denseOverlapDisplays(layout([
      event('long', 8, 20), event('a', 10, 12), event('b', 10, 12), event('c', 10, 12),
      event('d', 15, 17), event('e', 15, 17), event('f', 15, 17),
    ]));
    expect(result.map(display => [display.startMinute, display.endMinute])).toEqual([[600, 720], [900, 1020]]);
  });
});
