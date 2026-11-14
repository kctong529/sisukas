import { describe, expect, it } from 'vitest';

import { calendarPreviewLayout } from '../../../src/application/calendar/calendarPreviewLayout';
import { layoutCalendarWeek } from '../../../src/domain/services/calendar/layout/WeeklyCalendarLayout';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

const at = (hour: number) => `2026-11-02T${String(hour).padStart(2, '0')}:00:00+02:00`;
const entry = (id: string, start: number, end: number) => fixed(id, at(start), at(end));

describe('calendar preview lane reflow', () => {
  it('repositions all overlapping visible events and the ghost, without mutating either layout', () => {
    const a = entry('a', 10, 12);
    const b = entry('b', 11, 13);
    const hidden = entry('hidden', 11, 12);
    const normal = layoutCalendarWeek([a, b], '2026-11-02');
    const unfiltered = layoutCalendarWeek([a, b, hidden], '2026-11-02');
    const originalColumns = normal.segments.map(segment => [segment.columnIndex, segment.columnCount]);
    const allColumns = unfiltered.segments.map(segment => [segment.columnIndex, segment.columnCount]);

    const result = calendarPreviewLayout(normal, unfiltered.segments.filter(segment => segment.entry === hidden));
    expect(result.visibleSegments).toHaveLength(2);
    expect(result.previewOnlySegments).toHaveLength(1);
    expect(result.visibleSegments.map(segment => segment.columnCount)).toEqual([3, 3]);
    expect(result.previewOnlySegments[0].columnCount).toBe(3);
    expect(new Set([...result.visibleSegments, ...result.previewOnlySegments].map(segment => segment.columnIndex)).size).toBe(3);
    expect(normal.segments.map(segment => [segment.columnIndex, segment.columnCount])).toEqual(originalColumns);
    expect(unfiltered.segments.map(segment => [segment.columnIndex, segment.columnCount])).toEqual(allColumns);

    const restored = calendarPreviewLayout(normal, []);
    expect(restored.visibleSegments.map(segment => segment.columnCount)).toEqual([2, 2]);
  });

  it('reflows a transitive overlapping component, but not unrelated events', () => {
    const a = entry('a', 9, 11);
    const b = entry('b', 10, 12);
    const later = entry('later', 16, 17);
    const hidden = entry('hidden', 11, 13);
    const normal = layoutCalendarWeek([a, b, later], '2026-11-02');
    const full = layoutCalendarWeek([a, b, hidden, later], '2026-11-02');
    const result = calendarPreviewLayout(normal, full.segments.filter(segment => segment.entry === hidden));
    expect(result.visibleSegments.find(segment => segment.entry === later)?.columnCount).toBe(1);
    expect(result.previewOnlySegments[0].columnCount).toBe(2);
  });
});
