import { dateFromUtcMs, resolveHelsinkiWeek, utcDateMs } from "@domain/services/calendar/layout/WeeklyCalendarTime";

const DAY_MS = 86_400_000;

/**
 * Move by calendar weeks, not by elapsed Helsinki-local milliseconds.
 * Input must be the ISO date of a Monday in the supported calendar range.
 */
export function shiftHelsinkiWeek(weekStart: string, weeks: number): string {
  if (!Number.isSafeInteger(weeks)) {
    throw new RangeError(`Week offset must be a safe integer: ${weeks}`);
  }
  // Reuse the domain contract to reject non-Mondays and malformed dates.
  resolveHelsinkiWeek(weekStart);
  const destination = dateFromUtcMs(utcDateMs(weekStart) + weeks * 7 * DAY_MS);
  // Validate the resulting week too, including the supported year boundary.
  resolveHelsinkiWeek(destination);
  return destination;
}
