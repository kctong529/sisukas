import { describe, expect, it } from "vitest";

import { calendarDataNotices, calendarEmptyMessage } from "@application/calendar/calendarDataStates";
import { summarizeCalendarCompleteness } from "@domain/services/calendar/CalendarProjection";

describe("calendar data-state notices", () => {
  it("does not show warnings for fully available or successfully empty data", () => {
    expect(calendarDataNotices(summarizeCalendarCompleteness([]))).toEqual([]);
    expect(calendarDataNotices(summarizeCalendarCompleteness(["available"]))).toEqual([]);
  });
  it("keeps loading, stale, missing and failed evidence separate", () => {
    const notices = calendarDataNotices(summarizeCalendarCompleteness([
      "available", "loading", "stale", "missing", "failed", "missing",
    ]));
    expect(notices.map(n => n.kind)).toEqual(["failed", "loading", "stale", "missing"]);
    expect(notices[3].message).toContain("2 course offerings");
    expect(notices[2].message).toContain("cached");
    expect(notices[0].message).toContain("Other available events");
  });
});

describe("calendar empty-state messaging", () => {
  it("does not duplicate loading notices when no events are visible", () => {
    expect(calendarEmptyMessage(summarizeCalendarCompleteness([
      "loading", "loading",
    ]))).toBeNull();
  });

  it("lets failure notices explain an otherwise empty calendar", () => {
    expect(calendarEmptyMessage(summarizeCalendarCompleteness([
      "failed", "available",
    ]))).toBeNull();
  });

  it("retains the incomplete-data message when only data is missing", () => {
    expect(calendarEmptyMessage(summarizeCalendarCompleteness([
      "missing", "available",
    ]))).toContain("calendar may be incomplete");
  });

  it("distinguishes an empty plan from an empty week with complete data", () => {
    expect(calendarEmptyMessage(summarizeCalendarCompleteness([])))
      .toBe("No courses in the active study plan.");
    expect(calendarEmptyMessage(summarizeCalendarCompleteness(["available"])))
      .toBe("No fixed events in this week for the active plan.");
  });
});
