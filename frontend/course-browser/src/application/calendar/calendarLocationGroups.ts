import type { CalendarEntry } from '@domain/models/CalendarEntry';

export interface CalendarLocationGroup {
  key: string;
  building: string;
  rooms: readonly string[];
}

export interface CalendarLocationSummary {
  groups: readonly CalendarLocationGroup[];
  roomCount: number;
  buildingCount: number;
}

/**
 * Presentation-only grouping of source-listed locations. This does not infer
 * room assignments or change which source occurrences are represented.
 */
export function calendarLocationGroups(
  members: readonly CalendarEntry[],
): CalendarLocationSummary {
  const buildings = new Map<string, {
    label: string;
    rooms: Map<string, string>;
  }>();

  for (const entry of members) {
    for (const location of entry.source.event.locations) {
      const room = location.name.trim();
      const building = location.buildingName?.trim() || 'Building unspecified';
      if (!room && building === 'Building unspecified') continue;

      // IDs are preferred so similarly named buildings do not get conflated.
      const buildingKey = location.buildingId?.trim()
        ? JSON.stringify(['id', location.buildingId.trim()])
        : JSON.stringify(['name', building]);
      const roomKey = location.id?.trim()
        ? JSON.stringify(['id', location.id.trim()])
        : JSON.stringify(['name', room]);
      const group = buildings.get(buildingKey) ?? { label: building, rooms: new Map() };
      if (!buildings.has(buildingKey)) buildings.set(buildingKey, group);

      // Avoid redundant "Building · Building" and empty labels.
      const label = room && room.toLocaleLowerCase() !== building.toLocaleLowerCase()
        ? room : (room || 'Room unspecified');
      if (!group.rooms.has(roomKey)) group.rooms.set(roomKey, label);
    }
  }

  const groups: CalendarLocationGroup[] = [...buildings.entries()]
    .map(([key, value]) => ({
      key,
      building: value.label,
      rooms: [...value.rooms.values()].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.building.localeCompare(b.building) || a.key.localeCompare(b.key));

  return {
    groups,
    roomCount: groups.reduce((sum, group) => sum + group.rooms.length, 0),
    buildingCount: groups.length,
  };
}
