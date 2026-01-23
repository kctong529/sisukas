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
  import { createRuleBlueprints, type RuleBlueprintKey } from './domain/filters/blueprints';
  import type { BaseRuleBlueprint } from './domain/filters/blueprints';
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
  import { courseIndexStore } from './lib/stores/courseIndexStore';
  import { academicPeriodStore } from './lib/stores/academicPeriodStore';
  import DebugPanels from './components/DebugPanels.svelte';
  import LegoView from './components/LegoView.svelte';
  
  let currentView = 'courses';
  let isSignedIn = false;
  let userName = '';

  let RuleBlueprints: Record<RuleBlueprintKey, BaseRuleBlueprint> | null = null;
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
      academicPeriodStore.setPeriods(periods);
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

      // Build course indexes using courseIndexStore
      courseIndexStore.setCourses(courses);
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

<DebugPanels />

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
        blueprints={RuleBlueprints as Record<string, BaseRuleBlueprint>} 
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

  <!-- LEGO View -->
  <div 
    class="view" 
    class:hidden={currentView !== 'lego'}
  >
    <LegoView />
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