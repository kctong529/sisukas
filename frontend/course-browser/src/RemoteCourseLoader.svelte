<script lang="ts">
  import { Course } from "./domain/models/Course";
  import { loadCoursesWithCache } from "./infrastructure/loaders/RemoteCourseLoader";
  import type { AcademicPeriod } from "./domain/models/AcademicPeriod";
  import { loadAcademicPeriods } from "./infrastructure/loaders/AcademicPeriods";

  let courses: Course[] = [];
  let periods: AcademicPeriod[] = [];
  let loading = true;
  let loadError: string | null = null;

  (async () => {
    try {
      periods = loadAcademicPeriods();
      console.log("Academic Periods loaded:", periods);

      const all_courses = await loadCoursesWithCache();
      courses = all_courses;
      console.log(courses);
    } catch (e) {
      loadError = `Failed to load courses: ${e instanceof Error ? e.message : "Unknown error"}`;
    } finally {
      loading = false;
    }
  })();
</script>

<ul class="course-list">
  {#if loading}
    <p>Loading course data...</p>
  {:else if loadError}
    <p style="color: red;">Error: {loadError}</p>
  {:else}
    {#each courses as course}
      <li class="course-card">
        <div class="course-header">
          <h2>{course.code} — {course.name.en}</h2>
          <span class="course-level">{course.level}</span>
        </div>

        <ul class="course-details">
          <li>
            <strong>Prerequisites:</strong>
            {#if course.prerequisites && !course.prerequisites.hasTextOnly}
              {course.prerequisites.codePatterns.join(", ")}
            {:else}
              None
            {/if}
          </li>
          <li><strong>Credits:</strong> {course.credits.min}</li>
          <li><strong>Organization:</strong> {course.organization}</li>
        </ul>
      </li>
    {/each}
  {/if}
</ul>

<style>
  /* ... existing styles ... */
  .course-list {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.2rem;
  }

  .course-card {
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 12px;
    padding: 1.2rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .course-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  }

  .course-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.5rem;
  }

  .course-header h2 {
    font-size: 1.2rem;
    color: #222;
    margin: 0;
  }

  .course-level {
    background: #eee;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.85rem;
    text-transform: capitalize;
    color: #555;
  }

  .course-details {
    list-style: none;
    padding: 0.3rem 0 0 0;
    margin: 0;
    font-size: 0.95rem;
  }

  .course-details li {
    padding: 0.3rem 0;
    border-bottom: 1px solid #f0f0f0;
  }

  .course-details li:last-child {
    border-bottom: none;
  }

  strong {
    color: #333;
  }
</style>
