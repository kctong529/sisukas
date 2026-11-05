import type { CalendarEntry, FixedCalendarOccurrence } from '@domain/models/CalendarEntry';

/**
 * Display-only folding of parallel room records. The original entries are not
 * modified or discarded; the representative is used only for lane allocation.
 *
 * Conservative policy: only fold distinct, nonempty room assignments within
 * one offering, group, exact absolute interval, status and notice. Missing
 * locations, repeated room assignments or repeated series identities make a
 * bucket ambiguous, so it is left unchanged.
 */
export interface CalendarDisplayAggregation {
  entries: CalendarEntry[];
  membersByEntry: ReadonlyMap<CalendarEntry, readonly CalendarEntry[]>;
}

function key(entry: FixedCalendarOccurrence): string {
  return JSON.stringify([
    entry.source.courseOfferingId,
    entry.source.studyGroupId,
    entry.interval.startMs,
    entry.interval.endMs,
    entry.source.event.cancelled,
    entry.source.event.excluded,
    entry.source.event.notice ?? null,
  ]);
}

function roomKey(entry: FixedCalendarOccurrence): string | null {
  const locations = entry.source.event.locations;
  const ids = locations.map(location => location.id.trim()).filter(Boolean);
  // This policy only combines one-room occurrences. Multi-room source events
  // already have their own correct location representation.
  if (locations.length !== 1 || ids.length !== 1) return null;
  return ids[0];
}

function canCombine(members: readonly FixedCalendarOccurrence[]): boolean {
  if (members.length < 2) return false;
  const rooms = members.map(roomKey);
  if (rooms.some(room => room === null)) return false;
  if (new Set(rooms).size !== members.length) return false;
  const series = members.map(item => item.source.seriesId);
  if (series.some(id => !id)) return false;
  if (new Set(series).size !== members.length) return false;
  return true;
}

function orderMembers(a: FixedCalendarOccurrence, b: FixedCalendarOccurrence): number {
  return (roomKey(a) ?? '').localeCompare(roomKey(b) ?? '') ||
    (a.source.seriesId ?? '').localeCompare(b.source.seriesId ?? '') ||
    (a.occurrenceKey ?? '').localeCompare(b.occurrenceKey ?? '');
}

export function aggregateCalendarDisplayEntries(
  entries: readonly CalendarEntry[],
): CalendarDisplayAggregation {
  const buckets = new Map<string, FixedCalendarOccurrence[]>();
  for (const entry of entries) {
    if (entry.kind !== 'fixed') continue;
    const bucketKey = key(entry);
    const bucket = buckets.get(bucketKey) ?? [];
    bucket.push(entry);
    buckets.set(bucketKey, bucket);
  }

  const retained = new Set<CalendarEntry>();
  const membersByEntry = new Map<CalendarEntry, readonly CalendarEntry[]>();
  for (const members of buckets.values()) {
    if (!canCombine(members)) continue;
    const sorted = [...members].sort(orderMembers);
    const representative = sorted[0];
    retained.add(representative);
    membersByEntry.set(representative, sorted);
  }

  const output: CalendarEntry[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'fixed') {
      output.push(entry);
      continue;
    }
    const bucket = buckets.get(key(entry))!;
    if (!canCombine(bucket)) {
      output.push(entry);
    } else if (retained.has(entry)) {
      output.push(entry);
      retained.delete(entry);
    }
  }
  return { entries: output, membersByEntry };
}

/** All listed rooms are preserved, with deterministic de-duplication. */
export function displayEntryLocations(members: readonly CalendarEntry[]): string[] {
  const labels = new Set<string>();
  for (const member of members) {
    for (const room of member.source.event.locations) {
      const name = room.name.trim();
      const building = room.buildingName?.trim();
      const label = building && name && building !== name ? `${building} · ${name}` : building || name;
      if (label) labels.add(label);
    }
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}
