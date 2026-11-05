import { describe, expect, it } from 'vitest';
import { calendarDayHeading } from '../../../src/application/calendar/calendarDayHeading';

describe('calendarDayHeading', () => {
  it('formats a Helsinki week with readable weekday and date labels', () => {
    expect(calendarDayHeading('2026-11-02')).toEqual({
      weekday: 'Mon', date: '2 Nov', fullDate: 'Monday, 2 November 2026',
    });
    expect(calendarDayHeading('2026-11-08').weekday).toBe('Sun');
  });

  it('handles a week crossing a year boundary', () => {
    expect(calendarDayHeading('2027-01-01')).toEqual({
      weekday: 'Fri', date: '1 Jan', fullDate: 'Friday, 1 January 2027',
    });
  });

  it('is unaffected by DST transition dates', () => {
    expect(calendarDayHeading('2027-03-28').weekday).toBe('Sun');
    expect(calendarDayHeading('2026-10-25').weekday).toBe('Sun');
  });

  it.each(['2026-02-30', '2026-11-2', 'not-a-date', ''])('rejects invalid ISO day %s', input => {
    expect(() => calendarDayHeading(input)).toThrow(RangeError);
  });
});
