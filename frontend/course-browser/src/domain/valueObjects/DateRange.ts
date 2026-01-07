// src/domain/value-objects/DateRange.ts
export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================
// Single Date vs Range Operations
// ============================================

/** Check if a range contains a specific date (inclusive) */
export function containsDate(range: DateRange, date: Date): boolean {
  return date >= range.start && date <= range.end;
}

/** Alias for containsDate - more intuitive name */
export function includes(range: DateRange, date: Date): boolean {
  return containsDate(range, date);
}

/** Check if a date is before the range starts */
export function isBefore(date: Date, range: DateRange): boolean {
  return date < range.start;
}

/** Check if a date is after the range ends */
export function isAfter(date: Date, range: DateRange): boolean {
  return date > range.end;
}

// ============================================
// Range vs Range Operations
// ============================================

/** Check if two ranges overlap at all */
export function overlaps(range1: DateRange, range2: DateRange): boolean {
  return range1.start <= range2.end && range1.end >= range2.start;
}

/** Check if range1 fully contains range2 */
export function contains(range1: DateRange, range2: DateRange): boolean {
  return range1.start <= range2.start && range1.end >= range2.end;
}

/** Check if range is within container (inverse of contains) */
export function isWithinRange(range: DateRange, container: DateRange): boolean {
  return contains(container, range);
}

/** Get the intersection of two ranges, or null if they don't overlap */
export function getOverlap(range1: DateRange, range2: DateRange): DateRange | null {
  if (!overlaps(range1, range2)) {
    return null;
  }
  return {
    start: range1.start > range2.start ? range1.start : range2.start,
    end: range1.end < range2.end ? range1.end : range2.end
  };
}

/** Check if range1 is equal to range2 */
export function equals(range1: DateRange, range2: DateRange): boolean {
  return range1.start.getTime() === range2.start.getTime() && 
         range1.end.getTime() === range2.end.getTime();
}

/** Check if range1 is completely before range2 (no overlap) */
export function isCompletelyBefore(range1: DateRange, range2: DateRange): boolean {
  return range1.end < range2.start;
}

/** Check if range1 is completely after range2 (no overlap) */
export function isCompletelyAfter(range1: DateRange, range2: DateRange): boolean {
  return range1.start > range2.end;
}

// ============================================
// Range Measurement Operations
// ============================================

/** Get the duration of the range in days */
export function durationInDays(range: DateRange): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((range.end.getTime() - range.start.getTime()) / msPerDay);
}

/** Get the duration of the range in hours */
export function durationInHours(range: DateRange): number {
  const msPerHour = 1000 * 60 * 60;
  return Math.ceil((range.end.getTime() - range.start.getTime()) / msPerHour);
}

/** Get the duration of the range in milliseconds */
export function durationInMilliseconds(range: DateRange): number {
  return range.end.getTime() - range.start.getTime();
}