// src/domain/value-objects/NumericRange.ts
export interface NumericRange {
  min: number;
  max?: number;
}

// ============================================
// Single Number vs Range Operations
// ============================================

/** Check if a range contains a specific number (inclusive) */
export function containsNumber(range: NumericRange, num: number): boolean {
  const max = range.max ?? range.min; // Default: max equals min (exact value)
  return num >= range.min && num <= max;
}

/** Alias for containsNumber - more intuitive name */
export function includes(range: NumericRange, num: number): boolean {
  return containsNumber(range, num);
}

/** Check if a number is before the range starts */
export function isBefore(num: number, range: NumericRange): boolean {
  return num < range.min;
}

/** Check if a number is after the range ends */
export function isAfter(num: number, range: NumericRange): boolean {
  const max = range.max ?? range.min; // Default: max equals min (exact value)
  return num > max;
}

// ============================================
// Range vs Range Operations
// ============================================

/** Check if two ranges overlap at all */
export function overlaps(range1: NumericRange, range2: NumericRange): boolean {
  const max1 = range1.max ?? range1.min;
  const max2 = range2.max ?? range2.min;
  return range1.min <= max2 && max1 >= range2.min;
}

/** Check if range1 fully contains range2 */
export function contains(range1: NumericRange, range2: NumericRange): boolean {
  const max1 = range1.max ?? range1.min;
  const max2 = range2.max ?? range2.min;
  return range1.min <= range2.min && max1 >= max2;
}

/** Check if range2 is within range1 (inverse of contains) */
export function isWithinRange(range: NumericRange, container: NumericRange): boolean {
  return contains(container, range);
}

/** Get the intersection of two ranges, or null if they don't overlap */
export function getOverlap(range1: NumericRange, range2: NumericRange): NumericRange | null {
  if (!overlaps(range1, range2)) {
    return null;
  }
  
  const max1 = range1.max ?? range1.min;
  const max2 = range2.max ?? range2.min;
  
  const min = Math.max(range1.min, range2.min);
  const max = Math.min(max1, max2);
  
  return { min, max: max === min ? undefined : max };
}

/** Check if range1 is equal to range2 */
export function equals(range1: NumericRange, range2: NumericRange): boolean {
  const max1 = range1.max ?? range1.min;
  const max2 = range2.max ?? range2.min;
  return range1.min === range2.min && max1 === max2;
}

/** Check if range1 is completely before range2 (no overlap) */
export function isCompletelyBefore(range1: NumericRange, range2: NumericRange): boolean {
  const max1 = range1.max ?? range1.min;
  return max1 < range2.min;
}

/** Check if range1 is completely after range2 (no overlap) */
export function isCompletelyAfter(range1: NumericRange, range2: NumericRange): boolean {
  const max2 = range2.max ?? range2.min;
  return range1.min > max2;
}

// ============================================
// Range Boundary Operations
// ============================================

/** Check if range's minimum is at least a specific value */
export function minAtLeast(range: NumericRange, value: number): boolean {
  return range.min >= value;
}

/** Check if range's minimum is at most a specific value */
export function minAtMost(range: NumericRange, value: number): boolean {
  return range.min <= value;
}

/** Check if range's maximum is at least a specific value */
export function maxAtLeast(range: NumericRange, value: number): boolean {
  const max = range.max ?? range.min; // Default: max equals min (exact value)
  return max >= value;
}

/** Check if range's maximum is at most a specific value */
export function maxAtMost(range: NumericRange, value: number): boolean {
  const max = range.max ?? range.min; // Default: max equals min (exact value)
  return max <= value;
}

/** Check if range's minimum equals a specific value */
export function minEquals(range: NumericRange, value: number): boolean {
  return range.min === value;
}

/** Check if range's maximum equals a specific value */
export function maxEquals(range: NumericRange, value: number): boolean {
  const max = range.max ?? range.min; // Default: max equals min (exact value)
  return max === value;
}

// ============================================
// Range Span Operations
// ============================================

/** Check if range's span (max - min) is at least a specific value */
export function spanAtLeast(range: NumericRange, value: number): boolean {
  const max = range.max ?? range.min;
  return (max - range.min) >= value;
}

/** Check if range's span (max - min) is at most a specific value */
export function spanAtMost(range: NumericRange, value: number): boolean {
  const max = range.max ?? range.min;
  return (max - range.min) <= value;
}

/** Check if range's span (max - min) equals a specific value */
export function spanEquals(range: NumericRange, value: number): boolean {
  const max = range.max ?? range.min;
  return (max - range.min) === value;
}