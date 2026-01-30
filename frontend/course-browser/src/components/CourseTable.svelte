<!-- src/components/CourseTable.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { useSession } from '../lib/authClient';
  import { favouritesStore } from '../lib/stores/favouritesStore';
  import { courseIndexStore } from '../lib/stores/courseIndexStore.svelte';
  import type { Course } from '../domain/models/Course';
  import MissingCourseSubmit from './MissingCourseSubmit.svelte';
  import { assertCourseCodeIsMissingEverywhere } from '../domain/services/CourseCodeGuard';
  import { NotificationService } from '../infrastructure/services/NotificationService';
  import { CourseSnapshotsService } from '../infrastructure/services/CourseSnapshotsService';

  // -----------------------------
  // Props (runes mode)
  // -----------------------------
  const props = $props<{
    filteredInstanceIds?: string[] | null;
    source?: 'active' | 'all';
  }>();

  const filteredInstanceIds = $derived.by(() => props.filteredInstanceIds ?? null);
  const source = $derived.by(() => props.source ?? 'active');

  // -----------------------------
  // Local state (runes)
  // -----------------------------
  const ui = $state({
    sortColumn: 'courseName',
    sortDirection: 1 as 1 | -1,

    windowWidth: 0,
    showMissingCourseModal: false,

    currentPage: 1,
    pageSize: 50,

    lastResetKey: null as string | null,
  });

  // -----------------------------
  // Session / auth derived
  // -----------------------------
  const session = useSession();
  const user = $derived.by(() => $session.data?.user);
  const isSignedIn = $derived.by(() => !!user);

  const isNarrowScreen = $derived.by(() => ui.windowWidth < 380);

  // -----------------------------
  // Favourites: support BOTH patterns
  //   A) runes store: favouritesStore.state
  //   B) legacy writable: favouritesStore.subscribe / $favouritesStore (not allowed here)
  // -----------------------------
  const fav = $state<{ favourites: { courseId: string }[] }>({ favourites: [] });

  onMount(() => {
    // If favouritesStore is a runes store, it will likely have .state
    // (In that case you can remove this subscription and just use favouritesStore.state directly.)
    if ('subscribe' in favouritesStore) {
      const unsub = favouritesStore.subscribe(v => {
        // expect { favourites: [...] }
        fav.favourites = v?.favourites ?? [];
      });
      return unsub;
    }
  });

  const favouriteSet = $derived.by(() => {
    const set = new Set<string>();
    for (const f of fav.favourites) set.add(f.courseId);
    return set;
  });

  // -----------------------------
  // Data resolution (use current index view)
  // -----------------------------
  function resolveIds(ids: string[]): Course[] {
    const out: Course[] = [];
    for (const id of ids) {
      const c = courseIndexStore.read.resolveCurrentByInstanceId(id);
      if (c) out.push(c);
    }
    return out;
  }

  const tableCourses = $derived.by(() => {
    if (filteredInstanceIds && filteredInstanceIds.length > 0) {
      return resolveIds(filteredInstanceIds);
    }
    return courseIndexStore.read.getAllCurrentCourses();
  });

  // -----------------------------
  // Sorting / paging derived
  // -----------------------------
  const sortedCourses = $derived.by(() =>
    sortCourses(tableCourses, ui.sortColumn, ui.sortDirection)
  );

  const totalPages = $derived.by(() =>
    Math.max(1, Math.ceil(sortedCourses.length / ui.pageSize))
  );

  const paginatedCourses = $derived.by(() =>
    sortedCourses.slice(
      (ui.currentPage - 1) * ui.pageSize,
      ui.currentPage * ui.pageSize
    )
  );

  // Reset page on relevant changes
  function filterKey(ids: string[] | null): string {
    return ids ? ids.join('|') : 'all';
  }

  $effect(() => {
    const key = [
      courseIndexStore.state.mode,
      source,
      filterKey(filteredInstanceIds),
      ui.sortColumn,
      ui.sortDirection,
    ].join('|');

    if (ui.lastResetKey && key !== ui.lastResetKey) {
      ui.currentPage = 1;
    }
    ui.lastResetKey = key;
  });

  // Clamp page when data changes
  $effect(() => {
    if (ui.currentPage > totalPages) ui.currentPage = totalPages;
    if (ui.currentPage < 1) ui.currentPage = 1;
  });

  // Load / clear favourites based on auth
  $effect(() => {
    if (isSignedIn) {
      void favouritesStore.load?.();
    } else {
      favouritesStore.clear?.();
      fav.favourites = [];
    }
  });

  // -----------------------------
  // Actions
  // -----------------------------
  async function toggleFavourite(courseId: string) {
    if (!isSignedIn) return;

    try {
      if (favouriteSet.has(courseId)) {
        await favouritesStore.remove(courseId);
      } else {
        await favouritesStore.add(courseId);
      }
    } catch (error) {
      console.error('Failed to toggle favourite:', error);
    }
  }

  function handleSort(column: string) {
    if (ui.sortColumn === column) {
      ui.sortDirection = (ui.sortDirection * -1) as 1 | -1;
    } else {
      ui.sortColumn = column;
      ui.sortDirection = 1;
    }
    ui.currentPage = 1;
  }

  function sortCourses(coursesToSort: Course[], column: string, direction: 1 | -1): Course[] {
    return [...coursesToSort].sort((a, b) => {
      const valueA = getSortableValue(a, column);
      const valueB = getSortableValue(b, column);

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return valueA.localeCompare(valueB) * direction;
      } else if (valueA instanceof Date && valueB instanceof Date) {
        return (valueA.getTime() - valueB.getTime()) * direction;
      } else {
        const numA = typeof valueA === 'number' ? valueA : 0;
        const numB = typeof valueB === 'number' ? valueB : 0;
        return (numA - numB) * direction;
      }
    });
  }

  function getSortableValue(course: Course, column: string): string | number | Date {
    switch (column) {
      case 'courseCode':
        return course.code.value.toLowerCase();
      case 'courseName':
        return course.name.en.toLowerCase();
      case 'teachers':
        return course.teachers.join(', ').toLowerCase();
      case 'credits':
        return course.credits.min;
      case 'language':
        return course.languages.join(', ').toLowerCase();
      case 'startDate':
        return new Date(course.courseDate.start);
      case 'endDate':
        return new Date(course.courseDate.end);
      case 'enrollFrom':
        return new Date(course.enrollmentDate.start);
      case 'enrollTo':
        return new Date(course.enrollmentDate.end);
      case 'prerequisites':
        return course.prerequisites?.raw.en || '';
      default:
        return '';
    }
  }

  function formatPrerequisites(course: Course): string {
    if (!course.prerequisites) return 'None';

    if (course.prerequisites.hasTextOnly) {
      const text = course.prerequisites.raw.en;
      if (text.length === 0) return 'None';
      return text.length > 100 ? text.substring(0, 97) + '...' : text;
    }

    return course.prerequisites.codePatterns.join(', ');
  }

  function formatDate(date: Date, withYear: boolean = false): string {
    if (withYear) {
      return date.toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }
    return date.toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit' });
  }

  function formatTeacher(teacher: string, narrow: boolean): string {
    if (!narrow) return teacher;

    const parts = teacher.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];

    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0];
    return `${firstName} ${lastInitial}.`;
  }

  function goToPage(page: number) {
    ui.currentPage = Math.max(1, Math.min(page, totalPages));
  }

  function nextPage() {
    if (ui.currentPage < totalPages) {
      ui.currentPage++;
      document.querySelector('.desktop-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function prevPage() {
    if (ui.currentPage > 1) {
      ui.currentPage--;
      document.querySelector('.desktop-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  export async function resolveMissingCourseCode(courseCode: string) {
    const g = assertCourseCodeIsMissingEverywhere(courseCode);
    if (!g.ok) {
      NotificationService.error(g.message);
      return null;
    }
    return CourseSnapshotsService.resolveAndStore(g.code);
  }

  function openMissingCourseModal() {
    ui.showMissingCourseModal = true;
  }

  function closeMissingCourseModal() {
    ui.showMissingCourseModal = false;
  }

  function onMissingCourseKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeMissingCourseModal();
  }
</script>

<svelte:window bind:innerWidth={ui.windowWidth} />

<div class="table-header">
  <div id="course-count">Total courses: {sortedCourses.length}</div>

  <div class="pagination-info">
    {#if totalPages > 1}
      <span>Page {ui.currentPage} of {totalPages}</span>
    {/if}
  </div>

  <a
    href="#missing-course"
    class="missing-course-link"
    onclick={openMissingCourseModal}
  >
    couldn't find your course?
  </a>
</div>

{#if ui.showMissingCourseModal}
  <div class="mc-backdrop" role="presentation" onkeydown={onMissingCourseKeydown}>
    <button
      type="button"
      class="mc-overlay-close"
      aria-label="Close"
      onclick={closeMissingCourseModal}
    ></button>

    <div class="mc-modal" role="dialog" aria-modal="true" aria-label="Add missing course">
      <div class="mc-header">
        <div class="mc-title">Add missing course</div>
        <button type="button" class="mc-close" aria-label="Close" onclick={closeMissingCourseModal}>
          ✕
        </button>
      </div>

      <div class="mc-body">
        <MissingCourseSubmit {resolveMissingCourseCode} />
      </div>
    </div>
  </div>
{/if}

<!-- Desktop Table View -->
<div class="desktop-table-wrapper">
  <table class="desktop-table">
    <thead>
      <tr>
        {#if isSignedIn}
          <th class="favourite-col" style="width: 3%;"></th>
        {/if}

        <th
          class:sort-asc={ui.sortColumn === 'courseCode' && ui.sortDirection === 1}
          class:sort-desc={ui.sortColumn === 'courseCode' && ui.sortDirection === -1}
          onclick={() => handleSort('courseCode')}
        >
          <span class="full-text">Course Code</span>
          <span class="abbreviated-text">code</span>
        </th>

        <th
          class:sort-asc={ui.sortColumn === 'courseName' && ui.sortDirection === 1}
          class:sort-desc={ui.sortColumn === 'courseName' && ui.sortDirection === -1}
          onclick={() => handleSort('courseName')}
        >
          <span class="full-text">Course Name</span>
          <span class="abbreviated-text">name</span>
        </th>

        <th
          class:sort-asc={ui.sortColumn === 'teachers' && ui.sortDirection === 1}
          class:sort-desc={ui.sortColumn === 'teachers' && ui.sortDirection === -1}
          onclick={() => handleSort('teachers')}
        >
          <span class="full-text">Teacher(s)</span>
          <span class="abbreviated-text">teachr</span>
        </th>

        <th
          class:sort-asc={ui.sortColumn === 'credits' && ui.sortDirection === 1}
          class:sort-desc={ui.sortColumn === 'credits' && ui.sortDirection === -1}
          onclick={() => handleSort('credits')}
        >
          <span class="full-text">Credits</span>
          <span class="abbreviated-text">cr</span>
        </th>

        <th
          class:sort-asc={ui.sortColumn === 'language' && ui.sortDirection === 1}
          class:sort-desc={ui.sortColumn === 'language' && ui.sortDirection === -1}
          onclick={() => handleSort('language')}
        >
          <span class="full-text">Language</span>
          <span class="abbreviated-text">lang</span>
        </th>

        <th
          class:sort-asc={ui.sortColumn === 'startDate' && ui.sortDirection === 1}
          class:sort-desc={ui.sortColumn === 'startDate' && ui.sortDirection === -1}
          onclick={() => handleSort('startDate')}
        >
          <span class="full-text">Start Date</span>
          <span class="abbreviated-text">start</span>
        </th>

        <th
          class:sort-asc={ui.sortColumn === 'endDate' && ui.sortDirection === 1}
          class:sort-desc={ui.sortColumn === 'endDate' && ui.sortDirection === -1}
          onclick={() => handleSort('endDate')}
        >
          <span class="full-text">End Date</span>
          <span class="abbreviated-text">end</span>
        </th>

        <th
          class:sort-asc={ui.sortColumn === 'enrollFrom' && ui.sortDirection === 1}
          class:sort-desc={ui.sortColumn === 'enrollFrom' && ui.sortDirection === -1}
          onclick={() => handleSort('enrollFrom')}
        >
          <span class="full-text">Enroll From</span>
          <span class="abbreviated-text">frm</span>
        </th>

        <th
          class:sort-asc={ui.sortColumn === 'enrollTo' && ui.sortDirection === 1}
          class:sort-desc={ui.sortColumn === 'enrollTo' && ui.sortDirection === -1}
          onclick={() => handleSort('enrollTo')}
        >
          <span class="full-text">Enroll To</span>
          <span class="abbreviated-text">to</span>
        </th>

        <th
          class:sort-asc={ui.sortColumn === 'prerequisites' && ui.sortDirection === 1}
          class:sort-desc={ui.sortColumn === 'prerequisites' && ui.sortDirection === -1}
          onclick={() => handleSort('prerequisites')}
        >
          <span class="full-text">Prerequisites</span>
          <span class="abbreviated-text">preq</span>
        </th>
      </tr>
    </thead>

    <tbody>
      {#each paginatedCourses as course (course.id)}
        <tr>
          {#if isSignedIn}
            <td class="favourite-col">
              <button
                class="favourite-btn"
                class:favourited={favouriteSet.has(course.code.value)}
                onclick={() => toggleFavourite(course.code.value)}
                title={favouriteSet.has(course.code.value) ? 'Remove from favourites' : 'Add to favourites'}
              >
                {favouriteSet.has(course.code.value) ? '♥' : '♡'}
              </button>
            </td>
          {/if}

          <td>{course.code.value}</td>
          <td>
            <a href="https://sisu.aalto.fi/student/courseunit/{course.unitId}/brochure" target="_blank" rel="noreferrer">
              {course.name.en}
            </a>
          </td>
          <td>{course.teachers.join(', ')}</td>
          <td>{course.credits.min}</td>
          <td>{course.languages.join(', ')}</td>
          <td>{formatDate(course.courseDate.start, true)}</td>
          <td>{formatDate(course.courseDate.end, true)}</td>
          <td>{formatDate(course.enrollmentDate.start, true)}</td>
          <td>{formatDate(course.enrollmentDate.end, true)}</td>
          <td class="prerequisites-cell">{formatPrerequisites(course)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<!-- Desktop Pagination Controls -->
{#if totalPages > 1}
  <div class="pagination-controls">
    <button class="pagination-btn" onclick={prevPage} disabled={ui.currentPage === 1}>
      ← Previous
    </button>

    <div class="page-numbers">
      {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        let page;
        if (totalPages <= 5) page = i + 1;
        else if (ui.currentPage <= 3) page = i + 1;
        else if (ui.currentPage >= totalPages - 2) page = totalPages - 4 + i;
        else page = ui.currentPage - 2 + i;
        return page;
      }) as page (page)}
        <button class="page-btn" class:active={page === ui.currentPage} onclick={() => goToPage(page)}>
          {page}
        </button>
      {/each}

      {#if totalPages > 5 && ui.currentPage < totalPages - 2}
        <span class="page-ellipsis">...</span>
      {/if}
    </div>

    <button class="pagination-btn" onclick={nextPage} disabled={ui.currentPage === totalPages}>
      Next →
    </button>
  </div>
{/if}

<!-- Mobile Card View -->
<div class="mobile-cards">
  <div class="mobile-sort-controls">
    <label for="mobile-sort">Sort by:</label>
    <select
      id="mobile-sort"
      class="mobile-sort-select"
      bind:value={ui.sortColumn}
      onchange={() => {
        ui.sortDirection = 1;
        ui.currentPage = 1;
      }}
    >
      <option value="courseName">Course Name</option>
      <option value="courseCode">Course Code</option>
      <option value="teachers">Teacher</option>
      <option value="credits">Credits</option>
      <option value="language">Language</option>
      <option value="startDate">Start Date</option>
      <option value="endDate">End Date</option>
      <option value="enrollFrom">Enroll From</option>
      <option value="enrollTo">Enroll To</option>
    </select>

    <button
      class="sort-direction-btn"
      onclick={() => {
        ui.sortDirection = (ui.sortDirection * -1) as 1 | -1;
        ui.currentPage = 1;
      }}
      aria-label="Toggle sort direction"
    >
      {ui.sortDirection === 1 ? '↑' : '↓'}
    </button>
  </div>

  {#each paginatedCourses as course (course.id)}
    <div class="course-card">
      <div class="card-header">
        {#if isSignedIn}
          <button
            class="favourite-btn-mobile"
            class:favourited={favouriteSet.has(course.code.value)}
            onclick={() => toggleFavourite(course.code.value)}
            title={favouriteSet.has(course.code.value) ? 'Remove from favourites' : 'Add to favourites'}
            aria-label={favouriteSet.has(course.code.value)
              ? `Remove ${course.name.en} from favourites`
              : `Add ${course.name.en} to favourites`}
          >
            {favouriteSet.has(course.code.value) ? '♥' : '♡'}
          </button>
        {/if}

        <span class="card-code">{course.code.value}</span>
        <span class="card-period">
          {formatDate(course.courseDate.start)} – {formatDate(course.courseDate.end)}
        </span>
      </div>

      <a
        href="https://sisu.aalto.fi/student/courseunit/{course.unitId}/brochure"
        target="_blank"
        rel="noreferrer"
        class="card-title"
      >
        {course.name.en}
      </a>

      <div class="card-details">
        <span class="detail-item">{formatTeacher(course.teachers[0] || 'TBA', isNarrowScreen)}</span>
        <span class="detail-separator">•</span>
        <span class="detail-item">{course.languages.join(', ')}</span>
        <span class="detail-separator">•</span>
        <span class="detail-item">{course.credits.min}cr</span>
        <span class="detail-label">Enroll:</span>
        <span class="detail-value">
          {formatDate(course.enrollmentDate.start)} – {formatDate(course.enrollmentDate.end)}
        </span>
      </div>
    </div>
  {/each}

  {#if totalPages > 1}
    <div class="mobile-pagination">
      <button class="mobile-pagination-btn" onclick={prevPage} disabled={ui.currentPage === 1}>
        ← Previous
      </button>
      <span class="mobile-page-info">Page {ui.currentPage} of {totalPages}</span>
      <button class="mobile-pagination-btn" onclick={nextPage} disabled={ui.currentPage === totalPages}>
        Next →
      </button>
    </div>
  {/if}
</div>

<style>
  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
    padding-left: 1rem;
    padding-right: 1rem;
  }
  
  /* Desktop Table Styles */
  .desktop-table-wrapper {
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  .desktop-table {
    width: 96%;
    margin: auto;
    border-collapse: collapse;
    table-layout: fixed;
  }
  
  .mobile-cards {
    display: none;
  }
  
  th, td {
    border: 1px solid #ddd;
    text-align: center;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: normal;
    padding: 6px 1px;
  }
  
  th {
    background-color: #f2f2f2;
    cursor: pointer;
    position: relative;
    user-select: none;
  }
  
  th:hover {
    background-color: #eee;
  }

  th.favourite-col {
    cursor: default;
    width: 3%;
  }
  
  th.sort-asc::after {
    font-size: 0.7em;
    content: " ↑";
    position: absolute;
    top: 2px;
    right: 2px;
  }
  
  th.sort-desc::after {
    font-size: 0.7em;
    content: " ↓";
    position: absolute;
    top: 2px;
    right: 2px;
  }
  
  tr:hover td {
    background-color: #f1f1f1;
  }
  
  /* Column Widths */
  th:nth-child(1), td:nth-child(1) { width: 11%; }
  th:nth-child(2), td:nth-child(2) { width: 20%; }
  th:nth-child(3), td:nth-child(3) { width: 13%; }
  th:nth-child(4), td:nth-child(4) { width: 7%; }
  th:nth-child(5), td:nth-child(5) { width: 9%; }
  th:nth-child(6), td:nth-child(6) { width: 10%; }
  th:nth-child(7), td:nth-child(7) { width: 10%; }
  th:nth-child(8), td:nth-child(8) { width: 10%; }
  th:nth-child(9), td:nth-child(9) { width: 10%; }
  th:nth-child(10), td:nth-child(10) { width: 25%; }

  /* Adjust widths if Favourites is present (Signed in) */
  .desktop-table:has(.favourite-col) th:nth-child(2),
  .desktop-table:has(.favourite-col) td:nth-child(2) { width: 11%; }
  .desktop-table:has(.favourite-col) th:nth-child(3),
  .desktop-table:has(.favourite-col) td:nth-child(3) { width: 20%; }
  .desktop-table:has(.favourite-col) th:nth-child(4),
  .desktop-table:has(.favourite-col) td:nth-child(4) { width: 13%; }
  .desktop-table:has(.favourite-col) th:nth-child(5),
  .desktop-table:has(.favourite-col) td:nth-child(5) { width: 7%; }
  .desktop-table:has(.favourite-col) th:nth-child(6),
  .desktop-table:has(.favourite-col) td:nth-child(6) { width: 9%; }
  .desktop-table:has(.favourite-col) th:nth-child(7),
  .desktop-table:has(.favourite-col) td:nth-child(7) { width: 10%; }
  .desktop-table:has(.favourite-col) th:nth-child(8),
  .desktop-table:has(.favourite-col) td:nth-child(8) { width: 10%; }
  .desktop-table:has(.favourite-col) th:nth-child(9),
  .desktop-table:has(.favourite-col) td:nth-child(9) { width: 10%; }
  .desktop-table:has(.favourite-col) th:nth-child(10),
  .desktop-table:has(.favourite-col) td:nth-child(10) { width: 10%; }
  .desktop-table:has(.favourite-col) th:nth-child(11),
  .desktop-table:has(.favourite-col) td:nth-child(11) { width: 25%; }
  
  .favourite-btn,
  .favourite-btn-mobile {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 1.1rem;
    line-height: 1;
  }

  .favourite-col {
    width: 35px;
    padding: 0;
    border: 0;
    padding-right: 4px;
  }
  
  .favourite-btn {
    width: 100%;
    height: 100%;
    border: none;
    background: none;
    cursor: pointer;
    color: #d9534f;
    padding: 6px 0;
    transition: transform 0.2s, color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .favourite-btn:hover {
    transform: scale(1.3);
    color: #c9302c;
  }
  
  .favourite-btn.favourited {
    color: #d9534f;
  }
  
  .favourite-btn:focus {
    outline: 2px solid #d9534f;
    outline-offset: -2px;
  }

  .prerequisites-cell {
    text-align: left;
    padding-left: 3px;
  }
  
  a {
    color: #4a90e2;
    text-decoration: none;
    transition: color 0.3s, transform 0.2s;
  }
  
  a:visited {
    color: #6f42c1;
  }
  
  a:hover {
    color: #d9534f;
  }
  
  a:active {
    color: #b32d35;
  }
  
  a:focus {
    outline: 2px solid #4a90e2;
    outline-offset: 2px;
  }
  
  .abbreviated-text {
    display: none;
  }
  
  .full-text {
    display: inline;
  }

  /* Pagination Controls */
  .pagination-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin: 1.5rem 0;
    flex-wrap: wrap;
  }

  .pagination-btn {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    color: #333;
    transition: all 0.2s;
  }

  .pagination-btn:hover:not(:disabled) {
    background: #4a90e2;
    color: white;
    border-color: #4a90e2;
  }

  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-numbers {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .page-btn {
    padding: 0.4rem 0.6rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    color: #666;
    transition: all 0.2s;
    min-width: 32px;
  }

  .page-btn:hover {
    background: #f0f0f0;
    border-color: #999;
  }

  .page-btn.active {
    background: #4a90e2;
    color: white;
    border-color: #4a90e2;
    font-weight: 600;
  }

  .page-ellipsis {
    padding: 0 0.25rem;
    color: #999;
  }
  
  /* Mobile Card Styles */
  .course-card {
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.3rem;
  }
  
  .card-code {
    font-size: 0.85rem;
    font-weight: 600;
    margin-right: auto;
    color: #333;
  }
  
  .card-period {
    background: #4a90e2;
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .favourite-btn-mobile {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.9rem;
    color: #d9534f;
    padding: 0;
    margin: 0;
    margin-right: 5px;
    transition: transform 0.2s, color 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .favourite-btn-mobile:hover {
    transform: scale(1.3);
    color: #c9302c;
  }

  .favourite-btn-mobile.favourited {
    color: #d9534f;
  }

  .favourite-btn-mobile:focus {
    outline: 2px solid #d9534f;
    outline-offset: -1px;
  }
  
  .card-title {
    display: block;
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.3;
    margin-bottom: 0.3rem;
    color: #4a90e2;
    text-decoration: none;
  }
  
  .card-details {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #666;
  }
  
  .detail-item {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .detail-separator {
    color: #ccc;
  }
  
  .detail-label {
    font-weight: 600;
    color: #666;
    margin-left: auto;
  }
  
  .detail-value {
    color: #888;
  }
  
  /* Mobile sort controls */
  .mobile-sort-controls {
    display: flex;
    align-items: center;
    gap: 0.3em;
    margin-bottom: 0.5rem;
  }

  .mobile-sort-controls label {
    font-size: 1em;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
  }

  .mobile-sort-select {
    flex: 1;
    display: inline-block;
    background-color: #fff;
    appearance: none;
    font-size: 1em;
    cursor: pointer;
    height: 2.7em;
    vertical-align: middle;
    text-align: start;
    box-sizing: border-box;
    box-shadow: 0 2px 5px rgb(0 0 0 / 10%);
    border: 1px solid #ddd;
    border-radius: 4px;
    padding-left: 0.7em;
    padding-right: 0.7em;
  }

  .mobile-sort-select:focus {
    border-color: #4a90e2;
    box-shadow: 0 0 5px rgb(74 144 226 / 50%);
    outline: none;
  }

  .sort-direction-btn {
    width: 24px;
    height: 27px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2em;
    background-color: #fff;
    box-sizing: border-box;
    box-shadow: 0 2px 5px rgb(0 0 0 / 10%);
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    color: #4a90e2;
  }

  .sort-direction-btn:hover {
    background: #f0f0f0;
  }

  .sort-direction-btn:active,
  .sort-direction-btn:focus {
    border-color: #4a90e2;
    box-shadow: 0 0 5px rgb(74 144 226 / 50%);
    outline: none;
  }

  /* Mobile Pagination */
  .mobile-pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin: 1rem 0;
    flex-wrap: wrap;
  }

  .mobile-pagination-btn {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    color: #333;
    transition: all 0.2s;
  }

  .mobile-pagination-btn:hover:not(:disabled) {
    background: #4a90e2;
    color: white;
  }

  .mobile-pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .mobile-page-info {
    font-size: 0.9rem;
    color: #666;
    font-weight: 500;
  }

  .missing-course-link {
    color: #666;
    text-decoration: underline;
    text-decoration-color: rgba(0, 0, 0, 0.25);
    text-underline-offset: 2px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 6px;
    white-space: nowrap;
  }

  .missing-course-link:hover {
    color: #333;
    text-decoration-color: rgba(0, 0, 0, 0.45);
    background: rgba(0, 0, 0, 0.035);
  }

  .missing-course-link:focus-visible {
    outline: 2px solid rgba(74, 144, 226, 0.9);
    outline-offset: 2px;
    text-decoration: none;
  }

  /* Modal */
  .mc-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2000;

    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mc-overlay-close {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .mc-modal {
    position: relative;
    z-index: 1;
    width: min(560px, 92vw);
    max-height: 90vh;
    overflow: auto;

    background: white;
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .mc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid #eee;
  }

  .mc-title {
    font-weight: 600;
    font-size: 0.95rem;
    color: #111;
  }

  .mc-close {
    border: 0;
    background: transparent;
    cursor: pointer;
    font-size: 1.2rem;
    color: #666;
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }

  .mc-close:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #111;
  }

  .mc-body {
    padding: 10px 12px;
  }
  
  /* Tablet breakpoint - abbreviated headers */
  @media (max-width: 1170px) {
    th .full-text {
      display: none;
    }
    
    th .abbreviated-text {
      display: inline;
    }
  }
  
  /* Mobile breakpoint - switch to cards */
  @media (max-width: 555px) {
    .desktop-table-wrapper {
      display: none;
    }

    .pagination-controls {
      display: none;
    }
    
    .mobile-cards {
      display: block;
      padding: 0 2%;
      margin: 1rem 0;
    }
  }
</style>