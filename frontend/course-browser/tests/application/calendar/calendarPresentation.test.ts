import { describe, expect, it } from 'vitest';
import { displayEventLocation, formatCalendarMinute } from '../../../src/application/calendar/calendarPresentation';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

describe('calendar presentation helpers', () => {
  it.each([[0, '00:00'], [615, '10:15'], [1439, '23:59'], [1440, '24:00'], [615.9, '10:15']] as const)(
    'formats wall minute %s as %s', (minute, label) => {
      expect(formatCalendarMinute(minute)).toBe(label);
    },
  );
  it('prefers legacy location and falls back to resolved room names', () => {
    const event = fixed('a', '2026-11-02T10:00:00+02:00', '2026-11-02T11:00:00+02:00').source.event;
    event.location = '  Room A  ';
    event.locations = [{ id: '1', name: 'Room B' }];
    expect(displayEventLocation(event)).toBe('Room A');
    event.location = ' ';
    event.locations.push({ id: '2', name: 'Room B' }, { id: '3', name: 'Room C' });
    expect(displayEventLocation(event)).toBe('Room B, Room C');
    event.locations = [];
    expect(displayEventLocation(event)).toBeNull();
  });
});
