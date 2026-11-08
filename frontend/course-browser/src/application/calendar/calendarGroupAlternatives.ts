import type { StudyGroup } from '@modules/study-groups';
import { calendarGroupLabel } from './calendarPresentation';

export interface CalendarGroupAlternative {
  groupId: string;
  label: string;
  eventCount: number;
}

/**
 * Compare groups only within the same offering and teaching type.
 * No name heuristics, registration inference, or mutation of the source.
 * Callers must supply full offering data, never summary-only cache records.
 */
export function calendarGroupAlternatives(
  groups: readonly StudyGroup[] | null,
  currentGroupId: string,
): CalendarGroupAlternative[] {
  if (!groups) return [];
  const current = groups.find(group => group.groupId === currentGroupId);
  const type = current?.type.trim().toLocaleLowerCase();
  if (!type) return [];

  const seen = new Set<string>([currentGroupId]);
  return groups.flatMap(group => {
    if (seen.has(group.groupId) || group.type.trim().toLocaleLowerCase() !== type) return [];
    seen.add(group.groupId);
    return [{
      groupId: group.groupId,
      label: calendarGroupLabel({ studyGroupName: group.name, studyGroupType: group.type })
        ?? 'Unnamed study group',
      eventCount: group.studyEvents.length,
    }];
  });
}
