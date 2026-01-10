<!-- src/components/FavouritesView.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { useSession } from '../lib/authClient';
  import { favouritesStore } from '../lib/stores/favouritesStore';
  import { courseStore } from '../lib/stores/courseStore';
  import StudyGroupsSection from './StudyGroupsSection.svelte';
  import type { Course } from '../domain/models/Course';

  const session = useSession();
  $: isSignedIn = !!$session.data?.user;
  
  let sortBy = 'addedAt';
  let sortDirection = -1; // -1 for descending (newest first)
  let editingCourseId: string | null = null;
  let editingNotes: string = '';
  let hasLoadedForUser = false;
  let expandAllStudyGroups = false;



  onMount(async () => {
    if (isSignedIn && !hasLoadedForUser) {
      await favouritesStore.load();
      hasLoadedForUser = true;
    }
  });

  // Reload when user signs in (reactive)
  $: if (isSignedIn && !hasLoadedForUser) {
    favouritesStore.load();
    hasLoadedForUser = true;
  } else if (!isSignedIn) {
    favouritesStore.clear();
    hasLoadedForUser = false;
  }

  // Get all courses for a given courseId (1-to-N mapping)
  // Uses courseStore's built-in method for cleaner code
  function getCoursesForId(courseId: string): Course[] {
    return courseStore.getByCode(courseId);
  }

  // Sort favourites (by courseId, not by instances)
  $: sortedFavourites = [...$favouritesStore.favourites].sort((a, b) => {
    switch (sortBy) {
      case 'courseId':
        return a.courseId.localeCompare(b.courseId) * sortDirection;
      case 'courseName': {
        // Get first course's name for sorting
        const coursesA = getCoursesForId(a.courseId);
        const coursesB = getCoursesForId(b.courseId);
        const nameA = coursesA[0]?.name.en || a.courseId;
        const nameB = coursesB[0]?.name.en || b.courseId;
        return nameA.localeCompare(nameB) * sortDirection;
      }
      case 'credits': {
        const coursesA = getCoursesForId(a.courseId);
        const coursesB = getCoursesForId(b.courseId);
        const creditsA = coursesA[0]?.credits.min || 0;
        const creditsB = coursesB[0]?.credits.min || 0;
        return (creditsA - creditsB) * sortDirection;
      }
      case 'startDate': {
        const coursesA = getCoursesForId(a.courseId);
        const coursesB = getCoursesForId(b.courseId);
        const dateA = coursesA[0]?.courseDate.start || new Date(0);
        const dateB = coursesB[0]?.courseDate.start || new Date(0);
        return (new Date(dateA).getTime() - new Date(dateB).getTime()) * sortDirection;
      }
      case 'addedAt':
      default:
        return (new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()) * sortDirection;
    }
  });

  function handleSort(column: string) {
    sortBy = column;
  }

  function startEditingNotes(courseId: string, notes: string | null) {
    editingCourseId = courseId;
    editingNotes = notes || '';
  }

  function cancelEditingNotes() {
    editingCourseId = null;
    editingNotes = '';
  }

  async function saveNotes(courseId: string) {
    try {
      await favouritesStore.updateNotes(courseId, editingNotes || null);
      editingCourseId = null;
      editingNotes = '';
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  }

  async function removeFavourite(courseId: string) {
    if (!confirm(`Remove "${courseId}" from favourites?`)) {
      return;
    }

    try {
      await favouritesStore.remove(courseId);
    } catch (err) {
      console.error('Failed to remove favourite:', err);
    }
  }

  function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }

  function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ` at ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  // Study groups interface
  interface StudyGroup {
    group_id: string;
    name: string;
    type: string;
    study_events: Array<{ start: string; end: string }>;
  }

  // Fetch study groups for a course
  async function fetchStudyGroups(course: Course): Promise<StudyGroup[]> {
    try {
      const url = new URL('https://sisu-wrapper-api-test.sisukas.eu/study-groups');
      url.searchParams.append('course_unit_id', course.unitId);
      url.searchParams.append('course_offering_id', course.id);

      const response = await fetch(url.toString());
      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching study groups:', error);
      return [];
    }
  }

  // Aggregate study events into recurring patterns
  function aggregateStudyEvents(events: Array<{ start: string; end: string }>): string {
    if (events.length === 0) return 'No scheduled events';
    
    const timeSlotMap = new Map<string, Set<string>>();
    
    events.forEach(event => {
      const startDate = new Date(event.start);
      const endDate = new Date(event.end);
      
      const startTime = startDate.toLocaleTimeString('en-FI', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      
      const endTime = endDate.toLocaleTimeString('en-FI', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      
      const dayOfWeek = startDate.toLocaleDateString('en-US', { weekday: 'short' });
      const timeSlot = `${startTime} - ${endTime}`;
      
      if (!timeSlotMap.has(timeSlot)) {
        timeSlotMap.set(timeSlot, new Set());
      }
      timeSlotMap.get(timeSlot)!.add(dayOfWeek);
    });
    
    const patterns: string[] = [];
    timeSlotMap.forEach((days, timeSlot) => {
      const daysList = Array.from(days).join(' + ');
      patterns.push(`${daysList} ${timeSlot}`);
    });
    
    return patterns.length === 1 ? patterns[0] : patterns.join(' | ');
  }
</script>

<div class="favourites-container">
  {#if !isSignedIn}
    <!-- Not signed in state -->
    <div class="state-card">
      <div class="icon-circle">👤</div>
      <h2>Sign in to save favourites</h2>
      <p>Create an account to keep track of your courses across devices.</p>
    </div>

  {:else if $favouritesStore.loading}
    <!-- Loading state -->
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Fetching your collection...</p>
    </div>

  {:else if $favouritesStore.error}
    <!-- Error state -->
    <div class="state-card error">
      <h2>Something went wrong</h2>
      <p>{$favouritesStore.error}</p>
      <button on:click={() => favouritesStore.load()} class="btn btn-secondary">Try Again</button>
    </div>

  {:else if $favouritesStore.favourites.length === 0}
    <!-- Empty state -->
    <div class="state-card">
      <div class="icon-circle">♥</div>
      <h2>Your list is empty</h2>
      <p>Start exploring courses and click the heart icon to add them here.</p>
      <a href="/" class="btn btn-primary">Browse Courses</a>
    </div>

  {:else}
    <!-- Main content -->
    <div class="header-section">
      <div class="title-group">
        <h1>Your Favourites</h1>
      </div>
      
      <div class="controls">
        <button 
          class="expand-all-btn"
          on:click={() => expandAllStudyGroups = !expandAllStudyGroups}
          title={expandAllStudyGroups ? 'Collapse all study groups' : 'Expand all study groups'}
        >
          <i class="bi {expandAllStudyGroups ? 'bi-chevron-up' : 'bi-chevron-down'}"></i>
          <span>{expandAllStudyGroups ? 'Collapse' : 'Expand'} Study Groups</span>
        </button>

        <div class="sort-box">
          <label for="sort">Sort by:</label>
          <select id="sort" bind:value={sortBy} on:change={() => handleSort(sortBy)}>
            <option value="addedAt">Recently Added</option>
            <option value="courseId">Course Code</option>
            <option value="courseName">Course Name</option>
            <option value="credits">Credits</option>
            <option value="startDate">Start Date</option>
          </select>
          <button class="sort-dir" on:click={() => { sortDirection *= -1; }}>
            {sortDirection === 1 ? '↑' : '↓'}
          </button>
        </div>
      </div>
    </div>

    <!-- Favourites list -->
    <div class="favourites-list">
      {#each sortedFavourites as favourite (favourite.courseId)}
        {@const courses = getCoursesForId(favourite.courseId)}
        <div class="favourite-item">
          <!-- Item header with course code, name, and remove button -->
          <div class="item-header">
            <div class="code-and-info">
              <a 
                href="https://sisu.aalto.fi/student/courseunit/{courses[0]?.unitId}/brochure" 
                target="_blank"
                class="course-code-link"
              >
                <h3 class="course-code">{favourite.courseId}</h3>
              </a>
              {#if courses.length > 0}
                <p class="course-name">{courses[0].name.en}</p>
              {/if}
              <div class="instance-count">
                {#if courses.length > 1}
                  <span class="badge-secondary">{courses.length} instances</span>
                {/if}
              </div>
            </div>
            <button 
              class="favourite-btn" 
              on:click={() => removeFavourite(favourite.courseId)}
              aria-label="Remove from favourites"
              title="Remove from favourites"
            >
              ♥
            </button>
          </div>

          <!-- Course instances -->
          <div class="instances-container">
            {#each courses as course (course.id)}
              <div class="instance">
                <div class="instance-top">
                  <div class="instance-dates">
                    <span class="date-range">
                      {formatDate(course.courseDate.start)}
                      –
                      {formatDate(course.courseDate.end)}
                    </span>
                  </div>
                  <div class="format-badge" data-format={course.format}>
                    {course.format}
                  </div>
                </div>

                <div class="instance-meta">
                  <span class="meta-item">
                    <span class="label">Credits:</span>
                    <span class="value">{course.credits.min}</span>
                  </span>
                  {#if course.teachers.length > 0}
                    <span class="meta-item">
                      <span class="label">Teacher:</span>
                      <span class="value">{course.teachers[0]}</span>
                    </span>
                  {/if}
                </div>

                <!-- Study Groups (lazy loaded) -->
                <StudyGroupsSection {course} expandAll={expandAllStudyGroups} />
              </div>
            {/each}
          </div>

          <!-- Added date -->
          <div class="metadata">
            <span class="added-date">Added {formatDateTime(favourite.addedAt)}</span>
          </div>

          <!-- Notes section -->
          <div class="notes-section">
            {#if editingCourseId === favourite.courseId}
              <!-- Editing mode -->
              <div class="editor">
                <textarea 
                  bind:value={editingNotes} 
                  placeholder="Add your notes here..."
                  aria-label="Edit notes"
                ></textarea>
                <div class="editor-actions">
                  <button 
                    on:click={() => saveNotes(favourite.courseId)} 
                    class="btn-text save"
                  >
                    Save
                  </button>
                  <button 
                    on:click={cancelEditingNotes} 
                    class="btn-text cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            {:else}
              <!-- Display mode -->
              <div class="display">
                <p class:placeholder={!favourite.notes}>
                  {favourite.notes || 'No private notes added yet...'}
                </p>
                {#if favourite.notes}
                  <button 
                    class="edit-trigger" 
                    on:click={() => startEditingNotes(favourite.courseId, favourite.notes)}
                  >
                    Edit note
                  </button>
                {:else}
                  <button 
                    class="edit-trigger" 
                    on:click={() => startEditingNotes(favourite.courseId, null)}
                  >
                    + Add note
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  :root {
    --primary: #4a90e2;
    --primary-hover: #2980f1;
    --bg: #f8fafc;
    --card-bg: #ffffff;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --danger: #ef4444;
    --border: #e2e8f0;
  }

  .favourites-container {
    max-width: 1400px;
    margin: 1.5rem auto;
    padding: 0 1rem;
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--text-main);
  }

  /* ========== Header & Controls ========== */
  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  h1 {
    font-size: 1.3rem;
    font-weight: 600;
    margin: 0;
    margin-left: 10px;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--primary);
  }

  p {
    margin: 0;
  }

  .badge-secondary {
    background: #f0f0f0;
    color: var(--text-muted);
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
    font-size: 0.9rem;
    flex-wrap: wrap;
  }

  .controls label {
    white-space: nowrap;
  }

  .expand-all-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.7rem;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    color: #000000;
    transition: all 0.2s;
  }

  .expand-all-btn:hover {
    background: #eeeeee;
  }

  .expand-all-btn:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .expand-all-btn i {
    font-size: 1.1rem;
  }

  select {
    margin: 0;
    padding: 0.4rem 0.8rem 0.4rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    cursor: pointer;
    appearance: none;
  }

  select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .sort-dir {
    width: 36px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    cursor: pointer;
    transition: all 0.2s;
  }

  .sort-dir:hover {
    background: #f1f5f9;
  }

  .sort-dir:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  /* ========== Favourites Grid ========== */
  .favourites-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
  }

  .favourite-item {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .favourite-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  /* ========== Item Header ========== */
  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
    gap: 1rem;
  }

  .code-and-info {
    flex: 1;
  }

  .course-code {
    color: var(--primary);
  }

  .course-code-link {
    text-decoration: none;
    transition: opacity 0.2s;
  }

  .course-code-link:hover {
    opacity: 0.8;
  }

  .course-code-link:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .course-name {
    font-size: 0.85rem;
    color: #333;
    line-height: 1.2;
    margin-top: 0.1rem;
  }

  .instance-count {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .favourite-btn {
    background: transparent;
    border: none;
    color: var(--primary);
    cursor: pointer;
    font-size: 1.5rem;
    transition: color 0.2s, transform 0.2s;
    padding: 0;
    flex-shrink: 0;
  }

  .favourite-btn:hover {
    color: var(--danger);
    transform: scale(1.1);
  }

  .favourite-btn:focus {
    outline: 2px solid var(--danger);
    outline-offset: 2px;
  }

  /* ========== Instances Container ========== */
  .instances-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .instance {
    background: #f9fafb;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #f0f0f0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .instance-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .instance-dates {
    flex: 1;
    min-width: 0;
  }

  .date-range {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--primary);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .format-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .format-badge[data-format="lecture"] {
    background: #dbeafe;
    color: #1e40af;
  }

  .format-badge[data-format="exam"] {
    background: #fee2e2;
    color: #991b1b;
  }

  .format-badge[data-format="thesis"] {
    background: #fce7f3;
    color: #9f1239;
  }

  .format-badge[data-format="other"] {
    background: #f3f4f6;
    color: #374151;
  }

  .instance-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.75rem;
  }

  .instance-meta .meta-item {
    display: flex;
    gap: 0.25rem;
  }

  .instance-meta .label {
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .instance-meta .value {
    color: var(--text-main);
    font-weight: 500;
  }

  /* ========== Added Date ========== */
  .metadata {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .added-date {
    font-style: italic;
  }

  /* ========== Notes Section ========== */
  .notes-section {
    background: #f1f5f9;
    padding: 0.75rem;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }

  .notes-section p {
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--text-main);
    min-height: 2em;
    margin-bottom: 0.4rem;
  }

  .notes-section p.placeholder {
    color: var(--text-muted);
    font-style: italic;
  }

  .display {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .edit-trigger {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    text-decoration: none;
    align-self: flex-start;
    transition: text-decoration 0.2s;
  }

  .edit-trigger:hover {
    text-decoration: underline;
  }

  .edit-trigger:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-grow: 1;
  }

  textarea {
    min-height: 60px;
    padding: 0.4rem;
    border: 1px solid var(--border);
    border-radius: 3px;
    font-family: inherit;
    font-size: 0.85rem;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 5px rgba(79, 70, 229, 0.3);
  }

  .editor-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-text {
    padding: 0.4rem 0.8rem;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.8rem;
    transition: all 0.2s;
    flex: 1;
  }

  .btn-text.save {
    background: var(--primary);
    color: white;
  }

  .btn-text.save:hover {
    background: var(--primary-hover);
  }

  .btn-text.save:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .btn-text.cancel {
    background: #f0f0f0;
    color: #333;
  }

  .btn-text.cancel:hover {
    background: #e0e0e0;
  }

  .btn-text.cancel:focus {
    outline: 2px solid #999;
    outline-offset: 2px;
  }

  /* ========== States ========== */
  .state-card {
    text-align: center;
    padding: 5rem 2rem;
    background: var(--card-bg);
    border-radius: 16px;
    border: 2px dashed var(--border);
  }

  .icon-circle {
    width: 64px;
    height: 64px;
    background: #f1f5f9;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    margin: 0 auto 1.5rem;
  }

  .btn {
    display: inline-block;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s;
    text-decoration: none;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
    border: none;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
  }

  .btn-primary:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .btn-secondary {
    background: #f0f0f0;
    color: #333;
    border: none;
  }

  .btn-secondary:hover {
    background: #e0e0e0;
  }

  .btn-secondary:focus {
    outline: 2px solid #999;
    outline-offset: 2px;
  }

  /* ========== Spinner ========== */
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    text-align: center;
  }

  .error {
    background: #fee;
    border-color: #fcc;
  }

  .error h2 {
    color: var(--danger);
  }

  /* ========== Responsive ========== */
  @media (max-width: 1024px) {
    .favourites-list {
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    }
  }

  @media (max-width: 620px) {
    .header-section {
      flex-direction: column;
      align-items: flex-start;
    }

    .controls {
      width: 100%;
    }

    select {
      flex: 1;
    }

    .favourites-list {
      grid-template-columns: 1fr;
    }
  }
</style>