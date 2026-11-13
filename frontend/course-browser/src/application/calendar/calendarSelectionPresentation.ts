import type { CalendarGroupSelection } from "@domain/services/calendar/CalendarProjection";

/** A Sisukas planning choice is not a confirmed SISU registration. */
export function calendarSelectionLabel(state: CalendarGroupSelection): string {
  switch (state) {
    case "selected": return "Selected";
    case "candidate": return "Candidate";
    case "excluded": return "Excluded";
  }
}
