import type { WeeklyCalendarOverlapGroup, WeeklyCalendarSegment } from "./WeeklyCalendarLayoutTypes";

function compareSegments(a: WeeklyCalendarSegment, b: WeeklyCalendarSegment): number {
  return a.interval.startMs - b.interval.startMs ||
    a.interval.endMs - b.interval.endMs || a.id.localeCompare(b.id);
}

/** Assign the earliest available lane and count actual concurrent intervals. */
function placeGroup(group: WeeklyCalendarSegment[], id: string, dayIndex: number): WeeklyCalendarOverlapGroup {
  const laneEnds: number[] = [];
  const activeEnds: number[] = [];
  let maxConcurrency = 0;
  for (const segment of group) {
    const available = laneEnds.findIndex(end => end <= segment.interval.startMs);
    const lane = available < 0 ? laneEnds.length : available;
    laneEnds[lane] = segment.interval.endMs;
    segment.columnIndex = lane;
    segment.overlapGroupId = id;
    for (let i = activeEnds.length - 1; i >= 0; i--) {
      if (activeEnds[i] <= segment.interval.startMs) activeEnds.splice(i, 1);
    }
    activeEnds.push(segment.interval.endMs);
    maxConcurrency = Math.max(maxConcurrency, activeEnds.length);
  }
  for (const segment of group) segment.columnCount = laneEnds.length;
  return { id, dayIndex, segmentIds: group.map(segment => segment.id), maxConcurrency,
    supportsProgressiveDisclosure: maxConcurrency >= 4 };
}

/** Partition sorted intervals into connected overlap components. */
function overlapComponents(sorted: WeeklyCalendarSegment[]): WeeklyCalendarSegment[][] {
  const components: WeeklyCalendarSegment[][] = [];
  let current: WeeklyCalendarSegment[] = [];
  let latestEnd = -Infinity;
  for (const segment of sorted) {
    if (current.length && segment.interval.startMs >= latestEnd) {
      components.push(current);
      current = [];
      latestEnd = -Infinity;
    }
    current.push(segment);
    latestEnd = Math.max(latestEnd, segment.interval.endMs);
  }
  if (current.length) components.push(current);
  return components;
}

/** Cancelled/excluded segments remain visible, but never reserve conflict lanes. */
export function assignOverlapLanes(segments: WeeklyCalendarSegment[], days: readonly string[]): WeeklyCalendarOverlapGroup[] {
  const groups: WeeklyCalendarOverlapGroup[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const eligible = segments.filter(segment => segment.dayIndex === dayIndex && segment.conflictEligible)
      .sort(compareSegments);
    overlapComponents(eligible).forEach((component, index) => {
      groups.push(placeGroup(component, `${days[dayIndex]}:group:${index}`, dayIndex));
    });
  }
  return groups;
}
