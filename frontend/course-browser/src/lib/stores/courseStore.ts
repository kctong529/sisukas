// src/lib/stores/courseStore.ts
import { writable, get } from 'svelte/store';
import { loadCoursesWithCache } from '../../infrastructure/loaders/RemoteCourseLoader';
import type { Course } from '../../domain/models/Course';

export interface CourseStoreState {
  // Map from courseId (code.value) to array of course instances
  coursesByCode: Map<string, Course[]>;
  loading: boolean;
  error: string | null;
}

function createCourseStore() {
  const initialState: CourseStoreState = {
    coursesByCode: new Map(),
    loading: false,
    error: null,
  };

  const { subscribe, set, update } = writable(initialState);

  return {
    subscribe,

    /**
     * Load courses from API and build the courseId map
     * Only call this if you haven't already loaded courses
     */
    async load() {
      update(state => ({ ...state, loading: true, error: null }));
      
      try {
        const courses = await loadCoursesWithCache();
        const coursesByCode = buildCourseMap(courses);
        
        set({
          coursesByCode,
          loading: false,
          error: null,
        });
        
        console.log('CourseStore loaded:', coursesByCode.size, 'courses');
        return coursesByCode;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to load courses';
        set({
          coursesByCode: new Map(),
          loading: false,
          error,
        });
        throw err;
      }
    },

    /**
     * Set courses directly and build the courseId map
     * Preferred: Use this in App.svelte instead of load()
     */
    setCourses(courses: Course[]) {
      const coursesByCode = buildCourseMap(courses);
      
      set({
        coursesByCode,
        loading: false,
        error: null,
      });
      
      console.log('CourseStore populated:', coursesByCode.size, 'unique courses');
      return coursesByCode;
    },

    /**
     * Get all instances of a course by courseId (code.value)
     * Uses get() for immediate access without subscription
     */
    getByCode(courseId: string): Course[] {
      const state = get(this);
      const result = state.coursesByCode.get(courseId) || [];
      
      if (result.length === 0) {
        console.warn(`No courses found for courseId: ${courseId}`);
      }
      
      return result;
    },

    /**
     * Get all courses grouped by courseId
     */
    getAll(): Map<string, Course[]> {
      return get(this).coursesByCode;
    },

    /**
     * Get list of all course codes available
     */
    getCourseCodes(): string[] {
      return Array.from(get(this).coursesByCode.keys());
    },

    /**
     * Check if courseStore is empty
     */
    isEmpty(): boolean {
      return get(this).coursesByCode.size === 0;
    },

    /**
     * Get count of unique courses
     */
    getUniqueCount(): number {
      return get(this).coursesByCode.size;
    },

    /**
     * Get total count of all course instances
     */
    getTotalInstanceCount(): number {
      let total = 0;
      for (const instances of get(this).coursesByCode.values()) {
        total += instances.length;
      }
      return total;
    },
  };
}

/**
 * Helper function to build a Map from courses array
 * Groups all course instances by their courseId
 */
function buildCourseMap(courses: Course[]): Map<string, Course[]> {
  const map = new Map<string, Course[]>();
  
  for (const course of courses) {
    const courseId = course.code.value;
    
    if (!map.has(courseId)) {
      map.set(courseId, []);
    }
    
    map.get(courseId)!.push(course);
  }
  
  console.log(`Built course map with ${map.size} unique course codes`);
  
  return map;
}

export const courseStore = createCourseStore();