import { parseCalendarPreferenceResponse } from '@application/calendar/calendarPreferenceMapping';

import type {
  CalendarGroupPreference,
  CalendarOccurrencePreference,
  CalendarPreferenceResponse,
} from '@application/calendar/calendarPreferenceMapping';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export class CalendarPreferenceHttpError extends Error {
  constructor(public readonly status: number) {
    super(`Calendar preference request failed (HTTP ${status})`);
    this.name = 'CalendarPreferenceHttpError';
  }
}

async function request(path: string, method: 'GET' | 'PUT', body?: unknown): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  if (!response.ok) throw new CalendarPreferenceHttpError(response.status);
  return response;
}

function planPath(planId: string): string {
  return `/api/plans/${encodeURIComponent(planId)}/calendar`;
}

export class CalendarPreferencesService {
  static async load(planId: string): Promise<CalendarPreferenceResponse> {
    const response = await request(planPath(planId), 'GET');
    return parseCalendarPreferenceResponse(await response.json());
  }

  static async setGroupHidden(
    planId: string,
    group: CalendarGroupPreference,
    hidden: boolean,
  ): Promise<void> {
    await request(`${planPath(planId)}/groups`, 'PUT', { ...group, hidden });
  }

  static async setOccurrenceVisibility(
    planId: string,
    occurrence: Omit<CalendarOccurrencePreference, 'visibility'>,
    visibility: 'visible' | 'hidden' | null,
  ): Promise<void> {
    await request(`${planPath(planId)}/occurrences`, 'PUT', { ...occurrence, visibility });
  }
}
