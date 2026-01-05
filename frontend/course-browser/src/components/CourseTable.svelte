<!-- src/components/CourseTable.svelte -->
<script lang="ts">
  import type { Course } from '../domain/models/Course';
  
  export let courses: Course[] = [];
  
  let sortColumn = 'courseName';
  let sortDirection = 1;
  
  function handleSort(column: string) {
    if (sortColumn === column) {
      sortDirection *= -1;
    } else {
      sortColumn = column;
      sortDirection = 1;
    }
    
    courses = sortCourses(courses);
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
      // Show truncated text if it's too long
      return text.length > 100 ? text.substring(0, 97) + '...' : text;
    }
    
    // Show extracted course code patterns
    return course.prerequisites.codePatterns.join(', ');
  }
</script>

<div id="course-count">
  Total courses: {courses.length}
</div>

<table>
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
          <a href="https://sisu.aalto.fi/student/courseunit/{course.id}/brochure" target="_blank">
            {course.name.en}
          </a>
        </td>
        <td>{course.teachers.join(', ')}</td>
        <td>{course.credits.min}</td>
        <td>{course.languages.join(', ')}</td>
        <td>{course.courseDate.start.toLocaleDateString()}</td>
        <td>{course.courseDate.end.toLocaleDateString()}</td>
        <td>{course.enrollmentDate.start.toLocaleDateString()}</td>
        <td>{course.enrollmentDate.end.toLocaleDateString()}</td>
        <td class="prerequisites-cell">
          {formatPrerequisites(course)}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  #course-count {
    margin: 1rem 0;
    font-weight: bold;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }
  
  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }
  
  th {
    background: #f8f9fa;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
  }
  
  th:hover {
    background: #e9ecef;
  }
  
  th.sort-asc::after {
    content: ' ▲';
    font-size: 0.7em;
  }
  
  th.sort-desc::after {
    content: ' ▼';
    font-size: 0.7em;
  }
  
  tr:hover {
    background: #f8f9fa;
  }
  
  a {
    color: #007bff;
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
  
  @media (max-width: 900px) {
    .full-text {
      display: none;
    }
    
    .abbreviated-text {
      display: inline;
    }
  }
  
  @media (min-width: 901px) {
    .full-text {
      display: inline;
    }
    
    .abbreviated-text {
      display: none;
    }
  }
</style>