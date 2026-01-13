<<<<<<< HEAD
<!-- src/App.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import Navigation from './components/Navigation.svelte';
  import FilterContainer from './components/FilterContainer.svelte';
  import CourseTable from './components/CourseTable.svelte';
  import SearchControls from './components/SearchControls.svelte';
  import NotificationContainer from './components/NotificationContainer.svelte';
  import AuthModal from "./components/AuthModal.svelte";
  import FavouritesView from "./components/FavouritesView.svelte";
  import { authClient, useSession } from "./lib/authClient";
  import { createRuleBlueprints } from './domain/filters/blueprints';
  import { loadCurricula } from './infrastructure/loaders/CurriculumLoader';
  import { loadOrganizations } from './infrastructure/loaders/OrganizationLoader';
  import { loadCoursesWithCache } from './infrastructure/loaders/RemoteCourseLoader';
  import { loadAcademicPeriods } from './infrastructure/loaders/AcademicPeriodLoader';
  import { FilterService } from './domain/services/FilterService';
  import { FilterSerializer } from './domain/filters/helpers/FilterSerializer';
  import { FiltersApiService } from './infrastructure/services/FiltersApiService';
  import { NotificationService } from './infrastructure/services/NotificationService';
  import type { Course } from './domain/models/Course';
  import type { AcademicPeriod } from './domain/models/AcademicPeriod';
  import type { FilterRuleGroups } from './domain/filters/FilterTypes';
  import AuthDebugPanel from './components/AuthDebugPanel.svelte';
  import { courseStore } from './lib/stores/courseStore';
  
  let currentView = 'courses';
  let isSignedIn = false;
  let userName = '';

  let RuleBlueprints: ReturnType<typeof createRuleBlueprints> | null = null;
  let courses: Course[] = [];
  let filteredCourses: Course[] = [];
  let periods: AcademicPeriod[] = [];
  let filterRules: FilterRuleGroups = [];
  let showUnique = false;
  let filterContainerRef: FilterContainer | undefined;
  let pendingFilterLoad: string | null = null;
  
  // Loading states
  let loading = true;

  const session = useSession();
  let showAuthModal = false;

  function handleNavigation(event: CustomEvent<string>) {
    currentView = event.detail;
    // Add routing logic here
  }
  
  function handleSignIn() {
    showAuthModal = true;
  }
  
  function handleSignOut() {
    authClient.signOut();
  }
  
  // Initialize data on mount
  onMount(async () => {
    try {
      // Load academic periods (synchronous)
      periods = loadAcademicPeriods();
      console.log("Academic Periods loaded:", periods);
      
      // Load organizations (synchronous)
      const organizations = loadOrganizations();
      console.log("Organizations loaded:", organizations.length);

      // Load curricula data
      const curriculaMap = await loadCurricula();
      console.log("Curricula loaded:", curriculaMap);
      
      // Initialize blueprints with all required data
      RuleBlueprints = createRuleBlueprints({ curriculaMap, organizations, periods });
      console.log("Rule blueprints initialized");
      
      // Load courses with cache
      courses = await loadCoursesWithCache();
      filteredCourses = [...courses];
      console.log("Courses loaded:", courses.length);

      // Build coursesId Map using courseStore
      await courseStore.setCourses(courses);
      console.log("Courses loaded into courseStore");

      // Check for filter hash in URL and load if present
      await loadFiltersFromUrl();
      
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      loading = false;
    }
  });

  async function loadFiltersFromUrl() {
    const hashId = FiltersApiService.getHashFromUrl();
    if (!hashId || !RuleBlueprints) return;
    
    // If filterContainerRef isn't ready yet, store the hash for later
    if (!filterContainerRef) {
      pendingFilterLoad = hashId;
      return;
    }

    const data = await FiltersApiService.loadFilters(hashId);
    if (!data || !RuleBlueprints) {
      return;
    }

    const configs = FilterSerializer.fromJSON(data, RuleBlueprints);
      
    filterContainerRef.loadFilterConfigs(configs);
    // Trigger search after loading
    setTimeout(() => handleSearch(), 100);
      
    NotificationService.success('Loaded filters from shared link');
    pendingFilterLoad = null;
  }

  // Handle pending filter load once filterContainerRef is bound
  $: if (filterContainerRef && pendingFilterLoad) {
    loadFiltersFromUrl();
  }
  
  function handleSearch() {
    if (!RuleBlueprints || filterRules.length === 0) {
      filteredCourses = showUnique 
        ? FilterService.getUniqueCourses(courses) 
        : [...courses];
      return;
    }
    
    // Apply filters using the FilterService
    const results = FilterService.applyFilters(courses, filterRules);
    filteredCourses = showUnique 
      ? FilterService.getUniqueCourses(results) 
      : results;
  }
  
  async function handleSaveFilters() {
    if (!filterContainerRef) return;
    
    const configs = filterContainerRef.getFilterConfigs();

    if (configs.length === 0) {
      NotificationService.error('No filters to save');
      return;
    }

    try {
      const serialized = FilterSerializer.toJSON(configs);
      const hashId = await FiltersApiService.saveFilters(serialized);

      if (!hashId) {
        throw new Error('Failed to get hash ID');
      }

      const shareableUrl = FiltersApiService.createShareableUrl(hashId);
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareableUrl);
        NotificationService.success('Filter link copied to clipboard!');
      } catch {
        NotificationService.success('Filters saved successfully!');
      }

      // Navigate to the shareable URL
      setTimeout(() => {
        window.location.href = shareableUrl;
      }, 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save filters';
      NotificationService.error(message);
    }
  }
  
  function handleLoadFilters() {
    // Create file input for JSON import
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file || !RuleBlueprints) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const configs = FilterSerializer.fromJSON(data, RuleBlueprints);
        
        if (filterContainerRef) {
          filterContainerRef.loadFilterConfigs(configs);
          setTimeout(() => handleSearch(), 100);
        }
        
        NotificationService.success('Filters loaded from file');
      } catch {
        NotificationService.error('Failed to parse filter file');
      }
    };
    
    input.click();
  }
  
  function handleAddRule() {
    if (filterContainerRef) {
      filterContainerRef.addFilterRule();
    }
  }

  $: isSignedIn = !!$session.data?.user;
  $: userName = $session.data?.user?.email ?? "";
</script>

<svelte:head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css">
</svelte:head>

<Navigation 
  {currentView}
  {isSignedIn}
  {userName}
  on:navigate={handleNavigation}
  on:signin={handleSignIn}
  on:signout={handleSignOut}
/>

{#if import.meta.env.VITE_DEBUG_AUTH === "true"}
  <AuthDebugPanel />
{/if}

{#if showAuthModal}
  <AuthModal on:close={() => (showAuthModal = false)} />
{/if}

<NotificationContainer />

<div id="main-content">
  <!-- Courses View -->
  <div 
    class="view" 
    class:hidden={currentView !== 'courses'}
  >
    {#if loading}
      <div style="text-align: center; padding: 2rem;">
        <p>Loading course data...</p>
      </div>
    {:else if RuleBlueprints}
      <FilterContainer 
        bind:this={filterContainerRef}
        blueprints={RuleBlueprints as Record<string, unknown>} 
        bind:filterRules 
        {periods}
        on:search={handleSearch}
      />
      
      <SearchControls 
        bind:showUnique 
        on:addRule={handleAddRule}
        on:search={handleSearch}
        on:save={handleSaveFilters}
        on:load={handleLoadFilters}
      />
      
      <CourseTable courses={filteredCourses} />
    {:else}
      <div style="text-align: center; padding: 2rem;">
        <p>Failed to load filter blueprints. Please refresh the page.</p>
      </div>
    {/if}
  </div>

  <!-- Favourites View -->
  <div 
    class="view" 
    class:hidden={currentView !== 'favourites'}
  >
    <FavouritesView />
  </div>

  <!-- About View -->
  <div 
    class="view" 
    class:hidden={currentView !== 'about'}
  >
    About
  </div>
</div>

<footer>
  <p id="footer-text">© 2026 Sisukas. All rights reserved.</p>
</footer>

<style>
  :global(body) {
    margin: 0;
    overflow-x: hidden;
    font-family: sans-serif;
    font-size: clamp(10px, 1.3vw, 15px);
    background-color: #f4f7f6;
    color: #333;
    -ms-overflow-style: none;
  }
  
  :global(html) {
    scrollbar-width: none;
  }
  
  :global(body::-webkit-scrollbar) {
    display: none;
  }
  
  :global(h1) {
    font-size: clamp(20px, 4vw, 48px);
  }
  
  :global(h2) {
    font-size: clamp(10px, 2vw, 24px);
    font-weight: normal;
    margin-top: clamp(-36px, -3vw, -12px);
  }
  
  :global(h2 a) {
    color: #888;
    text-decoration: none;
  }
  
  :global(h2 a:hover) {
    color: #d9534f;
  }

  #main-content {
    min-height: 80vh; /* Keeps the page long enough so scroll context stays stable */
  }

  .view {
    display: block;
  }

  .view.hidden {
    display: none;
  }
  
  footer {
    margin-top: 2rem;
  }
  
  #footer-text {
    font-size: 0.9em;
    color: #777;
    margin: 2%;
  }
</style>
=======
<script lang="ts">
  import { Course } from './domain/models/Course';
  import { RuleBlueprints } from './domain/filters/blueprints';
  import { getBuilderFor } from './domain/filters/builder/getBuilderFor'
  import RemoteCourseLoader from './RemoteCourseLoader.svelte';
  import { loadCurricula } from "./infrastructure/loaders/CurriculumLoader";

  function testRule(label: string, rule: any, courses: Course[], fieldValueFn?: (c: Course) => string) {
    console.group(label);
    console.log(`Rule: ${rule.describe()}`);
    courses.forEach(c => {
      const displayValue = fieldValueFn ? fieldValueFn(c) : '';
      console.log(`  ${c.code.value.padEnd(15)}${displayValue ? ` ${displayValue.padEnd(30)}` : ''} → ${rule.evaluate(c)}`);
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
      courseDate: { start: new Date('2026-01-09'), end: new Date('2026-02-17') },
      enrollmentDate: { start: new Date('2025-12-08'), end: new Date('2026-01-01') },
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
      courseDate: { start: new Date('2026-02-23'), end: new Date('2026-05-29') },
      enrollmentDate: { start: new Date('2026-01-26'), end: new Date('2026-03-02') },
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
      courseDate: { start: new Date('2025-09-01'), end: new Date('2026-06-05') },
      enrollmentDate: { start: new Date('2025-08-04'), end: new Date('2026-04-19') },
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

  testRule('Starts On or After Today', RuleBlueprints.startDate.createRule('onOrAfter', today), courses, c => `starts: ${c.courseDate.start.toLocaleDateString()}`);
  testRule('Ends Before 2026', RuleBlueprints.endDate.createRule('before', new Date('2026-01-01')), courses, c => `ends: ${c.courseDate.end.toLocaleDateString()}`);
  testRule('Starts Between Dec 2025 - Mar 2026', RuleBlueprints.startDate.createRule('between', { start: new Date('2025-12-01'), end: new Date('2026-03-01') }), courses, c => `starts: ${c.courseDate.start.toLocaleDateString()}`);

  console.groupEnd();
  
  console.group('📆 DATE RANGE FILTERS');

  testRule(
    'Overlaps Winter Period (Dec-Feb)',
    RuleBlueprints.coursePeriod.createRule('overlaps', { start: new Date('2025-12-01'), end: new Date('2026-02-28') }),
    courses,
    c => `period: ${c.courseDate.start.toLocaleDateString()} - ${c.courseDate.end.toLocaleDateString()}`
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

  const textBuilder = getBuilderFor(RuleBlueprints.name);
  console.log(textBuilder.blueprint.validRelations);

  textBuilder.setValue('program');
  testRule('Builder test 1', textBuilder.build(), courses);

  textBuilder.setRelation('equals');
  testRule('Builder test 2', textBuilder.build(), courses);

  textBuilder.setValue('^Fin.+[1-9]');
  textBuilder.setRelation('matches');
  testRule('Builder test 3', textBuilder.build(), courses);

  const numericRangeBuilder = getBuilderFor(RuleBlueprints.credits);
  numericRangeBuilder.setValue(3);
  testRule('Builder test 4', numericRangeBuilder.build(), courses, c => `credits: ${c.credits.min}`);

  numericRangeBuilder.setRelation('minEquals');
  numericRangeBuilder.setValue(5);
  testRule('Builder test 5', numericRangeBuilder.build(), courses, c => `credits: ${c.credits.min}`);

  let dateBuilder = getBuilderFor(RuleBlueprints.startDate);
  dateBuilder.setRelation('onOrAfter');
  dateBuilder.setValue(today);
  testRule('Builder test 6', dateBuilder.build(), courses, c => `starts: ${c.courseDate.start.toLocaleDateString()}`);

  dateBuilder.setRelation('between');
  dateBuilder.setValue({ start: new Date('2025-12-01'), end: new Date('2026-03-01') });
  testRule('Builder test 7', dateBuilder.build(), courses, c => `starts: ${c.courseDate.start.toLocaleDateString()}`);

  dateBuilder = getBuilderFor(RuleBlueprints.endDate);
  dateBuilder.setRelation('before');
  dateBuilder.setValue(new Date('2026-06-01'));
  testRule('Builder test 8', dateBuilder.build(), courses, c => `ends: ${c.courseDate.end.toLocaleDateString()}`);

  let dateRangeBuilder = getBuilderFor(RuleBlueprints.coursePeriod);
  dateRangeBuilder.setRelation('overlaps');
  dateRangeBuilder.setValue({ start: new Date('2025-12-01'), end: new Date('2026-02-01') });
  testRule('Builder test 9', dateRangeBuilder.build(), courses, c => `period: ${c.courseDate.start.toLocaleDateString()} - ${c.courseDate.end.toLocaleDateString()}`);

  dateRangeBuilder = getBuilderFor(RuleBlueprints.enrollmentPeriod);
  dateRangeBuilder.setRelation('contains');
  dateRangeBuilder.setValue({ start: today, end: today });
  testRule('Builder test 10', dateRangeBuilder.build(), courses, c => `enrollment: ${c.enrollmentPeriod.start.toLocaleDateString()} - ${c.enrollmentPeriod.end.toLocaleDateString()}`);

  const levelBuilder = getBuilderFor(RuleBlueprints.level);
  levelBuilder.setRelation('equals');
  levelBuilder.setValue('basic-studies');
  testRule('Builder test 11', levelBuilder.build(), courses, c => `level: ${c.level}`);

  levelBuilder.setRelation('isOneOf');
  levelBuilder.setValue(['basic-studies', 'other-studies']);
  testRule('Builder test 12', levelBuilder.build(), courses, c => `level: ${c.level}`);
  
  const formatBuilder = getBuilderFor(RuleBlueprints.format);
  formatBuilder.setRelation('equals');
  formatBuilder.setValue('lecture');
  testRule('Builder test 13', formatBuilder.build(), courses, c => `format: ${c.format}`);

  const curricula = loadCurricula();
  console.log("Curricula loaded:", curricula);
</script>

<RemoteCourseLoader></RemoteCourseLoader>

<ul class="course-list">
  {#each courses as course}
    <li class="course-card">
      <div class="course-header">
        <h2>{course.code} — {course.name.en}</h2>
        <span class="course-level">{course.level}</span>
      </div>

      <ul class="course-details">
          <strong>Prerequisites:</strong> 
          {#if course.prerequisites && !course.prerequisites.hasTextOnly}
            {course.prerequisites.codePatterns.join(', ')}
          {:else}
            None
          {/if}
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
>>>>>>> main
