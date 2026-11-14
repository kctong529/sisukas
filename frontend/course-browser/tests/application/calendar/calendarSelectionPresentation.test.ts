import { describe, expect, it } from "vitest";

import { calendarSelectionLabel } from "@application/calendar/calendarSelectionPresentation";

describe("calendar selection labels", () => {
  it("distinguishes candidate, selected, and excluded choices", () => {
    expect(calendarSelectionLabel("candidate")).toContain("Candidate");
    expect(calendarSelectionLabel("selected")).toBe("Selected");
    expect(calendarSelectionLabel("excluded")).toContain("Excluded");
  });
});
