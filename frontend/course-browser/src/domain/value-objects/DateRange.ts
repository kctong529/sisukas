// src/domain/value-objects/DateRange.ts
export interface DateRange {
  start: Date;
  end: Date;
}

/** Check if a single date is inside the range (inclusive) */
export function isWithinRange(date: Date, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/** Check if two ranges overlap at all */
export function overlaps(range1: DateRange, range2: DateRange): boolean {
  return range1.start <= range2.end && range1.end >= range2.start;
}

/** Get the intersection of two ranges, or null if they don’t overlap */
export function getOverlap(range1: DateRange, range2: DateRange): DateRange | null {
  if (!overlaps(range1, range2)) return null;
  return {
    start: range1.start > range2.start ? range1.start : range2.start,
    end: range1.end < range2.end ? range1.end : range2.end
  };
}

/** Check if range1 fully contains range2 */
export function contains(range1: DateRange, range2: DateRange): boolean {
  return range1.start <= range2.start && range1.end >= range2.end;
}

/** Check if a date is before the range starts */
export function isBefore(date: Date, range: DateRange): boolean {
  return date < range.start;
}

/** Check if a date is after the range ends */
export function isAfter(date: Date, range: DateRange): boolean {
  return date > range.end;
}

/** Check if range1 is completely before range2 */
export function isCompletelyBefore(range1: DateRange, range2: DateRange): boolean {
  return range1.end < range2.start;
}

/** Check if range1 is completely after range2 */
export function isCompletelyAfter(range1: DateRange, range2: DateRange): boolean {
  return range1.start > range2.end;
}

/** Get the duration of the range in days */
export function durationInDays(range: DateRange): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((range.end.getTime() - range.start.getTime()) / msPerDay);
}