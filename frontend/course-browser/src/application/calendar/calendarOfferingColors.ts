/**
 * Deterministic course-offering colors for the calendar.
 *
 * Uses a fixed 12-color palette inspired by LEGO blocks.
 *
 * The week-aware assignment considers all offerings appearing in the
 * same Helsinki-local week, regardless of whether their events overlap.
 * It prioritizes perceptual separation while assigning one stable color
 * per offering across the active plan.
 *
 * Colors are computed from the full projection, independently of the
 * displayed week. They may change when plan membership or event data
 * changes, but not during ordinary week navigation.
 *
 * A simpler sequential assignment is retained as a fallback for
 * standalone calendar components without a week-aware color map.
 */
export const CALENDAR_OFFERING_COLOR_COUNT = 12;

export function calendarOfferingColorIndices(
  offeringIds: readonly string[],
): Readonly<Record<string, number>> {
  const indices: Record<string, number> = Object.create(null) as Record<string, number>;
  let next = 0;
  for (const offeringId of offeringIds) {
    if (Object.hasOwn(indices, offeringId)) continue;
    indices[offeringId] = next % CALENDAR_OFFERING_COLOR_COUNT;
    next++;
  }
  return indices;
}

import type { CalendarEntry } from '@domain/models/CalendarEntry';

/** RGB values match CalendarTimetable's twelve CSS palette entries. */
const PALETTE: readonly (readonly [number, number, number])[] = [
  [234, 88, 12], [21, 128, 61], [124, 58, 237], [2, 132, 199],
  [245, 158, 11], [219, 39, 119], [13, 148, 136], [79, 70, 229],
  [190, 24, 93], [101, 163, 13], [180, 83, 9], [8, 145, 178],
];

function oklab(rgb: readonly number[]): readonly [number, number, number] {
  const [r, g, b] = rgb.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// The 14% tint is what users see over most of the card surface.
// Include both tinted fills and saturated outlines in our distance metric.
const COLOR_DISTANCE = PALETTE.map(a => PALETTE.map(b => {
  const tint = (rgb: readonly number[]) => oklab(rgb.map(channel => 0.14 * channel + 0.86 * 255));
  return 0.7 * distance(tint(a), tint(b)) + 0.3 * distance(oklab(a), oklab(b));
}));

const helsinkiDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** ISO Monday in UTC calendar arithmetic, after interpreting an instant in Helsinki. */
function weekMonday(instant: number): number {
  const parts = helsinkiDate.formatToParts(instant);
  const numberPart = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const day = Date.UTC(numberPart('year'), numberPart('month') - 1, numberPart('day'));
  const weekday = new Date(day).getUTCDay();
  return day - ((weekday + 6) % 7) * 86_400_000;
}

/**
 * Assign a fixed palette index per offering, optimizing distinction across
 * all weeks in the projection. Non-overlapping events in the same week count
 * just as strongly as simultaneous events.
 *
 * Pure and deterministic: independent of event order, visible week, and DOM.
 * Call when projection/plan data changes, never during week navigation.
 */
export function weekAwareOfferingColorIndices(
  offeringIds: readonly string[],
  entries: readonly CalendarEntry[],
): Readonly<Record<string, number>> {
  const ids = [...new Set(offeringIds)].sort();
  const neighbors = new Map(ids.map(id => [id, new Set<string>()]));
  const weekly = new Map<number, Set<string>>();

  for (const entry of entries) {
    if (entry.kind !== 'fixed') continue;
    const id = entry.source.courseOfferingId;
    if (!neighbors.has(id)) continue;
    const { startMs, endMs } = entry.interval;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    const start = weekMonday(startMs);
    const last = weekMonday(endMs - 1); // half-open interval
    for (let week = start; week <= last; week += 7 * 86_400_000) {
      let members = weekly.get(week);
      if (!members) { members = new Set(); weekly.set(week, members); }
      members.add(id);
    }
  }

  for (const members of weekly.values()) {
    const weekIds = [...members];
    for (let i = 0; i < weekIds.length; i++) {
      for (let j = i + 1; j < weekIds.length; j++) {
        neighbors.get(weekIds[i])!.add(weekIds[j]);
        neighbors.get(weekIds[j])!.add(weekIds[i]);
      }
    }
  }

  const assigned: Record<string, number> = Object.create(null) as Record<string, number>;
  const usage = Array<number>(CALENDAR_OFFERING_COLOR_COUNT).fill(0);
  const pending = new Set(ids);
  while (pending.size) {
    // Dynamic saturation ordering (DSATUR): color the most constrained
    // offering first, then favor offerings co-occurring with more others.
    const next = [...pending].sort((a, b) => {
      const saturation = (id: string) => new Set([...neighbors.get(id)!]
        .filter(other => Object.hasOwn(assigned, other))
        .map(other => assigned[other])).size;
      return saturation(b) - saturation(a) || neighbors.get(b)!.size - neighbors.get(a)!.size || a.localeCompare(b);
    })[0];
    const adjacentColors = [...neighbors.get(next)!]
      .filter(id => Object.hasOwn(assigned, id)).map(id => assigned[id]);
    const usedAdjacent = new Set(adjacentColors);
    const options = Array.from({ length: CALENDAR_OFFERING_COLOR_COUNT }, (_, index) => index);
    // A color already used in the same week is permissible only when all
    // twelve colors are exhausted among neighbors.
    const unused = options.filter(index => !usedAdjacent.has(index));
    const choices = unused.length ? unused : options;
    const existing = Object.values(assigned);
    choices.sort((a, b) => {
      const score = (index: number) => {
        const primary = adjacentColors.length
          ? Math.min(...adjacentColors.map(color => COLOR_DISTANCE[index][color]))
          : existing.length ? Math.min(...existing.map(color => COLOR_DISTANCE[index][color])) : 0;
        return primary;
      };
      return score(b) - score(a) || usage[a] - usage[b] || a - b;
    });
    assigned[next] = choices[0];
    usage[choices[0]]++;
    pending.delete(next);
  }
  return assigned;
}
