// src/domain/viewModels/PeriodTimelineModel.ts
import type { AcademicPeriod } from '../models/AcademicPeriod';

export type PeriodTimelineChip = {
  key: string;         // unique key for rendering (can be instanceId)
  instanceId: string;  // plan instance id
  courseCode: string;  // code.value
  unitId: string;
  name: string;
  spanLabel: string;   // "I" or "I–II"
  credits: number;
  grade?: number;
};

export type PeriodTimelineModel = {
  academicYear: string;
  columns: Array<{
    period: AcademicPeriod;
    items: PeriodTimelineChip[];
  }>;
  creditsPerPeriod: number[];
  singlePeriodCreditsPerPeriod: number[];
};
