import { describe, expect, it } from 'vitest';

import { currentHelsinkiWeek } from '../../../src/application/calendar/currentHelsinkiWeek';

describe('currentHelsinkiWeek', () => {
  it.each([
    ['2026-11-02T12:00:00+02:00', '2026-11-02'],
    ['2026-11-08T23:30:00+02:00', '2026-11-02'],
    ['2026-11-09T00:00:00+02:00', '2026-11-09'],
    ['2026-01-01T13:00:00+02:00', '2025-12-29'],
    ['2027-03-28T04:30:00+03:00', '2027-03-22'],
    ['2026-10-25T03:30:00+02:00', '2026-10-19'],
  ])('resolves Helsinki week for %s', (now, expected) => {
    expect(currentHelsinkiWeek(Date.parse(now))).toBe(expected);
  });
});
