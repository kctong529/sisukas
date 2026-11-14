import type { StudyEvent } from "@modules/study-groups";

/** A time slot used by scheduling analytics, not a source occurrence. */
export interface AggregatedStudyTimeSlot {
  start: string;
  end: string;
  startIso?: string;
  endIso?: string;
  location?: string;
}

/**
 * Aggregates source occurrences into occupied time slots for analytics.
 *
 * The shared adapter preserves all occurrences, but the existing scheduling
 * algorithm treats events with identical original start/end values as one
 * slot. This helper restores that behavior only at the analytics boundary.
 *
 * Aggregation:
 * 1. Group events by their original (start, end) values.
 * 2. Keep the first event's timestamps for each distinct slot.
 * 3. Combine nonempty display locations in encounter order.
 * 4. Preserve the first-encounter order of the slots.
 *
 * Source IDs, cancellation flags, notices, and resolved location objects are
 * deliberately excluded: they do not describe the aggregated slot as a whole.
 * Do not use this projection to construct calendar occurrences.
 */
export function aggregateStudyEventsByTimeSlot(
  events: StudyEvent[]
): AggregatedStudyTimeSlot[] {
  const slots = new Map<string, StudyEvent[]>();

  for (const event of events) {
    const key = JSON.stringify([event.start, event.end]);
    const group = slots.get(key);

    if (group) {
      group.push(event);
    } else {
      slots.set(key, [event]);
    }
  }

  return Array.from(slots.values(), eventsInSlot => {
    const first = eventsInSlot[0];
    const locations = eventsInSlot
      .map(event => event.location?.trim() ?? "")
      .filter(Boolean);

    return {
      start: first.start,
      end: first.end,
      startIso: first.startIso,
      endIso: first.endIso,
      location: locations.length ? locations.join(", ") : undefined,
    };
  });
}
