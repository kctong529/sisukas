import type { OccurrenceKeyScope } from './occurrenceKey';

export interface CalendarGroupIdentity {
  courseOfferingId: string;
  studyGroupId: string;
}

export interface CalendarOccurrenceIdentity extends CalendarGroupIdentity, OccurrenceKeyScope {}
export type CalendarVisibility = 'visible' | 'hidden';

export interface CalendarOccurrencePreference extends CalendarOccurrenceIdentity {
  visibility: CalendarVisibility;
}

export interface CalendarPreferences {
  hiddenGroups: CalendarGroupIdentity[];
  occurrenceOverrides: CalendarOccurrencePreference[];
}

export class CalendarPlanNotFoundError extends Error {
  constructor() {
    super('Plan not found');
    this.name = 'CalendarPlanNotFoundError';
  }
}

export class CalendarOfferingNotInPlanError extends Error {
  constructor() {
    super('Course offering is not in the plan');
    this.name = 'CalendarOfferingNotInPlanError';
  }
}

export class CalendarIdentityCollisionError extends Error {
  constructor() {
    super('Occurrence digest matches another serialized identity');
    this.name = 'CalendarIdentityCollisionError';
  }
}
