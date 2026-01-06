<!-- src/App.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import FilterContainer from './components/FilterContainer.svelte';
  import CourseTable from './components/CourseTable.svelte';
  import SearchControls from './components/SearchControls.svelte';
  import { createRuleBlueprints } from './domain/filters/blueprints';
  import { loadCurricula } from './infrastructure/loaders/CurriculumLoader';
  import { loadCoursesWithCache } from './infrastructure/loaders/RemoteCourseLoader';
  import { loadAcademicPeriods } from './infrastructure/loaders/AcademicPeriodLoader';
  import { FilterService } from './domain/services/FilterService';
  import type { Course } from './domain/models/Course';
  import type { AcademicPeriod } from './domain/models/AcademicPeriod';
  import type { FilterRuleGroups } from './domain/filters/types';
  
  let RuleBlueprints: any = null;
  let courses: Course[] = [];
  let filteredCourses: Course[] = [];
  let periods: AcademicPeriod[] = [];
  let filterRules: FilterRuleGroups = [];
  let showUnique = false;
  
  // Loading states
  let loading = true;
  let loadError: string | null = null;
  
  // Initialize data on mount
  onMount(async () => {
    try {
      // Load academic periods (synchronous)
      periods = loadAcademicPeriods();
      console.log("Academic Periods loaded:", periods);
      
      // Load curricula data
      const curriculaMap = await loadCurricula();
      console.log("Curricula loaded:", curriculaMap);
      
      // Initialize blueprints with curricula data
      RuleBlueprints = createRuleBlueprints({ curriculaMap });
      console.log("Rule blueprints initialized");
      
      // Load courses with cache
      courses = await loadCoursesWithCache();
      filteredCourses = [...courses];
      console.log("Courses loaded:", courses.length);
      
    } catch (error) {
      loadError = `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error("Error loading data:", error);
    } finally {
      loading = false;
    }
  });
  
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
  
  function handleSaveFilters() {
    // TODO: Implement save functionality
    console.log("Save filters:", filterRules);
  }
  
  function handleLoadFilters() {
    // TODO: Implement load functionality
    console.log("Load filters");
  }

  let filterContainerRef: any;
  
  function handleAddRule() {
    if (filterContainerRef) {
      filterContainerRef.addFilterRule();
    }
  }
</script>

<svelte:head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css">
</svelte:head>

<div id="title-container">
  <h1>Sisukas</h1>
  <h2><a href="https://github.com/kctong529/sisukas">since 2025</a></h2>
</div>

<p id="dedication">// Dedicated to every cursed soul in Hel</p>

<div id="global-container">
  {#if loading}
    <div style="text-align: center; padding: 2rem;">
      <p>Loading course data...</p>
    </div>
  {:else if loadError}
    <div style="text-align: center; padding: 2rem;">
      <p style="color: red;">Error: {loadError}</p>
      <button on:click={() => window.location.reload()}>Retry</button>
    </div>
  {:else}
    <FilterContainer 
      bind:this={filterContainerRef}
      blueprints={RuleBlueprints} 
      bind:filterRules 
      on:search={handleSearch}
    />
    
    <SearchControls 
      bind:showUnique 
      on:addRule={handleAddRule}
      on:search={handleSearch}
      on:save={handleSaveFilters}
      on:load={handleLoadFilters}
    />
    
    <CourseTable 
      courses={filteredCourses}
    />
    
    <footer>
      <p id="footer-text">© 2026 Sisukas. All rights reserved.</p>
    </footer>
  {/if}
</div>

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
  
  #title-container {
    float: right;
    padding: 2px 5% 0 0;
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
  
  #dedication {
    font-family: cursive;
    font-size: 1.2em;
    color: #888;
    padding-left: 2%;
  }
  
  #global-container {
    position: absolute;
    width: 100%;
    margin-top: 9em;
  }
  
  .loading-state,
  .error-state {
    text-align: center;
    padding: 2rem;
  }
  
  .error-state button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background-color: #4a90e2;
    color: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
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