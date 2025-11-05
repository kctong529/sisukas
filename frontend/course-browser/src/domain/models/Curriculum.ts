// src/domain/models/Curriculum.ts
import type { CourseCode } from '../value-objects/CourseTypes';
import type { DateRange } from '../value-objects/DateRange';

export interface Curriculum {
  id: string;
  code: string;
  name: string;
  type: 'major' | 'minor';
  requiredCourses: CourseCode[];
  electiveCourses: CourseCode[];
  creditRequirement: number;
  validPeriod: DateRange;
}