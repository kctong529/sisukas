// main.ts
import { loadCourses } from "./coursesLoader";
import type { Course } from "./types";

async function init() {
  const courses: Course[] = await loadCourses();
  console.log("Loaded courses:", courses.length);

  // Example: show first 5 courses in console
  courses.slice(0, 5).forEach((c) => {
    console.log(
      `${c.code} - ${c.name.en} | ${c.startDate} - ${c.endDate}`
    );
  });
}

init();
