import { calendarOfferingColorIndices, weekAwareOfferingColorIndices } from './calendarOfferingColors';

import type { CalendarEntry } from '@domain/models/CalendarEntry';

/** Match Calendar colors in other views; use stable plan ordering until the projection loads. */
export function planOfferingColorIndices(
  offeringIds: readonly string[],
  entries: readonly CalendarEntry[] | null | undefined,
): Readonly<Record<string, number>> {
  return entries
    ? weekAwareOfferingColorIndices(offeringIds, entries)
    : calendarOfferingColorIndices(offeringIds);
}
