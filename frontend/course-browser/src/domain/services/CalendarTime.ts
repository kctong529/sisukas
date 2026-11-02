import type {
  CalendarDiagnostic,
  CalendarSourceContext,
} from "../models/CalendarDiagnostic";

export const CALENDAR_DISPLAY_TIME_ZONE = "Europe/Helsinki" as const;

/** Absolute, half-open interval. The end instant is not occupied. */
export interface CalendarInterval {
  startMs: number;
  endMs: number;
}

export interface CalendarSourceTimes {
  startIso?: string | null;
  endIso?: string | null;
  start?: string | null;
  end?: string | null;
}

export interface CalendarTimeResult {
  interval: CalendarInterval | null;
  diagnostics: CalendarDiagnostic[];
}

// An explicit offset is mandatory. Naive ISO timestamps and named zones are rejected.
const OFFSET_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

/**
 * Parses an ISO timestamp with an explicit UTC offset into epoch milliseconds.
 *
 * Verifies calendar fields and round-trips against the stated offset, so
 * impossible dates are not silently normalized. Does not require the offset
 * to be the Helsinki offset: the instant remains authoritative.
 */
export function parseOffsetInstant(value: string): number | null {
  const match = OFFSET_DATE_TIME.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, fraction, zone] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  const ms = Number((fraction ?? "").padEnd(3, "0"));
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59)
    return null;

  let offsetMinutes = 0;
  if (zone !== "Z") {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMins = Number(zone.slice(4, 6));
    if (offsetHours > 14 || offsetMins > 59 || (offsetHours === 14 && offsetMins !== 0))
      return null;
    offsetMinutes = (zone[0] === "-" ? -1 : 1) * (offsetHours * 60 + offsetMins);
  }
  // setUTCFullYear avoids Date.UTC's special handling of years 00–99.
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(hour, minute, second, ms);
  if (
    wall.getUTCFullYear() !== year ||
    wall.getUTCMonth() + 1 !== month ||
    wall.getUTCDate() !== day ||
    wall.getUTCHours() !== hour ||
    wall.getUTCMinutes() !== minute ||
    wall.getUTCSeconds() !== second
  ) return null;

  const instant = wall.getTime() - offsetMinutes * 60_000;
  return Number.isFinite(instant) ? instant : null;
}

const helsinkiFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CALENDAR_DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Renders an instant into its Helsinki wall-clock representation. */
export function formatHelsinkiLocal(instantMs: number): string {
  if (!Number.isFinite(instantMs)) throw new RangeError("Invalid instant");
  const parts = Object.fromEntries(
    helsinkiFormatter.formatToParts(new Date(instantMs)).map(part => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function normalizeLocal(value: string): string | null {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, seconds = "00", fraction] = match;
  // Validate the wall-clock date via UTC purely as a calendar-field check;
  // never interpret it as an actual instant.
  const candidate = `${year}-${month}-${day}T${hour}:${minute}:${seconds}${fraction ? `.${fraction}` : ""}Z`;
  if (parseOffsetInstant(candidate) === null) return null;
  return `${year}-${month}-${day}T${hour}:${minute}:${seconds}`;
}

/** True when half-open intervals have a strictly positive intersection. */
export function intervalsOverlap(a: CalendarInterval, b: CalendarInterval): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/**
 * Validates authoritative offset-aware timestamps and checks local-time hints.
 *
 * Returns a usable interval alongside warnings when the local representation
 * disagrees with Helsinki. Missing/malformed offset timestamps or nonpositive
 * durations produce errors and no interval; no browser-local fallback occurs.
 */
export function resolveCalendarTime(
  times: CalendarSourceTimes,
  source?: CalendarSourceContext
): CalendarTimeResult {
  const diagnostics: CalendarDiagnostic[] = [];
  const parsed: Partial<Record<"start" | "end", number>> = {};
  for (const field of ["start", "end"] as const) {
    const iso = field === "start" ? times.startIso : times.endIso;
    if (iso == null || iso === "") {
      diagnostics.push({
        severity: "error", code: "missing_offset_timestamp", field, source,
        message: `Missing ${field} timestamp with explicit UTC offset`,
      });
      continue;
    }
    const value = parseOffsetInstant(iso);
    if (value === null) {
      diagnostics.push({
        severity: "error", code: "invalid_offset_timestamp", field, source,
        message: `Invalid ${field} timestamp with explicit UTC offset`,
      });
      continue;
    }
    parsed[field] = value;
    const local = field === "start" ? times.start : times.end;
    if (local != null && local !== "") {
      const normalized = normalizeLocal(local);
      if (normalized === null) {
        diagnostics.push({
          severity: "warning", code: "invalid_local_timestamp", field, source,
          message: `Invalid source-local ${field} timestamp; authoritative instant retained`,
        });
      } else if (normalized !== formatHelsinkiLocal(value)) {
        diagnostics.push({
          severity: "warning", code: "local_timestamp_mismatch", field, source,
          message: `Source-local ${field} differs from Europe/Helsinki time; authoritative instant retained`,
        });
      }
    }
  }
  if (parsed.start === undefined || parsed.end === undefined) {
    return { interval: null, diagnostics };
  }
  if (parsed.end <= parsed.start) {
    diagnostics.push({
      severity: "error", code: "invalid_interval", source,
      message: "Calendar interval must have a strictly positive duration",
    });
    return { interval: null, diagnostics };
  }
  return { interval: { startMs: parsed.start, endMs: parsed.end }, diagnostics };
}
