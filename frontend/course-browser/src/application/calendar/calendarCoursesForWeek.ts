import type { Course } from '@domain/models/Course';

export interface CalendarWeekCourse {
  offeringId: string;
  code: string;
  title: string;
  course: Course;
}

/** Use inclusive Helsinki calendar dates, not visible event presence, for membership. */
function helsinkiDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function calendarCoursesForWeek(
  offeringIds: readonly string[], resolve: (id: string) => Course | undefined,
  weekDays: readonly string[],
): CalendarWeekCourse[] {
  if (!weekDays.length) return [];
  const start = weekDays[0];
  const end = weekDays[weekDays.length - 1];
  const courses: CalendarWeekCourse[] = [];
  for (const id of new Set(offeringIds)) {
    const course = resolve(id);
    if (!course) continue;
    const { start: from, end: to } = course.courseDate;
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) continue;
    if (helsinkiDate(from) > end || helsinkiDate(to) < start) continue;
    courses.push({ offeringId: id, code: course.code.value, title: course.name.en || course.code.value, course });
  }
  return courses.sort((a, b) => a.code.localeCompare(b.code) || a.offeringId.localeCompare(b.offeringId));
}
