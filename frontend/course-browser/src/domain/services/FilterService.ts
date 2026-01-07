// src/domain/services/FilterService.ts
import type { Course } from '../models/Course';
import type { FilterRule } from '../filters/core/FilterRule';

export class FilterService {
  /**
   * Apply filter groups to courses (OR between groups, AND within groups)
   * 
   * @param courses - Array of courses to filter
   * @param filterGroups - Array of filter rule groups
   * @returns Filtered courses
   */
  static applyFilters(
    courses: Course[],
    filterGroups: FilterRule<Course>[][]
  ): Course[] {
    if (filterGroups.length === 0) {
      return courses;
    }

    return courses.filter(course => {
      return filterGroups.some(group => {
        return group.every(rule => rule.evaluate(course));
      });
    });
  }

  /**
   * Get unique courses by code, preferring lecture format and later start dates
   * 
   * @param courses - Array of courses to deduplicate
   * @returns Array of unique courses
   */
  static getUniqueCourses(courses: Course[]): Course[] {
    const uniqueMap = new Map<string, Course>();
    
    courses.forEach(course => {
      const code = course.code.value.toLowerCase();
      const isLecture = course.format === 'lecture';
      
      if (uniqueMap.has(code)) {
        const existingCourse = uniqueMap.get(code)!;
        const existingIsLecture = existingCourse.format === 'lecture';
        
        // Prefer lecture format over other formats
        if (!existingIsLecture && isLecture) {
          uniqueMap.set(code, course);
        }
        // If both are lectures, keep the one with later start date
        else if (isLecture && course.courseDate.start > existingCourse.courseDate.start) {
          uniqueMap.set(code, course);
        }
      } else {
        uniqueMap.set(code, course);
      }
    });
    
    return Array.from(uniqueMap.values());
  }
}