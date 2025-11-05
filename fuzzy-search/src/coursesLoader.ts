// coursesLoader.ts
import coursesJson from "../../course-browser/public/data/courses.json";
import type { Course } from "./types";

// Load courses.json from the same directory
export async function loadCourses(): Promise<Course[]> {
  try {
    const courses: Course[] = coursesJson as Course[];
    return courses;
  } catch (error) {
    console.error("Error loading courses:", error);
    return [];
  }
}
