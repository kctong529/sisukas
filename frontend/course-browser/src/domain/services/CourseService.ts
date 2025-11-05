// src/domain/services/CourseService.ts
import type { Course } from '../models/Course';
import type { AcademicPeriod } from '../models/AcademicPeriod';
import { 
  isWithinRange, 
  overlaps, 
  durationInDays 
} from '../value-objects/DateRange';

export interface EnrollmentResult {
  canEnroll: boolean;
  reasons?: string[];
}

export const CourseService = {
  /** Check if enrollment is currently open */
  isEnrollmentOpen(course: Course, date: Date = new Date()): boolean {
    return isWithinRange(date, course.enrollmentPeriod);
  },

  /** Check if a course falls within an academic period */
  isInPeriod(course: Course, period: AcademicPeriod): boolean {
    return overlaps(course.enrollmentPeriod, period.dateRange);
  },

  /** Get course duration in days */
  getCourseDuration(course: Course): number {
    const range = { start: course.startDate, end: course.endDate };
    return durationInDays(range);
  },

  /** Determine if student can enroll in the course */
  canEnroll(course: Course, completedCourses: string[]): EnrollmentResult {
    const reasons: string[] = [];

    if (!this.isEnrollmentOpen(course)) reasons.push('Enrollment period is closed');
    if (course.prerequisites && !course.prerequisites.validate(completedCourses))
      reasons.push('Prerequisites not met');

    return {
      canEnroll: reasons.length === 0,
      reasons: reasons.length ? reasons : undefined
    };
  }
};