<script lang="ts">
  import { CourseService } from './domain/services/CourseService';
  import { Course } from './domain/models/Course';
  import { RuleBlueprints } from './domain/filters/blueprints';
  import { getBuilderFor } from './domain/filters/builder/getBuilderFor'

  function testRule(label: string, rule: any, courses: Course[], fieldValueFn?: (c: Course) => string) {
    console.group(label);
    console.log(`Rule: ${rule.describe()}`);
    courses.forEach(c => {
      const displayValue = fieldValueFn ? fieldValueFn(c) : '';
      console.log(`  ${c.code.padEnd(15)}${displayValue ? ` ${displayValue.padEnd(30)}` : ''} → ${rule.evaluate(c)}`);
    });
    console.groupEnd();
  }

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
      lastUpdated: new Date(),
      tags: ['programming2'],
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
      lastUpdated: new Date(),
      tags: ['heavy-workload', 'programming'],
    })
  ];

  const today = new Date();
  console.log(courses);

  console.log('Testing all rule blueprints with sample courses\n');

  console.group('📝 TEXT FILTERS');

  testRule('Course Code StartsWith CS-', RuleBlueprints.code.createRule('startsWith', 'CS-'), courses);
  testRule('Course Code Contains ELEC', RuleBlueprints.code.createRule('contains', 'ELEC'), courses);
  testRule('Course Name Regex Programming', RuleBlueprints.name.createRule('matches', '[Pp]rogramming'), courses, c => c.name.en.substring(0, 30));
  testRule('Organization Contains Computer Science', RuleBlueprints.organization.createRule('contains', 'Computer Science'), courses, c => c.organization.substring(0, 40));

  console.groupEnd();
  
  console.group('🔢 NUMERIC RANGE FILTERS');

  testRule('Credits Min Equals 5', RuleBlueprints.credits.createRule('minEquals', 5), courses, c => `credits: ${c.credits.min}`);
  testRule('Credits Include 5', RuleBlueprints.credits.createRule('includes', 5), courses, c => `range: [${c.credits.min}, ${c.credits.max ?? c.credits.min}]`);

  console.groupEnd();
  
  console.group('📅 DATE FILTERS');

  testRule('Starts On or After Today', RuleBlueprints.startDate.createRule('onOrAfter', today), courses, c => `starts: ${c.startDate.toLocaleDateString()}`);
  testRule('Ends Before 2026', RuleBlueprints.endDate.createRule('before', new Date('2026-01-01')), courses, c => `ends: ${c.endDate.toLocaleDateString()}`);
  testRule('Starts Between Dec 2025 - Mar 2026', RuleBlueprints.startDate.createRule('between', { start: new Date('2025-12-01'), end: new Date('2026-03-01') }), courses, c => `starts: ${c.startDate.toLocaleDateString()}`);

  console.groupEnd();
  
  console.group('📆 DATE RANGE FILTERS');

  testRule(
    'Overlaps Winter Period (Dec-Feb)',
    RuleBlueprints.coursePeriod.createRule('overlaps', { start: new Date('2025-12-01'), end: new Date('2026-02-28') }),
    courses,
    c => `period: ${c.startDate.toLocaleDateString()} - ${c.endDate.toLocaleDateString()}`
  );

  testRule(
    'Enrollment Open Now',
    RuleBlueprints.enrollmentPeriod.createRule('contains', { start: today, end: today }),
    courses,
    c => `enrollment: ${c.enrollmentPeriod.start.toLocaleDateString()} - ${c.enrollmentPeriod.end.toLocaleDateString()}`
  );

  console.groupEnd();

  console.group('🏷️ CATEGORICAL FILTERS');

  testRule('Level Equals Basic Studies', RuleBlueprints.level.createRule('equals', 'basic-studies'), courses, c => `level: ${c.level}`);
  testRule('Level Is One Of [Basic, Other]', RuleBlueprints.level.createRule('isOneOf', ['basic-studies', 'other-studies']), courses, c => `level: ${c.level}`);
  testRule('Format Equals Lecture', RuleBlueprints.format.createRule('equals', 'lecture'), courses, c => `format: ${c.format}`);
  testRule('Format Not Equals Exam', RuleBlueprints.format.createRule('notEquals', 'exam'), courses, c => `format: ${c.format}`);

  console.groupEnd();

  console.group('🔤 CATEGORICAL ARRAY FILTERS');

  testRule('Taught in English', RuleBlueprints.language.createRule('includes', 'en'), courses, c => `languages: [${c.languages.join(', ')}]`);
  testRule('Taught in Finnish or Swedish', RuleBlueprints.language.createRule('includesAny', ['fi', 'sv']), courses, c => `languages: [${c.languages.join(', ')}]`);
  testRule('Taught in Both English and Finnish', RuleBlueprints.language.createRule('includesAll', ['en', 'fi']), courses, c => `languages: [${c.languages.join(', ')}]`);
  testRule('Taught by Sanna Helena Suoranta', RuleBlueprints.teachers.createRule('includes', 'Sanna Helena Suoranta'), courses, c => `teachers: ${c.teachers.length}`);
  testRule('Taught by Ludvigsen or Virtanen', RuleBlueprints.teachers.createRule('includesAny', ['Ludvigsen', 'Virtanen']), courses, c => `teachers: [${c.teachers.slice(0, 2).join(', ')}${c.teachers.length > 2 ? '...' : ''}]`);
  testRule('Has Programming Tag', RuleBlueprints.tags.createRule('includes', 'programming'), courses, c => `tags: [${(c.tags ?? []).join(', ')}]`);
  testRule('Has No Tags', RuleBlueprints.tags.createRule('isEmpty'), courses, c => `tags: [${(c.tags ?? []).join(', ')}]`);

  console.groupEnd();
  console.groupEnd();

  const builder = getBuilderFor(RuleBlueprints.name);
  console.log(builder.blueprint.validRelations);
  
  builder.setValue('program');
  testRule('Builder test 1', builder.build(), courses);

  builder.setRelation('equals');
  testRule('Builder test 2', builder.build(), courses);

  builder.setValue('^Fin.+[1-9]');
  builder.setRelation('matches');
  testRule('Builder test 3', builder.build(), courses);
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
