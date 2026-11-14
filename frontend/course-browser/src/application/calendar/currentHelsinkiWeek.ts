import { formatHelsinkiLocal } from "@domain/services/calendar/CalendarTime";
import { dateFromUtcMs, utcDateMs } from "@domain/services/calendar/layout/WeeklyCalendarTime";

const DAY_MS = 86_400_000;

/** Choose the Monday containing the current instant in Europe/Helsinki. */
export function currentHelsinkiWeek(nowMs: number = Date.now()): string {
  const today = formatHelsinkiLocal(nowMs).slice(0, 10);
  const utcDay = utcDateMs(today);
  const weekday = new Date(utcDay).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return dateFromUtcMs(utcDay - daysSinceMonday * DAY_MS);
}
