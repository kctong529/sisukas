<!-- src/components/CourseTable.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Course } from '../domain/models/Course';
  
  export let courses: Course[] = [];
  
  let sortColumn = 'courseName';
  let sortDirection = 1;
  let windowWidth = 0;
  let visibleCardCount = 20;
  let cardContainerRef: HTMLElement;

  $: isNarrowScreen = windowWidth < 380;
  $: visibleCourses = courses.slice(0, visibleCardCount);

  onMount(() => {
    const handleScroll = () => {
      if (!cardContainerRef || visibleCardCount >= courses.length) return;
      
      const containerRect = cardContainerRef.getBoundingClientRect();
      const containerBottom = containerRect.bottom;
      const windowHeight = window.innerHeight;
      
      // Load more when bottom of container is within 800px of viewport bottom
      const threshold = 800;
      if (containerBottom < windowHeight + threshold) {
        visibleCardCount = Math.min(visibleCardCount + 20, courses.length);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    // Also check on mount in case content doesn't fill screen
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  });
  
  function handleSort(column: string) {
    if (sortColumn === column) {
      sortDirection *= -1;
    } else {
      sortColumn = column;
      sortDirection = 1;
    }
    courses = sortCourses(courses);
  }

  function handleMobileSortChange() {
    sortDirection = 1;
    courses = sortCourses(courses);
    visibleCardCount = 20;
  }
  
  function sortCourses(coursesToSort: Course[]): Course[] {
    return [...coursesToSort].sort((a, b) => {
      const valueA = getSortableValue(a, sortColumn);
      const valueB = getSortableValue(b, sortColumn);
      
      if (typeof valueA === 'string') {
        return valueA.localeCompare(valueB) * sortDirection;
      } else {
        return (valueA - valueB) * sortDirection;
      }
    });
  }
  
  function getSortableValue(course: Course, column: string): any {
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
    if (!course.prerequisites) {
      return 'None';
    }
    
    if (course.prerequisites.hasTextOnly) {
      const text = course.prerequisites.raw.en;
      if (text.length == 0) {
        return 'None';
      }
      return text.length > 100 ? text.substring(0, 97) + '...' : text;
    }
    
    return course.prerequisites.codePatterns.join(', ');
  }
  
  function formatDate(date: Date, withYear: boolean=false): string {
    if (withYear) {
      return date.toLocaleDateString('fi-FI', { 
        day: '2-digit', 
        month: '2-digit',
        year: '2-digit'
      });
    }
    return date.toLocaleDateString('fi-FI', { 
      day: '2-digit', 
      month: '2-digit'
    });
  }

  function formatTeacher(teacher: string, narrow: boolean): string {
    if (!narrow) {
      return teacher;
    }
    
    // Trim to first name and last initial
    const parts = teacher.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0];
    }
    
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0];
    return `${firstName} ${lastInitial}.`;
  }
</script>

<svelte:window bind:innerWidth={windowWidth} />

<div id="course-count">
  Total courses: {courses.length}
</div>

<!-- Desktop Table View -->
<table class="desktop-table">
  <thead>
    <tr>
      <th 
        class:sort-asc={sortColumn === 'courseCode' && sortDirection === 1}
        class:sort-desc={sortColumn === 'courseCode' && sortDirection === -1}
        on:click={() => handleSort('courseCode')}
      >
        <span class="full-text">Course Code</span>
        <span class="abbreviated-text">code</span>
      </th>
      <th 
        class:sort-asc={sortColumn === 'courseName' && sortDirection === 1}
        class:sort-desc={sortColumn === 'courseName' && sortDirection === -1}
        on:click={() => handleSort('courseName')}
      >
        <span class="full-text">Course Name</span>
        <span class="abbreviated-text">name</span>
      </th>
      <th 
        class:sort-asc={sortColumn === 'teachers' && sortDirection === 1}
        class:sort-desc={sortColumn === 'teachers' && sortDirection === -1}
        on:click={() => handleSort('teachers')}
      >
        <span class="full-text">Teacher(s)</span>
        <span class="abbreviated-text">teachr</span>
      </th>
      <th 
        class:sort-asc={sortColumn === 'credits' && sortDirection === 1}
        class:sort-desc={sortColumn === 'credits' && sortDirection === -1}
        on:click={() => handleSort('credits')}
      >
        <span class="full-text">Credits</span>
        <span class="abbreviated-text">cr</span>
      </th>
      <th on:click={() => handleSort('language')}>
        <span class="full-text">Language</span>
        <span class="abbreviated-text">lang</span>
      </th>
      <th on:click={() => handleSort('startDate')}>
        <span class="full-text">Start Date</span>
        <span class="abbreviated-text">start</span>
      </th>
      <th on:click={() => handleSort('endDate')}>
        <span class="full-text">End Date</span>
        <span class="abbreviated-text">end</span>
      </th>
      <th on:click={() => handleSort('enrollFrom')}>
        <span class="full-text">Enroll From</span>
        <span class="abbreviated-text">frm</span>
      </th>
      <th on:click={() => handleSort('enrollTo')}>
        <span class="full-text">Enroll To</span>
        <span class="abbreviated-text">to</span>
      </th>
      <th on:click={() => handleSort('prerequisites')}>
        <span class="full-text">Prerequisites</span>
        <span class="abbreviated-text">preq</span>
      </th>
    </tr>
  </thead>
  <tbody>
    {#each courses as course}
      <tr>
        <td>{course.code.value}</td>
        <td>
          <a href="https://sisu.aalto.fi/student/courseunit/{course.unitId}/brochure" target="_blank">
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
        <td class="prerequisites-cell">
          {formatPrerequisites(course)}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<!-- Mobile Card View -->
<div class="mobile-cards" bind:this={cardContainerRef}>
  <div class="mobile-sort-controls">
    <label for="mobile-sort">Sort by:</label>
    <select 
      id="mobile-sort" 
      class="mobile-sort-select"
      bind:value={sortColumn} 
      on:change={handleMobileSortChange}
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
      on:click={() => {
        sortDirection *= -1;
        courses = sortCourses(courses);
      }}
      aria-label="Toggle sort direction"
    >
      {sortDirection === 1 ? '↑' : '↓'}
    </button>
  </div>

  {#each visibleCourses as course}
    <div class="course-card">
      <div class="card-header">
        <span class="card-code">{course.code.value}</span>
        <span class="card-period">{formatDate(course.courseDate.start)} – {formatDate(course.courseDate.end)}</span>
      </div>
      
      <a href="https://sisu.aalto.fi/student/courseunit/{course.unitId}/brochure" target="_blank" class="card-title">
        {course.name.en}
      </a>
      
      <div class="card-details">
        <span class="detail-item">{formatTeacher(course.teachers[0] || 'TBA', isNarrowScreen)}</span>
        <span class="detail-separator">•</span>
        <span class="detail-item">{course.languages.join(', ')}</span>
        <span class="detail-separator">•</span>
        <span class="detail-item">{course.credits.min}cr</span>
        <span class="detail-label">Enroll:</span>
        <span class="detail-value">{formatDate(course.enrollmentDate.start)} – {formatDate(course.enrollmentDate.end)}</span>
      </div>
    </div>
  {/each}

  {#if visibleCardCount < courses.length}
    <div class="loading-indicator">
      Loading more courses...
    </div>
  {/if}
</div>

<style>
  #course-count {
    position: relative;
    float: right;
    margin: -20px 15px 0 0;
  }
  
  /* Desktop Table Styles */
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
  
  /* Mobile Card Styles - Compact */
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

  .loading-indicator {
    text-align: center;
    padding: 1rem;
    color: #666;
    font-size: 0.9rem;
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
  
  /* Tablet breakpoint - abbreviated headers */
  @media (max-width: 920px) {
    th .full-text {
      display: none;
    }
    
    th .abbreviated-text {
      display: inline;
    }
  }
  
  /* Mobile breakpoint - switch to cards */
  @media (max-width: 540px) {
    .desktop-table {
      display: none;
    }
    
    .mobile-cards {
      display: block;
      padding: 0 2%;
      margin: 1rem 0;
    }
  }

  @media (max-width: 432px) {
    #course-count {
      float: none;
      text-align: right;
      margin: 0 15px 0 0;
    }
  }
</style>