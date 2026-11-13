import { describe, expect, it } from 'vitest';

import { calendarEventLocationRows } from '@application/calendar/calendarEventLocationRows';
import type { StudyEvent } from '@modules/study-groups';

function event(locations: StudyEvent['locations'], location?: string): StudyEvent {
  return {
    id: 'event', start: '', end: '', cancelled: false, excluded: false,
    locationIds: [], locations, location,
  };
}

describe('calendarEventLocationRows', () => {
  it('separates room from building', () => {
    expect(calendarEventLocationRows(event([
      { id: 'a', name: 'Y202a', buildingName: 'Undergraduate Centre' },
    ]))).toEqual({ location: 'Y202a', building: 'Undergraduate Centre' });
  });
  it('deduplicates multiple room and building names', () => {
    expect(calendarEventLocationRows(event([
      { id: 'a', name: 'Y202a', buildingName: 'Undergraduate Centre' },
      { id: 'b', name: 'Y202b', buildingName: 'Undergraduate Centre' },
    ]))).toEqual({ location: 'Y202a, Y202b', building: 'Undergraduate Centre' });
  });
  it('retains legacy location without inventing a building', () => {
    expect(calendarEventLocationRows(event([], 'Room A'))).toEqual({ location: 'Room A', building: null });
  });
  it('does not invent a room when only a building is available', () => {
    expect(calendarEventLocationRows(event([
      { id: 'a', name: '', buildingName: 'Undergraduate Centre' },
    ]))).toEqual({ location: null, building: 'Undergraduate Centre' });
  });
});
