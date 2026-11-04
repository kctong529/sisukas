import type { CalendarEntry, FixedCalendarOccurrence } from "../models/CalendarEntry";
import { isConflictEligible } from "./CalendarEntryContract";
import { helsinkiOffsetMinutes, localMinute, splitAtOffsetTransitions } from "./WeeklyCalendarTime";
import type { WeeklyCalendarSegment, WeeklyCalendarLayoutDiagnostic } from "./WeeklyCalendarLayoutTypes";

/** Stable serialization of source associations without mutating upstream entries. */
function stableValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableValue(record[key])}`).join(",")}}`;
}

interface Candidate {
  entry: FixedCalendarOccurrence;
  signature: string;
  ordinal: number;
}

const MINUTE_MS = 60_000;

/** A transition cut ends at the last occupied instant in the old offset. */
function segmentEndMinute(endMs: number, dayEndMs: number, endsAtTransition: boolean): number {
  if (endMs === dayEndMs) return 1440;
  if (!endsAtTransition) return localMinute(endMs);
  return Math.round((localMinute(endMs - 1) + 1 / MINUTE_MS) * 1e6) / 1e6;
}

function makeSegment(
  candidate: Candidate,
  dayIndex: number,
  localDate: string,
  pieceIndex: number,
  piece: { startMs: number; endMs: number },
  dayStartMs: number,
  dayEndMs: number,
  endsAtTransition: boolean,
): WeeklyCalendarSegment {
  const { entry } = candidate;
  return {
    id: `${candidate.signature}#${candidate.ordinal}@${localDate}:${pieceIndex}`,
    entry,
    dayIndex,
    localDate,
    interval: piece,
    startMinute: piece.startMs === dayStartMs ? 0 : localMinute(piece.startMs),
    endMinute: segmentEndMinute(piece.endMs, dayEndMs, endsAtTransition),
    startUtcOffsetMinutes: helsinkiOffsetMinutes(piece.startMs),
    endUtcOffsetMinutes: helsinkiOffsetMinutes(piece.endMs - 1),
    continuesBefore: entry.interval.startMs < piece.startMs,
    continuesAfter: entry.interval.endMs > piece.endMs,
    conflictEligible: isConflictEligible(entry),
    overlapGroupId: null,
    columnIndex: 0,
    columnCount: 1,
  };
}

function segmentOccurrenceDay(
  candidate: Candidate,
  dayIndex: number,
  days: readonly string[],
  boundaries: readonly number[],
  diagnostics: WeeklyCalendarLayoutDiagnostic[],
): WeeklyCalendarSegment[] {
  const { entry } = candidate;
  const dayStart = boundaries[dayIndex];
  const dayEnd = boundaries[dayIndex + 1];
  const start = Math.max(entry.interval.startMs, dayStart);
  const end = Math.min(entry.interval.endMs, dayEnd);
  if (end <= start) return [];

  try {
    return splitAtOffsetTransitions(start, end).map((piece, index, pieces) =>
      makeSegment(candidate, dayIndex, days[dayIndex], index, piece,
        dayStart, dayEnd, index < pieces.length - 1));
  } catch {
    diagnostics.push({
      code: "unpositionable_segment",
      message: `Unable to position occurrence on ${days[dayIndex]}`,
      entry,
    });
    return [];
  }
}

function fixedCandidates(entries: readonly CalendarEntry[]): Candidate[] {
  const candidates: Candidate[] = entries
    .filter((entry): entry is FixedCalendarOccurrence => entry.kind === "fixed")
    .map(entry => ({ entry, signature: stableValue(entry), ordinal: 0 }));
  candidates.sort((a, b) => a.signature.localeCompare(b.signature));
  const duplicates = new Map<string, number>();
  for (const candidate of candidates) {
    candidate.ordinal = duplicates.get(candidate.signature) ?? 0;
    duplicates.set(candidate.signature, candidate.ordinal + 1);
  }
  return candidates;
}

function hasValidInterval(entry: FixedCalendarOccurrence): boolean {
  const { startMs, endMs } = entry.interval;
  return Number.isSafeInteger(startMs) && Number.isSafeInteger(endMs) && endMs > startMs;
}

/** Split fixed occurrences into local-day, offset-consistent segments. */
export function segmentWeek(
  entries: readonly CalendarEntry[],
  days: readonly string[],
  boundaries: readonly number[],
): { segments: WeeklyCalendarSegment[]; diagnostics: WeeklyCalendarLayoutDiagnostic[] } {
  const diagnostics: WeeklyCalendarLayoutDiagnostic[] = [];
  const segments: WeeklyCalendarSegment[] = [];
  for (const candidate of fixedCandidates(entries)) {
    const { entry } = candidate;
    const { startMs, endMs } = entry.interval;
    if (!hasValidInterval(entry)) {
      diagnostics.push({ code: "invalid_interval", message: "Fixed occurrence has invalid absolute boundaries", entry });
      continue;
    }
    if (endMs <= boundaries[0] || startMs >= boundaries[7]) continue;
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      segments.push(...segmentOccurrenceDay(candidate, dayIndex, days, boundaries, diagnostics));
    }
  }
  return { segments, diagnostics };
}
