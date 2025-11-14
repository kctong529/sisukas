<script lang="ts">
  import Counter from "./lib/Counter.svelte";

  // Types
  interface CourseIdentifier {
    course_unit_id: string;
    course_offering_id: string;
    code: string;
    name: string;
  }

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

  interface CourseStudyGroups {
    course: CourseIdentifier;
    study_groups: StudyGroup[];
    loading: boolean;
    error: string | null;
  }

  // Sample data
  const sampleCourses: CourseIdentifier[] = [
    {
      course_unit_id: "aalto-OPINKOHD-1125585231-20210801",
      course_offering_id: "aalto-CUR-205923-3121703",
      code: "CS-A1110",
      name: "Programming 1, Lecture",
    },
    {
      course_unit_id: "aalto-CU-1150973075-20240801",
      course_offering_id: "aalto-CUR-205972-3121752",
      code: "CS-A1140",
      name: "Data Structures and Algorithms, Lecture",
    },
    {
      course_unit_id: "aalto-CU-1150972114-20240801",
      course_offering_id: "aalto-CUR-204414-3120194",
      code: "ELEC-A7200",
      name: "Signals and Systems, Lecture",
    },
    {
      course_unit_id: "aalto-CU-1150971929-20240801",
      course_offering_id: "otm-e6b7a1f7-b842-4609-aa74-0c1dc8e38c9f",
      code: "ELEC-C0302",
      name: "Final Project in Digital Systems and Design, Lectures",
    },
    {
      course_unit_id: "otm-31152500-c076-4d00-a20b-a81f6c1187e8",
      course_offering_id: "aalto-CUR-203904-3119684",
      code: "ELEC-E8001",
      name: "Embedded Real-Time Systems, Lecture",
    },
    {
      course_unit_id: "otm-2b18b775-8602-485b-a39b-47f3e6008e55",
      course_offering_id: "aalto-CUR-209198-3124630",
      code: "MS-A0111",
      name: "Differential and Integral Calculus 1, Lecture",
    },
    {
      course_unit_id: "aalto-OPINKOHD-1132972157-20210801",
      course_offering_id: "aalto-CUR-206548-3122328",
      code: "TU-A1300",
      name: "Introduction to Industrial Engineering and Management, Lecture",
    },
    {
      course_unit_id: "aalto-CU-1150972262-20240801",
      course_offering_id: "aalto-CUR-204345-3120125",
      code: "ELEC-C9801",
      name: "Design Thinking and Electronic Prototyping, Lecture",
    },
    {
      course_unit_id: "otm-2867b1b8-c433-4270-92a2-1adb55dca893",
      course_offering_id: "aalto-CUR-204107-3119887",
      code: "ELEC-C9410",
      name: "Photonics and Optical Communications, Lecture",
    },
    {
      course_unit_id: "aalto-CU-1150972282-20240801",
      course_offering_id: "aalto-CUR-204338-3120118",
      code: "ELEC-C9620",
      name: "Basics of Electronic Circuits, Lecture",
    },
  ];

  // API base URL
  const API_BASE = "http://127.0.0.1:8000";

  // Helper function to format event datetime
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

  // State to store all results
  let courseData: CourseStudyGroups[] = $state([]);

  // Fetch study groups for a single course
  async function fetchStudyGroups(
    course: CourseIdentifier,
  ): Promise<StudyGroup[]> {
    const url = new URL(`${API_BASE}/study-groups`);
    url.searchParams.append("course_unit_id", course.course_unit_id);
    url.searchParams.append("course_offering_id", course.course_offering_id);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async function fetchAllStudyGroups() {
    // Initialize courseData with loading states
    courseData = sampleCourses.map((course) => ({
      course: course,
      study_groups: [],
      loading: true,
      error: null,
    }));

    // Fetch all in parallel
    await Promise.allSettled(
      courseData.map(async (item, index) => {
        try {
          const studyGroups = await fetchStudyGroups(item.course);
          courseData[index].study_groups = studyGroups;
          courseData[index].loading = false;
          courseData[index].error = null;
        } catch (error) {
          courseData[index].study_groups = [];
          courseData[index].loading = false;
          courseData[index].error =
            error instanceof Error ? error.message : "Unknown error";
        }
      }),
    );
  }

  // Auto-fetch on mount
  import { onMount } from "svelte";
  onMount(() => {
    fetchAllStudyGroups();
  });
</script>

<main>
  <div>
    <h1>Course Study Groups</h1>

    <button onclick={fetchAllStudyGroups}>Refresh Data</button>

    {#each courseData as item}
      <div class="course-card">
        <h2>{item.course.code}: {item.course.name}</h2>

        {#if item.loading}
          <p>Loading...</p>
        {:else if item.error}
          <p class="error">Error: {item.error}</p>
        {:else if item.study_groups.length === 0}
          <p>No study groups found</p>
        {:else}
          <div class="study-groups-container">
            {#each item.study_groups as group}
              <div class="study-group">
                <h3>{group.name} ({group.type})</h3>
                <details>
                  <summary>Show all {group.study_events.length} events</summary>
                  {#each group.study_events as event}
                    <div class="event">
                      {formatEventTime(event.start, event.end)}
                    </div>
                  {/each}
                </details>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</main>

<style>
  h1 {
    font-size: 1.5rem;
  }

  h2 {
    font-size: 1.2rem;
  }

  h3 {
    font-size: 1rem;
  }

  .course-card {
    border: 1px solid #ccc;
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 4px;
  }

  .study-groups-container {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }

  .study-group {
    background: #f5f5f5;
    padding: 0.5rem;
    border-radius: 4px;
    flex: 1;
    min-width: 200px;
  }

  .events-list {
    margin-top: 0.5rem;
  }

  .event {
    padding: 0.25rem 0;
    font-size: 0.9em;
  }

  .error {
    color: red;
  }

  details {
    margin-top: 0.5rem;
  }
</style>
