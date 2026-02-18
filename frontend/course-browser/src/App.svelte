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
  import LegoView from './components/LegoView.svelte';
  import PeriodTimeline from './components/PeriodTimeline.svelte';
  import { authClient, useSession } from "./lib/authClient";
  import { createRuleBlueprints, type RuleBlueprintKey } from './domain/filters/blueprints';
  import type { BaseRuleBlueprint } from './domain/filters/blueprints';
  import { loadCurricula } from './infrastructure/loaders/CurriculumLoader';
  import { loadOrganizations } from './infrastructure/loaders/OrganizationLoader';
  import { loadAcademicPeriods } from './infrastructure/loaders/AcademicPeriodLoader';
  import { FilterService } from './domain/services/FilterService';
  import { FilterSerializer } from './domain/filters/helpers/FilterSerializer';
  import { FiltersApiService } from './infrastructure/services/FiltersApiService';
  import { NotificationService } from './infrastructure/services/NotificationService';
  import type { AcademicPeriod } from './domain/models/AcademicPeriod';
  import type { FilterRuleGroups } from './domain/filters/FilterTypes';
  import { courseIndexStore } from './lib/stores/courseIndexStore.svelte';
  import type { CourseIndexMode } from './lib/stores/courseIndexStore.svelte';
  import { academicPeriodStore } from './lib/stores/academicPeriodStore';
  import DebugPanels from './components/debug/DebugPanels.svelte';

  // -----------------------------
  // Local state (Svelte 5 runes)
  // -----------------------------

  const ui = $state({
    currentView: 'courses' as 'courses' | 'favourites' | 'lego' | 'timeline',
    showAuthModal: false,

    filteredInstanceIds: null as string[] | null,

    RuleBlueprints: null as Record<RuleBlueprintKey, BaseRuleBlueprint> | null,
    periods: [] as AcademicPeriod[],
    filterRules: [] as FilterRuleGroups,
    appliedFilterRules: [] as FilterRuleGroups,
    showUnique: false,

    pendingFilterLoad: null as string | null,

    // UI-level toggle (kept for compatibility with existing SearchControls/CourseTable props)
    courseBrowserSource: 'active' as 'active' | 'all',

    lastSearchKey: null as string | null,
  });

  let filterContainerRef = $state<FilterContainer | undefined>(undefined);
    let lastApplied: CourseIndexMode | null = null;

  // -----------------------------
  // External stores
  // -----------------------------

  const session = useSession();

  // -----------------------------
  // Derived values
  // -----------------------------

  const baseCourses = $derived.by(() => courseIndexStore.read.getAllCurrentCourses());

  const loadingActive = $derived.by(() => courseIndexStore.state.loading);
  const loadingHistorical = $derived.by(() => courseIndexStore.state.historicalLoading);

  const user = $derived.by(() => $session.data?.user);
  const isSignedIn = $derived.by(() => !!user);
  const userName = $derived.by(() => user?.email ?? "");

  // -----------------------------
  // Helpers
  // -----------------------------

  function toIndexMode(source: typeof ui.courseBrowserSource): CourseIndexMode {
    return source === 'active' ? 'active' : 'all';
  }

  function handleNavigation(event: CustomEvent<string>) {
    ui.currentView = event.detail as typeof ui.currentView;
  }

  function handleSignIn() {
    ui.showAuthModal = true;
  }

  function handleSignOut() {
    authClient.signOut();
  }

  // -----------------------------
  // Filters
  // -----------------------------

  async function loadFiltersFromUrl(hashId?: string) {
    const id = hashId ?? FiltersApiService.getHashFromUrl();
    if (!id) return;

    // fetch early
    const data = await FiltersApiService.loadFilters(id);
    if (!data) return;

    // apply only when ready
    if (!ui.RuleBlueprints || !filterContainerRef) {
      ui.pendingFilterLoad = id;
      return;
    }

    const configs = FilterSerializer.fromJSON(data, ui.RuleBlueprints);
    filterContainerRef.loadFilterConfigs(configs);
    queueMicrotask(handleSearch);

    NotificationService.success('Loaded filters from shared link');
  }

  // Pending filter load once FilterContainer ref is ready
  $effect(() => {
    if (!filterContainerRef) return;
    if (!ui.RuleBlueprints) return;
    if (!ui.pendingFilterLoad) return;

    const hash = ui.pendingFilterLoad;
    ui.pendingFilterLoad = null;

    void loadFiltersFromUrl(hash).catch((e) => {
      console.error('Failed to load filters from URL:', e);
      ui.pendingFilterLoad = hash;
    });
  });

  // -----------------------------
  // Search / Results
  // -----------------------------

  function rerunAppliedSearch() {
    if (!ui.RuleBlueprints) return;

    if (ui.appliedFilterRules.length === 0) {
      const final = ui.showUnique
        ? FilterService.getUniqueCourses(baseCourses)
        : baseCourses;

      ui.filteredInstanceIds = final.map((c) => c.id);
      return;
    }

    const results = FilterService.applyFilters(baseCourses, ui.appliedFilterRules);
    const final = ui.showUnique
      ? FilterService.getUniqueCourses(results)
      : results;

    ui.filteredInstanceIds = final.map((c) => c.id);
  }

  // Auto-rerun when relevant inputs change
  $effect(() => {
    if (loadingActive) return;
    if (!ui.RuleBlueprints) return;

    const key = [
      courseIndexStore.state.mode,
      courseIndexStore.state.byInstanceId.size,
      courseIndexStore.state.historicalByInstanceId.size,
      courseIndexStore.state.historicalReady ? 'h1' : 'h0',
      ui.showUnique ? 'u1' : 'u0',
      JSON.stringify(ui.appliedFilterRules), // simplest correct version
    ].join('|');

    if (key === ui.lastSearchKey) return;
    ui.lastSearchKey = key;

    rerunAppliedSearch();
  });

  function handleSearch() {
    ui.appliedFilterRules = ui.filterRules;

    if (!ui.RuleBlueprints || ui.filterRules.length === 0) {
      const final = ui.showUnique
        ? FilterService.getUniqueCourses(baseCourses)
        : baseCourses;

      ui.filteredInstanceIds = final.map((c) => c.id);
      return;
    }

    const results = FilterService.applyFilters(baseCourses, ui.filterRules);
    const final = ui.showUnique
      ? FilterService.getUniqueCourses(results)
      : results;

    ui.filteredInstanceIds = final.map((c) => c.id);
  }

  async function handleSourceChange() {
    await courseIndexStore.actions.setMode(toIndexMode(ui.courseBrowserSource));
    rerunAppliedSearch();
  }

  // -----------------------------
  // Save / Load filters
  // -----------------------------

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
      if (!hashId) throw new Error('Failed to get hash ID');

      const shareableUrl = FiltersApiService.createShareableUrl(hashId);

      try {
        await navigator.clipboard.writeText(shareableUrl);
        NotificationService.success('Filter link copied to clipboard!');
      } catch {
        NotificationService.success('Filters saved successfully!');
      }

      setTimeout(() => {
        window.location.href = shareableUrl;
      }, 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save filters';
      NotificationService.error(message);
    }
  }

  function handleLoadFilters() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file || !ui.RuleBlueprints) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const configs = FilterSerializer.fromJSON(data, ui.RuleBlueprints);

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
    filterContainerRef?.addFilterRule();
  }

  $effect(() => {
    const want = toIndexMode(ui.courseBrowserSource);
    if (want === lastApplied) return;

    lastApplied = want;
    void courseIndexStore.actions.setMode(want);
  });

  // -----------------------------
  // Bootstrapping
  // -----------------------------

  onMount(async () => {
    try {
      // Academic periods (sync)
      ui.periods = loadAcademicPeriods();
      academicPeriodStore.setPeriods(ui.periods);

      // Organizations (sync)
      const organizations = loadOrganizations();

      const curriculaPromise = loadCurricula();

      // Start filter loading immediately
      const hashId = FiltersApiService.getHashFromUrl();
      if (hashId) void loadFiltersFromUrl(hashId);

      // Curricula (async)
      const curriculaMap = await curriculaPromise;

      // Blueprints
      ui.RuleBlueprints = createRuleBlueprints({
        curriculaMap,
        organizations,
        periods: ui.periods,
      });

      // Align course index mode with UI selection (loads historical if needed)
      await courseIndexStore.actions.setMode(toIndexMode(ui.courseBrowserSource));

      // Active required
      const { activeCount } = await courseIndexStore.actions.bootstrapActive();
      console.log('Active loaded:', activeCount);

      // Optional warm-up: preload historical even when starting in active
      void (async () => {
        try {
          const { historicalCount, mergedSnapshots } =
            await courseIndexStore.actions.ensureHistoricalLoaded();
          console.log('Historical loaded:', historicalCount, 'snapshots:', mergedSnapshots);
        } catch (e) {
          console.error('Historical ensure failed:', e);
        } finally {
          if (courseIndexStore.state.mode === 'all') rerunAppliedSearch();
        }
      })();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  });
</script>

<main class="app-main">
  <Navigation
    currentView={ui.currentView}
    {isSignedIn}
    {userName}
    on:navigate={handleNavigation}
    on:signin={handleSignIn}
    on:signout={handleSignOut}
  />

  <DebugPanels />

  {#if ui.showAuthModal}
    <AuthModal on:close={() => (ui.showAuthModal = false)} />
  {/if}

  <NotificationContainer />

  <div id="main-content">
    <!-- Courses View -->
    <div class="view" class:hidden={ui.currentView !== 'courses'}>
      <h2 class="sr-only">Browse Courses</h2>

      {#if loadingHistorical && courseIndexStore.state.mode === 'all'}
        <p class="hint">Loading older courses...</p>
      {/if}

      {#if loadingActive}
        <div style="text-align: center; padding: 2rem;">
          <p>Loading course data...</p>
        </div>
      {:else if ui.RuleBlueprints}
        <FilterContainer
          bind:this={filterContainerRef}
          blueprints={ui.RuleBlueprints as Record<string, BaseRuleBlueprint>}
          bind:filterRules={ui.filterRules}
          periods={ui.periods}
          on:search={handleSearch}
        />

        <SearchControls
          bind:showUnique={ui.showUnique}
          bind:source={ui.courseBrowserSource}
          on:addRule={handleAddRule}
          on:search={handleSearch}
          on:sourceChange={handleSourceChange}
          on:save={handleSaveFilters}
          on:load={handleLoadFilters}
        />

        <CourseTable
          source={ui.courseBrowserSource}
          filteredInstanceIds={ui.filteredInstanceIds}
        />
      {:else}
        <div style="text-align: center; padding: 2rem;">
          <p>Failed to load filter blueprints. Please refresh the page.</p>
        </div>
      {/if}
    </div>

    <!-- Favourites View -->
    <div class="view" class:hidden={ui.currentView !== 'favourites'}>
      <FavouritesView
        bind:source={ui.courseBrowserSource}
      />
    </div>

    <!-- LEGO View -->
    <div class="view" class:hidden={ui.currentView !== 'lego'}>
      <LegoView />
    </div>

    <!-- Period Timeline View -->
    <div class="view" class:hidden={ui.currentView !== 'timeline'}>
      <PeriodTimeline />
    </div>
  </div>

  <footer>
    <p id="footer-text">© 2026 Sisukas. All rights reserved.</p>
  </footer>
</main>

<style>
  :global(body) {
    margin: 0;
    overflow-x: hidden;
    font-family: sans-serif;
    font-size: clamp(10px, 1.3vw, 15px);
    background-color: #f8fafc;
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
    min-height: 80vh;
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
