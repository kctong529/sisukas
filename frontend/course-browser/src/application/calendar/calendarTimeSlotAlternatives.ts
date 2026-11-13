import { calendarEntryVisible } from './calendarVisibility';

import type { CalendarEventPresentation } from './calendarPresentation';
import type { CalendarVisibility } from './calendarVisibility';
import type { CalendarEntry } from '@domain/models/CalendarEntry';
import type { CalendarGroupSelection } from '@domain/services/calendar/CalendarProjection';
import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';

export interface TimeSlotAlternative {
  segment: WeeklyCalendarSegment;
  presentation: CalendarEventPresentation;
  hidden: boolean;
  canRestore: boolean;
}

/** Find direct overlapping events across offerings, including visibility-hidden ones. */
export function calendarTimeSlotAlternatives(
  selected: WeeklyCalendarSegment,
  unfiltered: readonly WeeklyCalendarSegment[],
  visibility: CalendarVisibility,
  membersForSegment: (segment: WeeklyCalendarSegment) => readonly CalendarEntry[],
  selectionForSegment: (segment: WeeklyCalendarSegment) => CalendarGroupSelection,
  presentationForSegment: (segment: WeeklyCalendarSegment) => CalendarEventPresentation,
): TimeSlotAlternative[] {
  const selectedEntry = selected.entry;
  const seen = new Set<typeof selectedEntry>();
  const result: TimeSlotAlternative[] = [];
  for (const segment of unfiltered) {
    const entry = segment.entry;
    if (entry === selectedEntry || seen.has(entry)) continue;
    seen.add(entry);
    if (entry.kind !== 'fixed' || entry.source.event.cancelled || entry.source.event.excluded ||
      selectionForSegment(segment) === 'excluded') continue;
    if (!(selectedEntry.interval.startMs < entry.interval.endMs &&
      entry.interval.startMs < selectedEntry.interval.endMs)) continue;
    const members = membersForSegment(segment);
    result.push({ segment, presentation: presentationForSegment(segment),
      hidden: !members.some(member => calendarEntryVisible(member, visibility)),
      canRestore: members.every(member => member.occurrenceKey !== null),
    });
  }
  return result.sort((a, b) => a.segment.entry.interval.startMs - b.segment.entry.interval.startMs);
}
