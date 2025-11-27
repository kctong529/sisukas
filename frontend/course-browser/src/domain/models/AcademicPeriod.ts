// src/domain/models/AcademicPeriod.ts
import type { DateRange } from '../value-objects/DateRange';

export interface AcademicPeriod {
  id: string;
  name: string;
  academicYear: string;
  dateRange: DateRange;
}