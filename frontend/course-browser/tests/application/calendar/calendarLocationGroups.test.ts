import { describe, expect, it } from 'vitest';

import { calendarLocationGroups } from '../../../src/application/calendar/calendarLocationGroups';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

import type { CalendarEntry } from '../../../src/domain/models/CalendarEntry';
import type { StudyLocation } from '@modules/study-groups';

function entry(id: string, locations: StudyLocation[]): CalendarEntry {
  const source = fixed(id, '2026-12-01T17:00:00+02:00', '2026-12-01T20:00:00+02:00');
  return {
    ...source,
    source: { ...source.source, event: { ...source.source.event, locations } },
  };
}

const room = (id: string, name: string, buildingId = 'b1', buildingName = 'Undergraduate Centre') =>
  ({ id, name, buildingId, buildingName });

describe('calendarLocationGroups', () => {
  it('groups rooms by building, deduplicates room IDs and preserves labels', () => {
    const members = [
      entry('a', [room('1', 'U2 - U157'), room('2', 'A-sali (Aalto-sali) - Y202a')]),
      entry('b', [room('1', 'U2 - U157'), room('3', 'TU2 - 2005', 'b2', 'Maarintie 8')]),
    ];
    const original = JSON.stringify(members);
    expect(calendarLocationGroups(members)).toMatchObject({
      roomCount: 3,
      buildingCount: 2,
      groups: [
        { building: 'Maarintie 8', rooms: ['TU2 - 2005'] },
        { building: 'Undergraduate Centre', rooms: ['A-sali (Aalto-sali) - Y202a', 'U2 - U157'] },
      ],
    });
    expect(JSON.stringify(members)).toBe(original);
  });

  it('does not merge same-name buildings with distinct IDs', () => {
    const result = calendarLocationGroups([
      entry('a', [room('1', 'A101', 'first', 'Shared name')]),
      entry('b', [room('2', 'A102', 'second', 'Shared name')]),
    ]);
    expect(result.buildingCount).toBe(2);
  });

  it('keeps unknown buildings and ignores absent location records', () => {
    const result = calendarLocationGroups([
      entry('a', [{ id: 'x', name: 'Room X' }]),
      entry('b', []),
    ]);
    expect(result).toMatchObject({
      roomCount: 1,
      buildingCount: 1,
      groups: [{ building: 'Building unspecified', rooms: ['Room X'] }],
    });
  });

  it('supports an empty set of source events', () => {
    expect(calendarLocationGroups([])).toEqual({ groups: [], roomCount: 0, buildingCount: 0 });
  });
});
