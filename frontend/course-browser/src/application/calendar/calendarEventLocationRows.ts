import type { StudyEvent } from '@modules/study-groups';

export interface CalendarEventLocationRows {
  location: string | null;
  building: string | null;
}

/** Keep room and building metadata separate without parsing display strings. */
export function calendarEventLocationRows(event: StudyEvent): CalendarEventLocationRows {
  const unique = (items: Array<string | null | undefined>): string | null => {
    const names = [...new Set(items.map(item => item?.trim()).filter((item): item is string => Boolean(item)))];
    return names.length ? names.join(', ') : null;
  };
  return {
    location: unique(event.locations.map(location => location.name)) ?? (event.location?.trim() || null),
    building: unique(event.locations.map(location => location.buildingName)),
  };
}
