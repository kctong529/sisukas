<!-- src/App.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import Navigation from './components/Navigation.svelte';
  import FilterContainer from './components/FilterContainer.svelte';
  import CourseTable from './components/CourseTable.svelte';
  import SearchControls from './components/SearchControls.svelte';
  import NotificationContainer from './components/NotificationContainer.svelte';
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
  import type { FilterRuleGroups, FilterConfig } from './domain/filters/FilterTypes';
  
  let currentView = 'courses';
  let isSignedIn = false;
  let userName = '';

  let RuleBlueprints: any = null;
  let courses: Course[] = [];
  let filteredCourses: Course[] = [];
  let periods: AcademicPeriod[] = [];
  let filterRules: FilterRuleGroups = [];
  let showUnique = false;
  let filterContainerRef: any;
  let pendingFilterLoad: string | null = null;
  
  // Loading states
  let loading = true;
  let loadError: string | null = null;

  function handleNavigation(event: CustomEvent<string>) {
    currentView = event.detail;
    // Add routing logic here
  }
  
  function handleSignIn() {
    // Implement sign-in logic
    console.log('Sign in clicked');
  }
  
  function handleSignOut() {
    isSignedIn = false;
    userName = '';
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

      // Check for filter hash in URL and load if present
      await loadFiltersFromUrl();
      
    } catch (error) {
      loadError = `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
    if (!data) {
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
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const configs = FilterSerializer.fromJSON(data, RuleBlueprints);
        
        if (filterContainerRef) {
          filterContainerRef.loadFilterConfigs(configs);
          setTimeout(() => handleSearch(), 100);
        }
        
        NotificationService.success('Filters loaded from file');
      } catch (error) {
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

<NotificationContainer />

<div id="main-content">
  {#if currentView === 'courses'}
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
      
      <CourseTable 
        courses={filteredCourses}
      />
    {/if}
  {:else if currentView === 'saved'}
    <!-- Saved Filters View -->
    <div class="view-container">
      <h2>Saved Filters</h2>
      <p>Your saved filter configurations will appear here.</p>
    </div>
    
  {:else if currentView === 'about'}
    <!-- About View -->
    <div class="view-container">
      <h2>About Sisukas</h2>
      <p>Alternative frontend for Aalto University's SISU system.</p>
      <p><a href="https://github.com/kctong529/sisukas" target="_blank">View on GitHub</a></p>
    </div>
  {/if}
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
  
  footer {
    margin-top: 2rem;
  }
  
  #footer-text {
    font-size: 0.9em;
    color: #777;
    margin: 2%;
  }
</style>