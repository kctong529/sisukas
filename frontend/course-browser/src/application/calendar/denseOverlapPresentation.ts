import type {
  WeeklyCalendarLayoutResult,
  WeeklyCalendarOverlapGroup,
  WeeklyCalendarSegment,
} from '@domain/services/calendar/layout/WeeklyCalendarLayout';

/** A compact card represents only a continuous interval of actual dense concurrency. */
export interface DenseOverlapDisplay {
  id: string;
  group: WeeklyCalendarOverlapGroup;
  segments: WeeklyCalendarSegment[];
  startMinute: number;
  endMinute: number;
}

export interface DenseOverlapPresentation {
  displays: DenseOverlapDisplay[];
  visibleSegments: WeeklyCalendarSegment[];
}

interface TimeSlice {
  start: number;
  end: number;
  active: WeeklyCalendarSegment[];
}

const DENSE_THRESHOLD = 4;

/** Use half-open wall-clock intervals; the domain engine already splits DST transitions. */
function slicesForGroup(segments: WeeklyCalendarSegment[]): TimeSlice[] {
  const boundaries = [...new Set(segments.flatMap(segment => [segment.startMinute, segment.endMinute]))]
    .sort((a, b) => a - b);
  const slices: TimeSlice[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const active = segments.filter(segment => segment.startMinute < end && segment.endMinute > start)
      .sort((a, b) => a.columnIndex - b.columnIndex || a.id.localeCompare(b.id));
    if (active.length) slices.push({ start, end, active });
  }
  return slices;
}

function compactRanges(group: WeeklyCalendarOverlapGroup, slices: TimeSlice[]): DenseOverlapDisplay[] {
  const displays: DenseOverlapDisplay[] = [];
  for (const slice of slices.filter(part => part.active.length >= DENSE_THRESHOLD)) {
    const previous = displays.at(-1);
    if (previous && previous.endMinute === slice.start) {
      previous.endMinute = slice.end;
      const members = new Map(previous.segments.map(segment => [segment.id, segment]));
      for (const segment of slice.active) members.set(segment.id, segment);
      previous.segments = [...members.values()];
    } else {
      displays.push({
        id: `${group.id}:dense:${slice.start}`,
        group,
        segments: [...slice.active],
        startMinute: slice.start,
        endMinute: slice.end,
      });
    }
  }
  return displays;
}

/** Keep event geometry intact; disclosure is an overlay, not event fragmentation. */
export function denseOverlapPresentation(layout: WeeklyCalendarLayoutResult): DenseOverlapPresentation {
  const segmentsById = new Map(layout.segments.map(segment => [segment.id, segment]));
  const displays: DenseOverlapDisplay[] = [];

  for (const group of layout.overlapGroups.filter(item => item.supportsProgressiveDisclosure)) {
    const members = group.segmentIds.map(id => {
      const segment = segmentsById.get(id);
      if (!segment) throw new Error(`Missing segment ${id} in overlap group ${group.id}`);
      return segment;
    });
    displays.push(...compactRanges(group, slicesForGroup(members)));
  }

  return { displays, visibleSegments: layout.segments };
}

/** Convenience selector for clients interested only in disclosure cards. */
export function denseOverlapDisplays(layout: WeeklyCalendarLayoutResult): DenseOverlapDisplay[] {
  return denseOverlapPresentation(layout).displays;
}
