import type { StudyEvent } from '@modules/study-groups/models/StudyEvent';
import type { Course } from '@domain/models/Course';
import type { CalendarEntrySource } from '@domain/models/CalendarEntry';

/** Display-only wall-clock minutes supplied by the weekly layout engine. */
export function formatCalendarMinute(minute: number): string {
  const whole = Math.floor(minute);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

/** Prefer the original display location, then a resolved room label. */
export function displayEventLocation(event: StudyEvent): string | null {
  const legacy = event.location?.trim();
  if (legacy) return legacy;
  const resolved = event.locations.map(location => location.name.trim()).filter(Boolean);
  return resolved.length > 0 ? [...new Set(resolved)].join(', ') : null;
}

/** A display-only description; never use presentation strings as event identities. */
export interface CalendarEventPresentation {
  courseCode: string | null;
  courseTitle: string;
  groupLabel: string | null;
  locationLabel: string | null;
}

/** Strip only the redundant terminal teaching suffix, keeping source data intact. */
export function cleanCalendarCourseTitle(title: string): string {
  return title.trim().replace(/,\s*Contact teaching\s*$/i, '').trim();
}

/** Do not guess group labels from internal IDs or abbreviations. */
export function calendarGroupLabel(source: Pick<CalendarEntrySource, 'studyGroupName' | 'studyGroupType'>): string | null {
  const name = source.studyGroupName?.trim();
  const type = source.studyGroupType?.trim();
  if (!name && !type) return null;
  if (!name) return type || null;
  if (!type || name.toLocaleLowerCase() === type.toLocaleLowerCase()) return name;
  // Descriptive names are already useful and should not receive a redundant prefix.
  if (name.toLocaleLowerCase().startsWith(`${type.toLocaleLowerCase()} `)) return name;
  if (/\s/.test(name)) return `${type} · ${name}`;
  return `${type} ${name}`;
}

/** Use resolved building and room names, with the old text location as fallback. */
export function displayCalendarLocation(event: StudyEvent): string | null {
  const resolved = event.locations.map(location => {
    const building = location.buildingName?.trim();
    const room = location.name.trim();
    if (building && room) {
      if (building.toLocaleLowerCase() === room.toLocaleLowerCase()) return building;
      return `${building} · ${room}`;
    }
    return building || room;
  }).filter(Boolean);
  if (resolved.length) return [...new Set(resolved)].join(', ');
  return displayEventLocation(event);
}

export function calendarEventPresentation(
  source: CalendarEntrySource,
  course: Course | undefined,
): CalendarEventPresentation {
  const courseCode = course?.code.value.trim() || null;
  const rawTitle = course?.name.en?.trim() || course?.name.fi?.trim() || '';
  return {
    courseCode,
    courseTitle: cleanCalendarCourseTitle(rawTitle) || courseCode || 'Course unavailable',
    groupLabel: calendarGroupLabel(source),
    locationLabel: displayCalendarLocation(source.event),
  };
}
