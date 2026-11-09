import {
  type CalendarVisibility,
  EMPTY_CALENDAR_VISIBILITY,
} from '@application/calendar/calendarVisibility';

/**
 * In-memory, plan-scoped calendar display preferences (#92).
 * Kept outside CalendarView so navigating away or switching plans does not erase
 * choices during the current app session. Reloads intentionally reset them;
 * persisted user/plan-scoped preferences belong to #93.
 */
export function createCalendarVisibilitySessionStore() {
  let visibilityByPlan = $state<Record<string, CalendarVisibility>>(Object.create(null));

  return {
    forPlan(planId: string | undefined): CalendarVisibility {
      return planId !== undefined && Object.hasOwn(visibilityByPlan, planId)
        ? visibilityByPlan[planId]
        : EMPTY_CALENDAR_VISIBILITY;
    },
    setForPlan(planId: string, visibility: CalendarVisibility): void {
      visibilityByPlan = Object.assign(
        Object.create(null),
        visibilityByPlan,
        { [planId]: visibility },
      );
    },
  };
}

export const calendarVisibilitySessionStore = createCalendarVisibilitySessionStore();
