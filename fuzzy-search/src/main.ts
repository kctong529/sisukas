// main.ts
import { loadCourses } from "./coursesLoader";
import type { Course } from "./types";
import Fuse from "fuse.js";

// Get DOM elements
const input = document.getElementById("course-search") as HTMLInputElement;
const list = document.getElementById("autocomplete-list") as HTMLUListElement;

// Cast JSON to Course[]
const courses: Course[] = await loadCourses();

if (courses.length > 0) {
  input.disabled = false;
  input.placeholder = "Search for a course...";
}

// Preprocess & sort once
const sortedCourses = courses.slice().sort((a, b) => {
  // 1. Sort by course code
  if (a.code < b.code) return -1;
  if (a.code > b.code) return 1;

  // 2. Same course code: prioritize Lecture
  const aIsLecture = a.name.en.includes("Lecture");
  const bIsLecture = b.name.en.includes("Lecture");

  if (aIsLecture && !bIsLecture) return -1;
  if (!aIsLecture && bIsLecture) return 1;

  // 3. Otherwise, sort by name
  if (a.name.en < b.name.en) return -1;
  if (a.name.en > b.name.en) return 1;
  return 0;
});

// Setup Fuse on the pre-sorted array
const fuse = new Fuse(sortedCourses, {
  keys: ["code", "name.en"],
  threshold: 0.4, // lower = stricter match
  includeScore: true,
});

// Track current selection for keyboard navigation
let currentIndex = -1;
let results: Fuse.FuseResult<Course>[] = [];

// After sorting and initializing Fuse
const tooltip = document.getElementById("tooltip") as HTMLDivElement;

// Update autocomplete list
function updateList() {
  list.innerHTML = "";

  results.forEach(({ item }, index) => {
    const li = document.createElement("li");
    li.textContent = `${item.code} - ${item.name.en}`;
    li.dataset.index = index.toString();

    // Click to select
    li.addEventListener("click", () => selectCourse(index));

    // Hover: show custom tooltip
    li.addEventListener("mouseenter", (e) => {
      tooltip.textContent = `Start: ${item.startDate} | End: ${item.endDate}`;
      tooltip.style.display = "block";
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      tooltip.style.top = `${rect.top}px`;
      tooltip.style.left = `${rect.right + window.scrollX - 20}px`;
    });

    li.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });

    list.appendChild(li);
  });
}

// Select a course (click or Enter)
function selectCourse(index: number) {
  const course = results[index]?.item;
  if (!course) return;
  input.value = course.code;
  list.innerHTML = "";
  tooltip.style.display = "none";
  console.log("Selected course:", course);
}

// Handle input typing
input.addEventListener("input", () => {
  const query = input.value.trim();
  if (!query) {
    list.innerHTML = "";
    results = [];
    currentIndex = -1;
    return;
  }

  results = fuse.search(query, { limit: 12 });
  currentIndex = -1;
  updateList();
});

// Handle keyboard navigation
input.addEventListener("keydown", (e) => {
  if (!results.length) return;

  if (e.key === "ArrowDown") {
    currentIndex = (currentIndex + 1) % results.length;
    highlightSelection();
    e.preventDefault();
  } else if (e.key === "ArrowUp") {
    currentIndex = (currentIndex - 1 + results.length) % results.length;
    highlightSelection();
    e.preventDefault();
  } else if (e.key === "Enter") {
    if (currentIndex >= 0) selectCourse(currentIndex);
    e.preventDefault();
  } else if (e.key === "Escape") {
    list.innerHTML = "";
    tooltip.style.display = "none";
    e.preventDefault();
  }
});

// Highlight current selection
function highlightSelection() {
  Array.from(list.children).forEach((li, idx) => {
    (li as HTMLLIElement).style.backgroundColor = idx === currentIndex ? "#ddd" : "";
  });
}
