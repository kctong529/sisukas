<!-- src/components/FavouritesView.svelte -->
<script lang="ts">
  import { useSession } from '../lib/authClient';
  import { favouritesStore } from '../lib/stores/favouritesStore';
  import { plansStore } from '../lib/stores/plansStore.svelte';
  import { courseIndexStore } from '../lib/stores/courseIndexStore.svelte';
  import { studyGroupStore } from '../lib/stores/studyGroupStore';
  import { courseGradeStore } from '../lib/stores/courseGradeStore';
  import { NotificationService } from '../infrastructure/services/NotificationService';
  import StudyGroupsSection from './StudyGroupsSection.svelte';
  import type { Course } from '../domain/models/Course';
  import PlanManager from './PlanManager.svelte';
  import type { Favourite } from '../infrastructure/services/FavouritesService';
  import PlanEditor from './PlanEditor.svelte';

  let { source = $bindable("active") } = $props<{ source?: "active" | "all" }>();

  const session = useSession();
  const user = $derived.by(() => $session.data?.user);
  const isSignedIn = $derived.by(() => !!user);

  const activePlan = $derived.by(() => plansStore.read.getActive());
  const activePlanId = $derived.by(() => activePlan?.id ?? null);

  type Unsubscriber = () => void;
  type Subscribable<T> = { subscribe(run: (value: T) => void): Unsubscriber };

  function isSubscribable<T>(x: unknown): x is Subscribable<T> {
    return !!x && typeof (x as { subscribe?: unknown }).subscribe === "function";
  }

  type FavouritesStoreValue = {
    favourites?: Favourite[];
    loading?: boolean;
    error?: string | null;
  };

  const favState = $state<{
    favourites: Favourite[];
    loading: boolean;
    error: string | null;
  }>({
    favourites: [],
    loading: false,
    error: null,
  });

  $effect(() => {
    const unsubs: Unsubscriber[] = [];

    if (isSubscribable<FavouritesStoreValue>(favouritesStore)) {
      unsubs.push(
        favouritesStore.subscribe((v) => {
          favState.favourites = v?.favourites ?? [];
          favState.loading = !!v?.loading;
          favState.error = v?.error ?? null;
        })
      );
    }

    return () => unsubs.forEach((u) => u());
  });

  const ui = $state({
    sortBy: 'addedAt' as 'addedAt' | 'courseId' | 'courseName' | 'credits' | 'startDate',
    sortDirection: -1 as 1 | -1,

    editingCourseId: null as string | null,
    editingNotes: '',

    hasLoadedForUser: false,
    hasInitializedPlans: false,
    hasInitializedGrades: false,

    removeMode: false,

    sortedFavourites: [] as Favourite[],
  });

  let expandedInstanceIds = $state<Set<string>>(new Set());
  let isPlanningSwitching = $state(false);
  let prevPlanId: string | null = null;
  let lastSig = "";
  let fetchTimer: number | null = null;

  const planInstanceIds = $derived.by(() => new Set(activePlan?.instanceIds ?? []));
  const expandedIds = $derived.by(() => expandedInstanceIds);

  async function toggleAll() {
    source = source === "active" ? "all" : "active";
  }

  // ---- Sign-in driven init/cleanup ----
  $effect(() => {
    if (!isSignedIn) {
      favouritesStore.clear?.();
      plansStore.actions.clear();
      courseGradeStore.clear?.();

      expandedInstanceIds = new Set();
      ui.hasLoadedForUser = false;
      ui.hasInitializedPlans = false;
      ui.hasInitializedGrades = false;
      ui.editingCourseId = null;
      ui.editingNotes = '';
      ui.removeMode = false;
      ui.sortedFavourites = [];
      return;
    }

    if (!ui.hasLoadedForUser) {
      void favouritesStore.load?.();
      ui.hasLoadedForUser = true;
    }
  });

  $effect(() => {
    if (!isSignedIn) return;
    if (!ui.hasLoadedForUser) return;
    if (source !== "active") return;
    if (favState.favourites.length === 0) return;

    const needsHistorical = favState.favourites.some(
      (f) => courseIndexStore.read.getCurrentInstancesByCode(f.courseId).length === 0
    );

    if (needsHistorical) {
      void courseIndexStore.actions.ensureHistoricalLoaded?.();
    }
  });

  $effect(() => {
    if (!isSignedIn) return;
    if (!ui.hasLoadedForUser) return;
    if (ui.hasInitializedPlans) return;

    void initializePlans();
  });

  $effect(() => {
    if (!isSignedIn) return;
    if (!ui.hasLoadedForUser) return;
    if (ui.hasInitializedGrades) return;

    try {
      void courseGradeStore.load?.();
    } catch (err) {
      console.error('Failed to initialize grades:', err);
    } finally {
      ui.hasInitializedGrades = true;
    }
  });

  async function initializePlans() {
    try {
      await plansStore.actions.ensureDefaultPlan();
      
      // Initialize expanded state with plan instances
      if (activePlan?.instanceIds && activePlan.instanceIds.length > 0) {
        expandedInstanceIds = new Set(activePlan.instanceIds);
      }
    } catch (err) {
      console.error('Failed to initialize plans:', err);
    } finally {
      ui.hasInitializedPlans = true;
    }
  }

  const planInstanceIdByCode = $derived.by(() => {
    const m = new Map<string, string>();
    const ids = activePlan?.instanceIds ?? [];

    for (const id of ids) {
      const c = courseIndexStore.read.resolveByInstanceId(id);
      if (c) m.set(c.code.value, id);
    }

    return m;
  });

  // ---- Plan switch detection and state sync ----
  $effect(() => {
    if (activePlanId !== prevPlanId) {
      // Clear old expanded state
      expandedInstanceIds = new Set();
      prevPlanId = activePlanId;
      
      if (ui.hasInitializedPlans && activePlan && activePlan.instanceIds && activePlan.instanceIds.length > 0) {
        expandedInstanceIds = new Set(activePlan.instanceIds);
      }
    }
  });

  // ---- Study group batch fetch (active view only) ----
  $effect(() => {
    if (!ui.hasLoadedForUser) return;
    if (ui.sortedFavourites.length === 0) return;
    if (source !== "active") return;

    const reqs: Array<{ courseUnitId: string; courseOfferingId: string }> = [];
    const seen = new Set<string>();

    for (const fav of ui.sortedFavourites) {
      for (const course of getCoursesForId(fav.courseId)) {
        const k = `${course.unitId}:${course.id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        reqs.push({ courseUnitId: course.unitId, courseOfferingId: course.id });
      }
    }

    const sig = [
      `plan:${activePlanId ?? "none"}`,
      ...reqs.map(r => `${r.courseUnitId}:${r.courseOfferingId}`).sort().slice(0, 200),
    ].join("|");

    if (sig === lastSig) return;
    if (fetchTimer) window.clearTimeout(fetchTimer);
    lastSig = sig;

    fetchTimer = window.setTimeout(() => {
      void studyGroupStore.fetchWithStaleWhileRevalidate(reqs);
    }, 50);

    return () => {
      if (fetchTimer) window.clearTimeout(fetchTimer);
      fetchTimer = null;
    };
  });

  // ---- Course resolution helpers ----
  function getCoursesForId(code: string): Course[] {
    let courses = courseIndexStore.read.getCurrentInstancesByCode(code);

    if (courses.length === 0) {
      courses = courseIndexStore.read.getHistoricalInstancesByCode?.(code) ?? courses;
    }

    const selectedId = planInstanceIdByCode.get(code);
    if (!selectedId) return courses;

    if (!courses.some((c) => c.id === selectedId)) {
      const selected = courseIndexStore.read.resolveByInstanceId(selectedId);
      if (selected) courses = [selected, ...courses];
    }

    return courses;
  }

  // Build sorted favourites whenever deps change
  $effect(() => {
    const primary = (courseId: string) => getCoursesForId(courseId)[0];

    ui.sortedFavourites = [...favState.favourites].sort((a, b) => {
      switch (ui.sortBy) {
        case 'courseId':
          return a.courseId.localeCompare(b.courseId) * ui.sortDirection;

        case 'courseName': {
          const nameA = primary(a.courseId)?.name?.en ?? a.courseId;
          const nameB = primary(b.courseId)?.name?.en ?? b.courseId;
          return nameA.localeCompare(nameB) * ui.sortDirection;
        }

        case 'credits': {
          const creditsA = primary(a.courseId)?.credits?.min ?? 0;
          const creditsB = primary(b.courseId)?.credits?.min ?? 0;
          return (creditsA - creditsB) * ui.sortDirection;
        }

        case 'startDate': {
          const tA = primary(a.courseId)?.courseDate?.start?.getTime?.() ?? 0;
          const tB = primary(b.courseId)?.courseDate?.start?.getTime?.() ?? 0;
          return (tA - tB) * ui.sortDirection;
        }

        case 'addedAt':
        default: {
          const tA = new Date(a.addedAt).getTime();
          const tB = new Date(b.addedAt).getTime();
          return (tA - tB) * ui.sortDirection;
        }
      }
    });
  });

  function startEditingNotes(courseId: string, notes: string | null) {
    ui.editingCourseId = courseId;
    ui.editingNotes = notes || '';
  }

  function cancelEditingNotes() {
    ui.editingCourseId = null;
    ui.editingNotes = '';
  }

  async function saveNotes(courseId: string) {
    try {
      await favouritesStore.updateNotes(courseId, ui.editingNotes || null);
      ui.editingCourseId = null;
      ui.editingNotes = '';
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  }

  async function removeFavourite(courseId: string) {
    try {
      await favouritesStore.remove(courseId);
    } catch (err) {
      console.error('Failed to remove favourite:', err);
    }
  }

  function exitRemoveMode() {
    ui.removeMode = false;
  }

  function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ` at ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
    );
  }

  function toggleInstance(courseCode: string, instanceId: string) {
    if (isPlanningSwitching) return;

    const inPlan = activePlan?.instanceIds?.includes(instanceId) ?? false;
    const isCurrentlyExpanded = expandedInstanceIds.has(instanceId);
    const courses = getCoursesForId(courseCode);

    // If this instance is in the plan, clicking it removes it from the plan
    if (inPlan) {
      NotificationService.error(`Instance removed from ${activePlan?.name ?? 'plan'}`);
      
      // Remove from expanded
      const newExpanded = new Set(expandedInstanceIds);
      newExpanded.delete(instanceId);
      expandedInstanceIds = newExpanded;
      
      // Then remove from plan
      void removedInstanceFromPlan(instanceId);
      return;
    }

    // For non-plan instances: normal expand/collapse toggle
    // Remove all siblings of THIS course
    const newExpanded = new Set(expandedInstanceIds);
    for (const id of expandedInstanceIds) {
      if (courses.some(c => c.id === id)) {
        newExpanded.delete(id);
      }
    }

    if (isCurrentlyExpanded) {
      // Collapsing - already removed by loop above
    } else {
      // Expanding: add this instance
      newExpanded.add(instanceId);

      const activeHit = courseIndexStore.read.resolveByInstanceId(instanceId);
      if (activeHit) {
        studyGroupStore.fetch(activeHit.unitId, activeHit.id);
      }
    }
    
    expandedInstanceIds = newExpanded;
  }

  async function removedInstanceFromPlan(instanceId: string) {
    try {
      await plansStore.actions.removeInstanceFromActivePlan(instanceId);
      
      // After the plan update completes, ensure it's removed from expanded too
      const newExpanded = new Set(expandedInstanceIds);
      newExpanded.delete(instanceId);
      expandedInstanceIds = newExpanded;
    } catch (err) {
      console.error('Failed to remove instance from plan:', err);
    }
  }

  async function addInstanceToActivePlan(instanceId: string) {
    try {
      if (!activePlan) {
        NotificationService.error('No active plan');
        return;
      }

      await plansStore.actions.addInstanceToActivePlan(instanceId);
      NotificationService.success(`Instance added to ${activePlan.name}`);
      
      // Ensure it's in expanded state
      if (!expandedInstanceIds.has(instanceId)) {
        const newExpanded = new Set(expandedInstanceIds);
        newExpanded.add(instanceId);
        expandedInstanceIds = newExpanded;
      }
    } catch (err) {
      console.error('Failed to add instance to plan:', err);
      NotificationService.error('Failed to add instance to plan');
    }
  }
</script>

<div class="favourites-container">
  {#if !isSignedIn}
    <div class="state-card">
      <div class="icon-circle">👤</div>
      <h2>Sign in to save favourites</h2>
      <p>Create an account to keep track of your courses across devices.</p>
    </div>

  {:else if favState.loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Fetching your collection...</p>
    </div>

  {:else if favState.error}
    <div class="state-card error">
      <h2>Something went wrong</h2>
      <p>{favState.error}</p>
      <button class="btn btn-secondary" onclick={() => favouritesStore.load()}>
        Try Again
      </button>
    </div>

  {:else if favState.favourites.length === 0}
    <div class="header-section">
      <div class="title-group">
        <h2>Your Favourites</h2>
      </div>

      <div class="plan-controls">
        <PlanManager compact={true} />
        <PlanEditor plan={activePlan} />
      </div>
    </div>

    <div class="state-card">
      <div class="icon-circle">♥</div>
      <h2>Your list is empty</h2>
      <p>Start exploring courses and click the heart icon to add them here.</p>
      <a href="/" class="btn btn-primary">Browse Courses</a>
    </div>

  {:else}
    <div class="header-section">
      <div class="title-group">
        <h2>Your Favourites</h2>
      </div>

      <div class="plan-controls">
        <PlanManager compact={true} />
        <PlanEditor plan={activePlan} />
      </div>

      <div class="controls">
        {#if ui.removeMode}
          <button class="btn btn-secondary" onclick={exitRemoveMode}>
            Done
          </button>
        {:else}
          <div class="sort-box">
            <label for="sort">Sort by:</label>
            <select
              id="sort"
              bind:value={ui.sortBy}
            >
              <option value="addedAt">Recently Added</option>
              <option value="courseId">Course Code</option>
              <option value="courseName">Course Name</option>
              <option value="credits">Credits</option>
              <option value="startDate">Start Date</option>
            </select>

            <button
              type="button"
              class="sort-dir"
              onclick={() => {
                ui.sortDirection = (ui.sortDirection * -1) as 1 | -1;
              }}
              aria-label="Toggle sort direction"
            >
              {ui.sortDirection === 1 ? '↑' : '↓'}
            </button>
          </div>

          <button
            type="button"
            class="btn btn-secondary older-btn"
            class:active={source === "all"}
            aria-pressed={source === "all"}
            onclick={toggleAll}
            title={source === "all" ? 'Showing historical course instances' : 'Showing active course instances'}
          >
            {source === "all" ? 'See Active' : 'See Older'}
          </button>

          <button
            type="button"
            class="btn btn-secondary remove-btn-sec"
            onclick={() => { ui.removeMode = true; }}
          >
            Remove
          </button>
        {/if}
      </div>
    </div>

    <div class="favourites-list">
      {#each ui.sortedFavourites as favourite (favourite.courseId)}
        {@const courses = [...getCoursesForId(favourite.courseId)].sort(
          (a, b) => a.courseDate.start.getTime() - b.courseDate.start.getTime()
        )}

        <!-- show only the expanded instance (if any), otherwise show all -->
        {@const expandedHit = courses.find((c) => expandedIds.has(c.id))}
        {@const visibleInstances = expandedHit ? [expandedHit] : courses}

        <!-- add button: only when an expanded instance exists and isn't in plan -->
        {@const instanceToAdd =
          activePlan
            ? courses.find((c) => expandedIds.has(c.id) && !planInstanceIds.has(c.id)) ?? null
            : null
        }

        <div class="favourite-item" class:remove-mode={ui.removeMode}>
          <div class="item-header">
            <div class="code-and-info">
              <a
                href="https://sisu.aalto.fi/student/courseunit/{courses[0]?.unitId}/brochure"
                target="_blank"
                rel="noreferrer"
                class="course-code-link"
              >
                <h3 class="course-code">{favourite.courseId}</h3>
              </a>

              {#if courses.length > 0}
                <p class="course-name">{courses[0].name.en.split(',').slice(0, -1).join(',')}</p>
              {/if}

              <div class="metadata">
                <span class="added-date">Added {formatDateTime(favourite.addedAt)}</span>
              </div>
            </div>

            {#if ui.removeMode}
              <button
                type="button"
                class="remove-btn"
                onclick={() => removeFavourite(favourite.courseId)}
                aria-label="Remove from favourites"
                title="Remove from favourites"
              >
                ✕
              </button>
            {:else}
              {#if instanceToAdd}
                <button
                  type="button"
                  class="add-btn"
                  aria-label="Add to active plan"
                  title="Add to {activePlan?.name || 'plan'}"
                  onclick={async () => {
                    await addInstanceToActivePlan(instanceToAdd.id);
                  }}
                >
                  +
                </button>
              {/if}
            {/if}
          </div>

          {#if !ui.removeMode}
            <div class="instances-container">
              {#each visibleInstances as course (course.id)}
                {@const inPlan = planInstanceIds.has(course.id)}
                {@const isExpanded = expandedIds.has(course.id) || inPlan}

                <div
                  class="instance {isExpanded ? 'selected' : ''} {inPlan ? 'in-plan' : ''}"
                  role="button"
                  tabindex="0"
                  onclick={(e) => {
                    const t = e.target as HTMLElement;
                    if (t.closest('.study-group-button') == null) {
                      toggleInstance(favourite.courseId, course.id);
                    }
                  }}
                  onkeydown={(e) => e.key === 'Enter' && toggleInstance(favourite.courseId, course.id)}
                >
                  <div class="instance-top">
                    <div class="instance-dates">
                      <span class="date-range">
                        {formatDate(course.courseDate.start)} – {formatDate(course.courseDate.end)}
                      </span>
                    </div>

                    <div class="format-badge" data-format={course.format}>
                      {course.format}
                    </div>
                  </div>

                  {#if isExpanded}
                    <div role="presentation" onclick={(e) => e.stopPropagation()}>
                      <StudyGroupsSection {course} isExpanded={isExpanded} />
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <div class="notes-section">
            {#if ui.editingCourseId === favourite.courseId}
              <div class="editor">
                <textarea
                  bind:value={ui.editingNotes}
                  placeholder="Add your notes here..."
                  aria-label="Edit notes"
                ></textarea>

                <div class="editor-actions">
                  <button
                    type="button"
                    class="btn-text save"
                    onclick={() => saveNotes(favourite.courseId)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    class="btn-text cancel"
                    onclick={cancelEditingNotes}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            {:else}
              <div class="display">
                <p class:placeholder={!favourite.notes}>
                  {favourite.notes || ''}
                </p>

                {#if favourite.notes}
                  <button
                    type="button"
                    class="edit-trigger"
                    onclick={() => startEditingNotes(favourite.courseId, favourite.notes)}
                  >
                    Edit note
                  </button>
                {:else}
                  <button
                    type="button"
                    class="edit-trigger"
                    onclick={() => startEditingNotes(favourite.courseId, null)}
                  >
                    + Add note
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  :root {
    --primary: #4a90e2;
    --primary-hover: #2980f1;
    --bg: #f8fafc;
    --card-bg: #ffffff;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --danger: #ef4444;
    --border: #e2e8f0;
    --success: #10b981;
  }

  .favourites-container {
    max-width: 1400px;
    margin: 1.5rem auto;
    padding: 0 1rem;
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--text-main);
  }

  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .title-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .plan-controls {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    flex-wrap: wrap;
    min-width: 0;
  }

  h2 {
    font-size: 1.3rem;
    font-weight: 600;
    margin: 0;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--primary);
  }

  p {
    margin: 0;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--text-main);
    font-size: 0.8rem;
    flex-wrap: wrap;
  }

  .sort-box {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .controls label {
    white-space: nowrap;
    font-weight: 500;
  }

  select {
    flex: 1;
    padding: 0.5rem 0.8rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    background: #ffffff;
    color: #1e293b;
    appearance: none;
    height: 32.5px;
  }

  select:hover {
    border-color: var(--primary);
  }

  select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .sort-dir {
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.8rem;
    color: var(--text-main);
    min-width: 32.5px;
    text-align: center;
  }

  .sort-dir:hover {
    border-color: var(--primary);
    background: #f1f5f9;
  }

  .sort-dir:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .favourites-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(253px, 1fr));
    gap: 0.3rem;
  }

  .favourite-item {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .favourite-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  .favourite-item.remove-mode {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
    gap: 1rem;
  }

  .code-and-info {
    flex: 1;
  }

  .course-code {
    color: var(--primary);
  }

  .course-code-link {
    text-decoration: none;
    transition: opacity 0.2s;
  }

  .course-code-link:hover {
    opacity: 0.8;
  }

  .course-code-link:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .course-name {
    font-size: 0.85rem;
    color: #333;
    line-height: 1.2;
    margin-top: 0.1rem;
  }

  .remove-btn {
    background: transparent;
    border: none;
    color: var(--danger);
    cursor: pointer;
    font-size: 1.2rem;
    transition: color 0.2s, transform 0.2s;
    padding: 0;
    flex-shrink: 0;
  }

  .remove-btn:hover {
    color: #991b1b;
    transform: scale(1.1);
  }

  .remove-btn:focus {
    outline: 2px solid var(--danger);
    outline-offset: 2px;
  }

  .instances-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .add-btn {
    background: transparent;
    border: none;
    color: var(--primary);
    cursor: pointer;
    font-size: 1.5rem;
    transition: color 0.2s, transform 0.2s;
    padding: 0;
    flex-shrink: 0;
  }

  .add-btn:hover {
    color: var(--primary-hover);
    transform: scale(1.1);
  }

  .add-btn:focus {
    outline: none;
  }

  .instance {
    background: #f9fafb;
    padding: 0.45rem;
    border-radius: 6px;
    border: 1px solid #f0f0f0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s;
  }

  .instance:hover {
    background: #eff6ff;
    transform: translateY(-1px);
  }

  .instance.selected {
    background: rgb(205, 255, 205);
    border-color: var(--primary);
  }

  .instance-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .instance-dates {
    flex: 1;
    min-width: 0;
  }

  .date-range {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--primary);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .format-badge {
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .format-badge[data-format="lecture"] {
    background: #dbeafe;
    color: #1e40af;
  }

  .format-badge[data-format="exam"] {
    background: #fee2e2;
    color: #991b1b;
  }

  .format-badge[data-format="thesis"] {
    background: #fce7f3;
    color: #9f1239;
  }

  .format-badge[data-format="other"] {
    background: #f3f4f6;
    color: #374151;
  }

  .metadata {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.35rem;
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .added-date {
    font-style: italic;
  }

  .notes-section {
    background: #f1f5f9;
    padding: 0.6rem;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }

  .notes-section p {
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--text-main);
    padding-bottom: 0.45rem;
  }

  .notes-section p:empty {
    padding: 0;
  }

  .notes-section p.placeholder {
    color: var(--text-muted);
    font-style: italic;
  }

  .display {
    display: flex;
    flex-direction: column;
  }

  .edit-trigger {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    text-decoration: none;
    align-self: flex-start;
    transition: text-decoration 0.2s;
  }

  .edit-trigger:hover {
    text-decoration: underline;
  }

  .edit-trigger:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-grow: 1;
  }

  textarea {
    min-height: 60px;
    padding: 0.4rem;
    border: 1px solid var(--border);
    border-radius: 3px;
    font-family: inherit;
    font-size: 0.85rem;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 5px rgba(79, 70, 229, 0.3);
  }

  .editor-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-text {
    padding: 0.4rem 0.8rem;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.8rem;
    transition: all 0.2s;
    flex: 1;
  }

  .btn-text.save {
    background: var(--primary);
    color: white;
  }

  .btn-text.save:hover {
    background: var(--primary-hover);
  }

  .btn-text.save:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .btn-text.cancel {
    background: #f0f0f0;
    color: #333;
  }

  .btn-text.cancel:hover {
    background: #e0e0e0;
  }

  .btn-text.cancel:focus {
    outline: 2px solid #999;
    outline-offset: 2px;
  }

  .remove-btn-sec:hover:not(:disabled) {
    background-color: #d9534f;
    color: white;
    border-color: white;
  }

  .state-card {
    text-align: center;
    padding: 5rem 2rem;
    background: var(--card-bg);
    border-radius: 16px;
    border: 2px dashed var(--border);
  }

  .icon-circle {
    width: 80px;
    height: 80px;
    background: var(--bg);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    margin: 0 auto 1.5rem;
  }

  .state-card h2 {
    font-size: 1.4rem;
    margin-bottom: 0.5rem;
  }

  .state-card p {
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }

  .state-card.error {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .state-card.error h2 {
    color: #ef4444;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    text-align: center;
  }

  .btn {
    display: inline-block;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s;
    text-decoration: none;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
    border: none;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
  }

  .btn-primary:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .btn-secondary {
    background: var(--card-bg);
    color: var(--text-main);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.8rem;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    border-color: var(--primary);
    background: #f1f5f9;
  }

  .btn-secondary:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  @media (max-width: 410px) {
    .header-section {
      flex-direction: column;
      align-items: flex-start;
    }

    .plan-controls {
      flex-direction: column;
      width: 100%;
    }
  }
</style>
