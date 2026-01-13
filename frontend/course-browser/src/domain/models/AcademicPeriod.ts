// src/domain/models/AcademicPeriod.ts
<<<<<<< HEAD
import type { DateRange } from '../valueObjects/DateRange';
=======
import type { DateRange } from '../value-objects/DateRange';
>>>>>>> main

export interface AcademicPeriod {
  id: string;
  name: string;
  academicYear: string;
  dateRange: DateRange;
}