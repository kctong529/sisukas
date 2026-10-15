import { describe, it, expect } from 'vitest';
import periodsYaml from '../../src/data/periods.yaml';

type CalendarPeriod = {
  period: string;
  start_date: string;
  end_date: string;
  week_numbers: string;
};
type CalendarYear = { year: string; periods: CalendarPeriod[] };

function parseUtcDate(value: string): Date {
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const date = new Date(`${value}T00:00:00.000Z`);
  expect(Number.isNaN(date.getTime())).toBe(false);
  expect(date.toISOString().slice(0, 10)).toBe(value);
  return date;
}

function isoWeek(date: Date): number {
  const d = new Date(date.getTime());
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

describe('periods.yaml integrity', () => {
  const years = (periodsYaml as { periods: CalendarYear[] }).periods;
  const expectedNames = ['Period I', 'Period II', 'Period III', 'Period IV', 'Period V'];

  it('contains each teaching period exactly once per academic year', () => {
    expect(new Set(years.map(({ year }) => year)).size).toBe(years.length);
    for (const { year, periods } of years) {
      expect(year).toMatch(/^\d{4}-\d{2}$/);
      expect(periods.map(({ period }) => period)).toEqual(expectedNames);
    }
  });

  it('contains valid, ordered dates for every period', () => {
    for (const { periods } of years) {
      for (const period of periods) {
        const start = parseUtcDate(period.start_date);
        const end = parseUtcDate(period.end_date);
        expect(start.getTime()).toBeLessThanOrEqual(end.getTime());
      }
    }
  });

  it('keeps week_numbers consistent with ISO calendar weeks', () => {
    for (const { periods } of years) {
      for (const period of periods) {
        const startWeek = isoWeek(parseUtcDate(period.start_date));
        const endWeek = isoWeek(parseUtcDate(period.end_date));
        expect(period.week_numbers).toBe(`${startWeek}-${endWeek}`);
      }
    }
  });

  it('does not overlap consecutive teaching periods', () => {
    for (const { periods } of years) {
      for (let i = 1; i < periods.length; i++) {
        const previousEnd = parseUtcDate(periods[i - 1].end_date);
        const currentStart = parseUtcDate(periods[i].start_date);
        expect(currentStart.getTime()).toBeGreaterThan(previousEnd.getTime());
      }
    }
  });
});
