import type { CalendarOfferingSelection } from "@domain/services/calendar/CalendarProjection";

/** Only an explicit saved Sisukas choice may be labelled selected. */
export function calendarSelectionLabel(state: CalendarOfferingSelection): string {
  switch (state) {
    case "selected": return "Selected in Sisukas";
    case "candidate": return "Candidate · not selected in Sisukas";
    case "explicit-empty": return "No teaching groups selected in Sisukas";
  }
}
