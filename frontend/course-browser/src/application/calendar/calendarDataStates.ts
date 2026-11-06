import type { CalendarCompleteness } from "@domain/services/calendar/CalendarProjection";

/** Presentation is derived only from offering-level evidence, not event count. */
export interface CalendarDataNotice {
  kind: "loading" | "stale" | "missing" | "failed";
  message: string;
}

function offerings(count: number): string {
  return `${count} course ${count === 1 ? "offering" : "offerings"}`;
}

export function calendarDataNotices(
  completeness: CalendarCompleteness,
): CalendarDataNotice[] {
  const notices: CalendarDataNotice[] = [];
  if (completeness.failedCourses) notices.push({
    kind: "failed",
    message: `Study-group data could not be loaded for ${offerings(completeness.failedCourses)}. Other available events are still shown.`,
  });
  if (completeness.loadingCourses) notices.push({
    kind: "loading",
    message: `Loading study-group data for ${offerings(completeness.loadingCourses)}. The calendar may be incomplete.`,
  });
  if (completeness.staleCourses) notices.push({
    kind: "stale",
    message: `Using cached study-group data for ${offerings(completeness.staleCourses)}. Some event details may be outdated.`,
  });
  if (completeness.missingCourses) notices.push({
    kind: "missing",
    message: `Full study-group data is unavailable for ${offerings(completeness.missingCourses)}. The calendar may be incomplete.`,
  });
  return notices;
}

/**
 * Optional explanation for a week with no renderable events.
 * Loading and failure notices already explain why data is absent; do not
 * repeat an incomplete-calendar message underneath them.
 */
export function calendarEmptyMessage(completeness: CalendarCompleteness): string | null {
  if (completeness.totalCourses === 0) return "No courses in the active study plan.";
  if (completeness.loadingCourses > 0 || completeness.failedCourses > 0) return null;
  if (completeness.status === "partial") {
    return "No events to show with the currently available data. This calendar may be incomplete.";
  }
  return "No fixed events in this week for the active plan.";
}
