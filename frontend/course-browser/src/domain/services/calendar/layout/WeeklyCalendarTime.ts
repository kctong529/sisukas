import { CALENDAR_DISPLAY_TIME_ZONE, type CalendarInterval, formatHelsinkiLocal } from "../CalendarTime";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function utcDateMs(date: string): number {
  const match = DATE_RE.exec(date);
  if (!match) throw new RangeError(`Invalid ISO date: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // The supported date range avoids special years 0..99 and Intl's edge cases.
  if (year < 1000 || year > 9998) throw new RangeError(`Unsupported year: ${year}`);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day)
    throw new RangeError(`Invalid ISO date: ${date}`);
  return ms;
}

export function dateFromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Offset of Europe/Helsinki at an absolute instant, rounded to whole seconds. */
export function helsinkiOffsetMinutes(ms: number): number {
  const wall = formatHelsinkiLocal(ms).split("T");
  const [year, month, day] = wall[0].split("-").map(Number);
  const [hour, minute, second] = wall[1].split(":").map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return (asUtc - Math.floor(ms / 1000) * 1000) / MINUTE_MS;
}

/** Helsinki midnight as an instant. Day lengths may be 23, 24 or 25 hours. */
export function helsinkiMidnight(localDate: string): number {
  const nominalUtcMidnight = utcDateMs(localDate);
  let guess = nominalUtcMidnight - 120 * MINUTE_MS;
  for (let i = 0; i < 6; i++) {
    const offset = helsinkiOffsetMinutes(guess);
    const next = nominalUtcMidnight - offset * MINUTE_MS;
    if (next === guess) break;
    guess = next;
  }
  if (formatHelsinkiLocal(guess) !== `${localDate}T00:00:00`)
    throw new RangeError(`Unable to resolve ${CALENDAR_DISPLAY_TIME_ZONE} midnight: ${localDate}`);
  return guess;
}

export function localMinute(ms: number): number {
  const [, time] = formatHelsinkiLocal(ms).split("T");
  const [hour, minute, second] = time.split(":").map(Number);
  return hour * 60 + minute + second / 60 + (ms % 1000 + 1000) % 1000 / MINUTE_MS;
}

/** Split at a UTC-offset transition so each visible piece has a monotone wall-clock axis. */
export function splitAtOffsetTransitions(startMs: number, endMs: number): CalendarInterval[] {
  const cuts = [startMs];
  let cursor = startMs;
  let priorOffset = helsinkiOffsetMinutes(cursor);
  while (cursor < endMs - 1) {
    const probe = Math.min(cursor + 60 * MINUTE_MS, endMs - 1);
    const probeOffset = helsinkiOffsetMinutes(probe);
    if (probeOffset !== priorOffset) {
      let low = cursor;
      let high = probe;
      while (high - low > 1) {
        const middle = low + Math.floor((high - low) / 2);
        if (helsinkiOffsetMinutes(middle) === priorOffset) low = middle;
        else high = middle;
      }
      cuts.push(high);
      priorOffset = helsinkiOffsetMinutes(high);
      cursor = high;
    } else cursor = probe;
  }
  cuts.push(endMs);
  return cuts.slice(0, -1).map((start, i) => ({ startMs: start, endMs: cuts[i + 1] }));
}


/** A week is seven calendar dates, not seven 24-hour intervals. */
export function resolveHelsinkiWeek(weekStart: string) {
  const monday = utcDateMs(weekStart);
  if (new Date(monday).getUTCDay() !== 1) {
    throw new RangeError(`Week start must be Monday in ${CALENDAR_DISPLAY_TIME_ZONE}: ${weekStart}`);
  }
  const days = Array.from({ length: 7 }, (_, i) => dateFromUtcMs(monday + i * DAY_MS));
  const boundaries = Array.from({ length: 8 }, (_, i) =>
    helsinkiMidnight(dateFromUtcMs(monday + i * DAY_MS)));
  return { days, boundaries };
}
