import { describe, expect, it } from "vitest";
import { summarizeCalendarCompleteness } from "@domain/services/calendar/CalendarProjection";
import type { StudyGroupSnapshot } from "@domain/services/calendar/CalendarProjection";

describe("calendar projection completeness", () => {
  it("treats an empty active plan as complete", () => {
    expect(summarizeCalendarCompleteness([])).toEqual({
      status: "complete", totalCourses: 0, availableCourses: 0,
      staleCourses: 0, missingCourses: 0, loadingCourses: 0, failedCourses: 0,
    });
  });

  it.each(["available", "stale", "missing", "loading", "failed"] as const)(
    "counts one %s offering exactly once", (state) => {
      const summary = summarizeCalendarCompleteness([state]);
      expect(summary.totalCourses).toBe(1);
      expect(summary.status).toBe(state === "available" ? "complete" : "partial");
      expect([
        summary.availableCourses, summary.staleCourses, summary.missingCourses,
        summary.loadingCourses, summary.failedCourses,
      ].reduce((a, b) => a + b, 0)).toBe(1);
    },
  );

  it("separates available, stale, missing, loading, and failed", () => {
    expect(summarizeCalendarCompleteness([
      "available", "available", "available", "available", "stale", "failed",
    ])).toEqual({
      status: "partial", totalCourses: 6, availableCourses: 4,
      staleCourses: 1, missingCourses: 0, loadingCourses: 0, failedCourses: 1,
    });
  });

  it("does not change input", () => {
    const states = Object.freeze(["available", "stale"] as const);
    summarizeCalendarCompleteness(states);
    expect(states).toEqual(["available", "stale"]);
  });

  it("distinguishes successfully empty data from unavailable full data", () => {
    const fetchedEmpty: StudyGroupSnapshot = { availability: "available", groups: [] };
    const notFetched: StudyGroupSnapshot = { availability: "missing", groups: null };
    expect(fetchedEmpty.groups).toEqual([]);
    expect(notFetched.groups).toBeNull();
  });
});
