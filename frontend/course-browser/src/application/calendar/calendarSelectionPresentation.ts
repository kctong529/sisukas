import type { CalendarGroupSelection } from "@domain/services/calendar/CalendarProjection";

/** A Sisukas planning choice is not a confirmed SISU registration. */
export function calendarSelectionLabel(state: CalendarGroupSelection): string {
  switch (state) {
    case "selected": return "Selected in Sisukas";
    case "candidate": return "Candidate · not selected in Sisukas";
    case "excluded": return "Excluded from Sisukas calendar";
  }
}
