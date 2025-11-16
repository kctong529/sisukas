// src/domain/services/CourseService.ts
import type { Course } from '../models/Course';
import type { AcademicPeriod } from '../models/AcademicPeriod';
import { 
  isWithinRange, 
  overlaps, 
  durationInDays 
} from '../value-objects/DateRange';

export interface EnrollmentResult {
  reasons?: string[];
}

export const CourseService = {
  /** Check if a course falls within an academic period */
  isInPeriod(course: Course, period: AcademicPeriod): boolean {
    return overlaps(course.enrollmentPeriod, period.dateRange);
  },

  /** Get course duration in days */
  getCourseDuration(course: Course): number {
    const range = { start: course.startDate, end: course.endDate };
    return durationInDays(range);
  },
};