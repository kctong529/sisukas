import { describe, expect, it } from "vitest";
import { calendarSelectionLabel } from "@application/calendar/calendarSelectionPresentation";

describe("calendar selection labels", () => {
  it("distinguishes candidate, selected, and explicitly empty choices", () => {
    expect(calendarSelectionLabel("candidate")).toContain("Candidate");
    expect(calendarSelectionLabel("selected")).toBe("Selected in Sisukas");
    expect(calendarSelectionLabel("explicit-empty")).toContain("No teaching groups selected");
  });
});
