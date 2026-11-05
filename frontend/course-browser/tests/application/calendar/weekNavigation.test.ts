import { describe, expect, it } from 'vitest';
import { shiftHelsinkiWeek } from '../../../src/application/calendar/weekNavigation';

describe('shiftHelsinkiWeek', () => {
  it.each([
    ['2026-11-02', -1, '2026-10-26'],
    ['2026-11-02', 1, '2026-11-09'],
    ['2026-11-02', 0, '2026-11-02'],
    ['2025-12-29', 1, '2026-01-05'],
    ['2026-12-28', 1, '2027-01-04'],
    ['2027-03-22', 1, '2027-03-29'], // Spring-forward week
    ['2026-10-19', 1, '2026-10-26'], // Fall-back week
    ['2026-11-02', -3, '2026-10-12'],
  ] as const)('shifts %s by %i week(s) to %s', (start, steps, expected) => {
    expect(shiftHelsinkiWeek(start, steps)).toBe(expected);
  });

  it('round-trips a week across a DST transition', () => {
    expect(shiftHelsinkiWeek(shiftHelsinkiWeek('2027-03-22', 1), -1)).toBe('2027-03-22');
  });

  it.each(['2026-11-03', '2026-02-30', '2026/11/02'])('rejects invalid week start %s', start => {
    expect(() => shiftHelsinkiWeek(start, 1)).toThrow(RangeError);
  });

  it.each([Number.NaN, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid week offsets: %s', steps => {
    expect(() => shiftHelsinkiWeek('2026-11-02', steps)).toThrow(RangeError);
  });

  it('does not navigate outside supported date boundaries', () => {
    expect(() => shiftHelsinkiWeek('2026-11-02', 1_000_000)).toThrow(RangeError);
  });
});
