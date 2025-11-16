<script lang="ts">
  import { CourseService } from './domain/services/CourseService';
  import { Course } from './domain/models/Course';
  import { RuleBlueprints } from './domain/filters/blueprints';

  const courses: Course[] = [
    new Course({
      id: 'aalto-CUR-207500-3123280',
      code: 'LC-7210',
      name: {
        en: 'Finnish 1, Lecture',
        fi: 'Suomi 1, intensiivinen, Luento-opetus',
        sv: 'Finska 1, Föreläsning'
      },
      startDate: new Date('2026-01-09'),
      endDate: new Date('2026-02-17'),
      enrollmentPeriod: { start: new Date('2025-12-08'), end: new Date('2026-01-01') },
      credits: { min: 3 },
      level: 'other-studies',
      organization: 'Aalto University, Language Centre',
      teachers: ['Noora Aleksandra Helkiö'],
      languages: ['en'],
      format: 'teaching-participation-lectures',
      lastUpdated: new Date()
    }),
    new Course({
      id: 'aalto-CUR-206094-3121874',
      code: 'CS-A1120',
      name: {
        en: 'Programming 2, Lecture',
        fi: 'Ohjelmointi 2, Luento-opetus',
        sv: 'Programmering 2, Föreläsning'
      },
      startDate: new Date('2026-02-23'),
      endDate: new Date('2026-05-29'),
      enrollmentPeriod: { start: new Date('2026-01-26'), end: new Date('2026-03-02') },
      credits: { min: 5 },
      level: 'basic-studies',
      prerequisites: {
        fi: "Suositellut esitiedot: CS-A1110 Ohjelmointi 1",
        sv: "Rekommenderade förkunskaper: CS-A1110 Programmering 1",
        en: "Recommended prerequisites: CS-A1110 Programming 1"
      },
      organization: 'Department of Computer Science',
      teachers: ['Johan Lukas Ahrenberg', 'Sanna Helena Suoranta'],
      languages: ['en'],
      format: 'teaching-participation-lectures',
      lastUpdated: new Date()
    }),
    new Course({
      id: 'otm-e6b7a1f7-b842-4609-aa74-0c1dc8e38c9f',
      code: 'ELEC-C0302',
      name: {
        en: 'Final Project in Digital Systems and Design, Lectures',
        fi: 'Final Project in Digital Systems and Design, Luento-opetus',
        sv: 'Final Project in Digital Systems and Design, Närundervisning'
      },
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-06-05'),
      enrollmentPeriod: { start: new Date('2025-08-04'), end: new Date('2026-04-19') },
      credits: { min: 10 },
      level: 'intermediate-studies',
      prerequisites: {
        "fi": "Recommended prerequisites: 1st &amp; 2nd year Digital Systems and Design BSc major studies.",
        "sv": "Recommended prerequisites: 1st &amp; 2nd year Digital Systems and Design BSc major studies.",
        "en": "Recommended prerequisites: 1st &amp; 2nd year Digital Systems and Design BSc major studies."
      },
      organization: 'Department of lnformation and Communications Engineering',
      teachers: [
        'Hanne Elisabeth Ludvigsen',
        'Katsuyuki Haneda',
        'Salu Pekka Ylirisku',
        'Sergiy A Vorobyov',
        'Stephan Sigg',
        'Valeriy Vyatkin'
      ],
      languages: ['en'],
      format: 'teaching-participation-lectures',
      lastUpdated: new Date()
    })
  ];

  const today = new Date();
  const completedCourses = ['CS-A1110']; // Example student transcript

  const enrollableCourses = courses
    .filter(c => CourseService.isEnrollmentOpen(c, today))
    .filter(c => CourseService.canEnroll(c, completedCourses).canEnroll);

  console.log('Courses student can enroll in today:', enrollableCourses);

  // Create rules using blueprints
  const csCodeRule = RuleBlueprints.code.createRule('startsWith', 'CS-');
  console.log(csCodeRule);
  courses.forEach( c => 
    console.log(`${c.code}: ${csCodeRule.evaluate(c)}`)
  );
</script>

<ul class="course-list">
  {#each courses as course}
    <li class="course-card">
      <div class="course-header">
        <h2>{course.code} — {course.name.en}</h2>
        <span class="course-level">{course.level}</span>
      </div>

      <ul class="course-details">
        <li><strong>Duration:</strong> {CourseService.getCourseDuration(course)} days</li>
        <li>
          <strong>Enrollment:</strong> 
          {CourseService.isEnrollmentOpen(course, today) ? 'Open' : 'Closed'}
        </li>
        <li>
          <strong>Prerequisites:</strong> 
          {#if course.prerequisites && !course.prerequisites.hasTextOnly}
            {course.prerequisites.codePatterns.join(', ')}
          {:else}
            None
          {/if}
        </li>
        <li><strong>Credits:</strong> {course.credits.min}</li>
        <li><strong>Organization:</strong> {course.organization}</li>
      </ul>
    </li>
  {/each}
</ul>

<style>
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
    transition: transform 0.2s ease, box-shadow 0.2s ease;
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
