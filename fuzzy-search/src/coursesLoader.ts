import type { Course } from "./types";

// Load courses.json - update this path to match your project structure
// If courses.json is in the public folder: import coursesJson from "../public/courses.json";
// If it's in a different location, adjust the path accordingly
export async function loadCourses(): Promise<Course[]> {
  try {
    // Fetch from public directory at runtime
    const response = await fetch('https://storage.googleapis.com/fuzzy-data/courses.json');
    if (!response.ok) {
      throw new Error(`Failed to load courses: ${response.statusText}`);
    }
    const courses: Course[] = await response.json();
    return courses;
  } catch (error) {
    console.error("Error loading courses:", error);
    return [];
  }
}
