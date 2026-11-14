import { describe, expect, it } from 'vitest';

import { calendarCoursesForWeek } from '../../../src/application/calendar/calendarCoursesForWeek';

import type { Course } from '../../../src/domain/models/Course';

const course = (id: string, start: string, end: string) => ({
  id,
  code: { value: id },
  name: { en: `${id} title` },
  courseDate: { start: new Date(`${start}T12:00:00Z`), end: new Date(`${end}T12:00:00Z`) },
}) as Course;

const catalog = new Map([
  ['before', course('before', '2026-10-01', '2026-11-01')],
  ['week', course('week', '2026-11-02', '2026-11-08')],
  ['after', course('after', '2026-11-09', '2026-12-12')],
  ['all-hidden', course('all-hidden', '2026-09-01', '2026-12-12')],
]);
const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];

describe('courses in displayed calendar week', () => {
  it('uses inclusive course date overlap rather than projected or visible events', () => {
    expect(calendarCoursesForWeek(['before', 'week', 'after', 'all-hidden'], id => catalog.get(id), days)
      .map(item => item.offeringId)).toEqual(['all-hidden', 'week']);
  });
  it('deduplicates plan membership and ignores missing course records', () => {
    expect(calendarCoursesForWeek(['week', 'week', 'not-indexed'], id => catalog.get(id), days))
      .toHaveLength(1);
  });
  it('handles empty weeks without inventing courses', () => {
    expect(calendarCoursesForWeek(['week'], id => catalog.get(id), [])).toEqual([]);
  });
});
