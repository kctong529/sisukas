import { calendarEntryVisible } from './calendarVisibility';

import type { CalendarVisibility } from './calendarVisibility';
import type { CalendarEntry } from '@domain/models/CalendarEntry';

export interface OverlapChoice {
  /** A choice is unavailable if it could silently omit an ambiguous conflict. */
  available: boolean;
  reason: string | null;
  /** Number of other displayed occurrences, not their source/room count. */
  overlapCount: number;
  keysToShow: readonly string[];
  keysToHide: readonly string[];
}

export interface DisplayOccurrence {
  entry: CalendarEntry;
  /** Aggregated room cards retain every underlying occurrence identity. */
  members: readonly CalendarEntry[];
}

const unavailable = (reason: string): OverlapChoice => ({
  available: false, reason, overlapCount: 0, keysToShow: [], keysToHide: [],
});

function eligible(entry: CalendarEntry): boolean {
  return entry.kind === 'fixed' && !entry.source.event.cancelled && !entry.source.event.excluded;
}

function overlaps(a: CalendarEntry, b: CalendarEntry): boolean {
  return a.interval.startMs < b.interval.endMs && b.interval.startMs < a.interval.endMs;
}

/**
 * Select one displayed occurrence (possibly an aggregated multi-room card) and
 * hide only directly overlapping, currently visible occurrences in the plan.
 * Uses absolute half-open time intervals; never traverses overlap components.
 *
 * The caller must pass ALL currently displayed entries, not just a layout's
 * visible segments, to preserve aggregated source identities and avoid day cuts.
 */
export function chooseOverlappingOccurrence(
  chosen: DisplayOccurrence,
  candidates: readonly DisplayOccurrence[],
  visibility: CalendarVisibility,
): OverlapChoice {
  if (!eligible(chosen.entry) || chosen.members.length === 0 ||
    chosen.members.some(member => !eligible(member) || member.occurrenceKey === null)) {
    return unavailable('This occurrence has no safe, unambiguous source identity.');
  }
  const chosenKeys = new Set(chosen.members.map(member => member.occurrenceKey as string));
  const keysToHide = new Set<string>();
  let overlapCount = 0;
  for (const candidate of candidates) {
    if (candidate.entry === chosen.entry || !eligible(candidate.entry)) continue;
    if (!overlaps(chosen.entry, candidate.entry)) continue;
    // An association represented by the chosen card is never a competing event.
    if (candidate.members.some(member => member.occurrenceKey && chosenKeys.has(member.occurrenceKey))) continue;
    if (!candidate.members.some(member => calendarEntryVisible(member, visibility))) continue;
    if (candidate.members.some(member => !eligible(member) || member.occurrenceKey === null)) {
      return unavailable('An overlapping event has an ambiguous source identity.');
    }
    overlapCount++;
    for (const member of candidate.members) keysToHide.add(member.occurrenceKey as string);
  }
  // Even when a hidden group supplies an explicit-visible occurrence, retain
  // the chosen card's entire set of room associations rather than half of it.
  const keysToShow = chosen.members.filter(member => !calendarEntryVisible(member, visibility))
    .map(member => member.occurrenceKey as string);
  return {
    available: overlapCount > 0,
    reason: overlapCount > 0 ? null : 'No visible overlapping events to hide.',
    overlapCount,
    keysToShow: [...new Set(keysToShow)],
    keysToHide: [...keysToHide],
  };
}
