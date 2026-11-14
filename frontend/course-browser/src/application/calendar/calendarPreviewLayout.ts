import { assignOverlapLanes } from '@domain/services/calendar/layout/WeeklyCalendarOverlap';

import type {
  WeeklyCalendarLayoutResult,
  WeeklyCalendarSegment,
} from '@domain/services/calendar/layout/WeeklyCalendarLayout';

/**
 * Reflow the timetable for a transient visibility preview. Hidden entries only
 * occupy a lane while being previewed; the stored layout remains unchanged.
 *
 * Do not pass excluded entries here: planning and source exclusions are not
 * visibility preferences and must not be resurrected by hover.
 */
export function calendarPreviewLayout(
  layout: WeeklyCalendarLayoutResult,
  previewOnlySegments: readonly WeeklyCalendarSegment[],
): {
  visibleSegments: WeeklyCalendarSegment[];
  previewOnlySegments: WeeklyCalendarSegment[];
} {
  if (previewOnlySegments.length === 0) {
    return { visibleSegments: layout.segments, previewOnlySegments: [] };
  }

  // The overlap assigner mutates its segments. Never mutate the normal layout
  // or the separately computed unfiltered layout.
  const visibleSegments = layout.segments.map(segment => ({ ...segment }));
  const visibleIds = new Set(visibleSegments.map(segment => segment.id));
  const previewSegments = previewOnlySegments
    .filter(segment => !visibleIds.has(segment.id))
    .map(segment => ({ ...segment }));

  if (previewSegments.length === 0) {
    return { visibleSegments: layout.segments, previewOnlySegments: [] };
  }

  assignOverlapLanes([...visibleSegments, ...previewSegments], layout.days);
  return { visibleSegments, previewOnlySegments: previewSegments };
}
