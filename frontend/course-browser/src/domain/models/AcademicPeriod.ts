// src/domain/models/AcademicPeriod.ts
import type { DateRange } from '../valueObjects/DateRange';

export interface AcademicPeriod {
  id: string;
  name: string;
  academicYear: string;
  dateRange: DateRange;
}