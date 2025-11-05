import { loadCourses } from "./coursesLoader";
import type { Course } from "./types";
import Fuse from "fuse.js";

// Study group types
interface StudyEvent {
  start: string;
  end: string;
}

interface StudyGroup {
  group_id: string;
  name: string;
  type: string;
  study_events: StudyEvent[];
}

// Get DOM elements
const input = document.getElementById("course-search") as HTMLInputElement;
const list = document.getElementById("autocomplete-list") as HTMLUListElement;
const courseCard = document.getElementById("course-card") as HTMLDivElement;
const tooltip = document.getElementById("tooltip") as HTMLDivElement;

// API configuration
const API_BASE = "http://127.0.0.1:8000";

// Load courses
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
  threshold: 0.4,
  includeScore: true,
});

// Track current selection for keyboard navigation
let currentIndex = -1;
let results: Fuse.FuseResult<Course>[] = [];

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Format event datetime
function formatEventTime(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const dateStr = startDate.toLocaleDateString("en-FI", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });

  const startTime = startDate.toLocaleTimeString("en-FI", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const endTime = endDate.toLocaleTimeString("en-FI", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${dateStr} ${startTime} – ${endTime}`;
}

// Fetch study groups for a course
async function fetchStudyGroups(course: Course): Promise<StudyGroup[]> {
  try {
    const url = new URL(`${API_BASE}/study-groups`);
    url.searchParams.append("course_unit_id", course.courseUnitId);
    url.searchParams.append("course_offering_id", course.id);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching study groups:", error);
    return [];
  }
}

// Display course card
async function displayCourseCard(course: Course) {
  const credits = course.credits 
    ? `${course.credits.min}${course.credits.max > course.credits.min ? ` - ${course.credits.max}` : ''} ECTS`
    : 'Not specified';

  const languages = course.languageOfInstructionCodes.length > 0
    ? course.languageOfInstructionCodes.join(', ').toUpperCase()
    : 'Not specified';

  // Build sections dynamically
  let sectionsHTML = '';

  // Learning Outcomes
  if (course.summary.learningOutcomes?.en) {
    sectionsHTML += `
      <div class="card-section">
        <h3 class="section-title">Learning Outcomes</h3>
        <div class="section-content">${course.summary.learningOutcomes.en}</div>
      </div>
    `;
  }

  // Content
  if (course.summary.content?.en) {
    sectionsHTML += `
      <div class="card-section">
        <h3 class="section-title">Content</h3>
        <div class="section-content">${course.summary.content.en}</div>
      </div>
    `;
  }

  // Prerequisites
  if (course.summary.prerequisites?.en) {
    sectionsHTML += `
      <div class="card-section">
        <h3 class="section-title">Prerequisites</h3>
        <div class="section-content">${course.summary.prerequisites.en}</div>
      </div>
    `;
  }

  // Workload
  if (course.summary.workload?.en) {
    sectionsHTML += `
      <div class="card-section">
        <h3 class="section-title">Workload</h3>
        <div class="section-content">${course.summary.workload.en}</div>
      </div>
    `;
  }

  // Teachers
  if (course.teachers.length > 0) {
    const teachersHTML = course.teachers
      .map(teacher => `<div class="teacher-item">${teacher}</div>`)
      .join('');
    
    sectionsHTML += `
      <div class="card-section">
        <h3 class="section-title">Teachers</h3>
        <div class="teachers-list">${teachersHTML}</div>
      </div>
    `;
  }

  // Initial card HTML without study groups
  courseCard.innerHTML = `
    <div class="card-header">
      <div class="course-code">${course.code}</div>
      <h2 class="course-title">${course.name.en}</h2>
      <p class="course-organization">${course.organizationName.en}</p>
    </div>

    <div class="card-meta">
      <div class="meta-item">
        <div class="meta-label">Credits</div>
        <div class="meta-value">${credits}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Start Date</div>
        <div class="meta-value">${formatDate(course.startDate)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">End Date</div>
        <div class="meta-value">${formatDate(course.endDate)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Language</div>
        <div class="meta-value">${languages}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Type</div>
        <div class="meta-value">${course.type}</div>
      </div>
    </div>

    ${sectionsHTML || '<div class="empty-state">No additional information available</div>'}
    
    <div class="card-section">
      <h3 class="section-title">Study Groups</h3>
      <div id="study-groups-container" class="study-groups-loading">
        <div class="loading-spinner">Loading study groups...</div>
      </div>
    </div>
  `;

  courseCard.style.display = 'block';

  // Fetch and display study groups
  const studyGroups = await fetchStudyGroups(course);
  const studyGroupsContainer = document.getElementById('study-groups-container');
  
  if (!studyGroupsContainer) return;

  if (studyGroups.length === 0) {
    studyGroupsContainer.innerHTML = '<div class="empty-state">No study groups available</div>';
    studyGroupsContainer.classList.remove('study-groups-loading');
  } else {
    const groupsHTML = studyGroups
      .map(group => {
        const eventsHTML = group.study_events.length > 0
          ? group.study_events
              .map(event => `<div class="event-item">${formatEventTime(event.start, event.end)}</div>`)
              .join('')
          : '<div class="empty-state">No events scheduled</div>';

        return `
          <div class="study-group-card">
            <div class="study-group-header">
              <h4 class="study-group-name">${group.name}</h4>
              <span class="study-group-type">${group.type}</span>
            </div>
            <details class="study-group-details">
              <summary class="study-group-summary">Show all ${group.study_events.length} events</summary>
              <div class="events-list">${eventsHTML}</div>
            </details>
          </div>
        `;
      })
      .join('');

    studyGroupsContainer.innerHTML = `<div class="study-groups-grid">${groupsHTML}</div>`;
    studyGroupsContainer.classList.remove('study-groups-loading');
  }
}

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
  
  // Display the course card
  displayCourseCard(course);
  
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