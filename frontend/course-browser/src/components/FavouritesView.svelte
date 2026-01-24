<!-- src/components/FavouritesView.svelte (updated) -->
<script lang="ts">
  import { useSession } from '../lib/authClient';
  import { favouritesStore } from '../lib/stores/favouritesStore';
  import { plansStore } from '../lib/stores/plansStore';
  import { courseIndexStore } from '../lib/stores/courseIndexStore';
  import { studyGroupStore } from '../lib/stores/studyGroupStore';
  import { NotificationService } from '../infrastructure/services/NotificationService';
  import StudyGroupsSection from './StudyGroupsSection.svelte';
  import type { Course } from '../domain/models/Course';
  import { SvelteSet } from 'svelte/reactivity';
  import PlanManager from './PlanManager.svelte';

  const session = useSession();
  $: isSignedIn = !!$session.data?.user;
  
  let sortBy = 'addedAt';
  let sortDirection = -1;
  let editingCourseId: string | null = null;
  let editingNotes: string = '';
  let hasLoadedForUser = false;
  let expandedInstanceIds = new SvelteSet<string>();
  let removeMode = false;

  // Plans integration
  let hasInitializedPlans = false;

  // Reload when user signs in (reactive)
  $: if (isSignedIn && !hasLoadedForUser) {
    favouritesStore.load();
    hasLoadedForUser = true;
  }

  // Initialize plans when user signs in
  $: if (isSignedIn && hasLoadedForUser && !hasInitializedPlans) {
    try {
      initializePlans();
    } catch (err) {
      console.error('Failed to initialize plans:', err);
    } finally {
      hasInitializedPlans = true;
    }
  }

  $: if (!isSignedIn) {
    favouritesStore.clear();
    plansStore.clear();
    expandedInstanceIds = new SvelteSet();
    hasLoadedForUser = false;
    hasInitializedPlans = false;
  }

  async function initializePlans() {
    // Load existing plans
    await plansStore.load();
    
    // If no plans exist, create a default one
    if ($plansStore.plans.length === 0) {
      const defaultPlan = await plansStore.create('Default');
      await plansStore.setActive(defaultPlan.id);
    } else if (!$plansStore.activePlan) {
      // If plans exist but none are active, activate the first one
      await plansStore.setActive($plansStore.plans[0].id);
    }
  }

  // Sync expanded instances with active plan
  $: if ($plansStore.activePlan) {
    expandedInstanceIds = new SvelteSet($plansStore.activePlan.instanceIds);
  }

  // Batch fetch study groups for all favourited courses
  $: if (hasLoadedForUser && $favouritesStore.favourites.length > 0) {
    const coursesToFetch = $favouritesStore.favourites
      .flatMap(fav => getCoursesForId(fav.courseId))
      .map(course => ({
        courseUnitId: course.unitId,
        courseOfferingId: course.id,
      }));
    
    if (coursesToFetch.length > 0) {
      studyGroupStore.fetchBatch(coursesToFetch);
    }
  }

  function getCoursesForId(courseId: string): Course[] {
    return courseIndexStore.getInstancesByCode(courseId);
  }

  $: sortedFavourites = [...$favouritesStore.favourites].sort((a, b) => {
    switch (sortBy) {
      case 'courseId':
        return a.courseId.localeCompare(b.courseId) * sortDirection;
      case 'courseName': {
        const coursesA = getCoursesForId(a.courseId);
        const coursesB = getCoursesForId(b.courseId);
        const nameA = coursesA[0]?.name.en || a.courseId;
        const nameB = coursesB[0]?.name.en || b.courseId;
        return nameA.localeCompare(nameB) * sortDirection;
      }
      case 'credits': {
        const coursesA = getCoursesForId(a.courseId);
        const coursesB = getCoursesForId(b.courseId);
        const creditsA = coursesA[0]?.credits.min || 0;
        const creditsB = coursesB[0]?.credits.min || 0;
        return (creditsA - creditsB) * sortDirection;
      }
      case 'startDate': {
        const coursesA = getCoursesForId(a.courseId);
        const coursesB = getCoursesForId(b.courseId);
        const dateA = coursesA[0]?.courseDate.start || new Date(0);
        const dateB = coursesB[0]?.courseDate.start || new Date(0);
        return (new Date(dateA).getTime() - new Date(dateB).getTime()) * sortDirection;
      }
      case 'addedAt':
      default:
        return (new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()) * sortDirection;
    }
  });

  function handleSort(column: string) {
    sortBy = column;
  }

  function startEditingNotes(courseId: string, notes: string | null) {
    editingCourseId = courseId;
    editingNotes = notes || '';
  }

  function cancelEditingNotes() {
    editingCourseId = null;
    editingNotes = '';
  }

  async function saveNotes(courseId: string) {
    try {
      await favouritesStore.updateNotes(courseId, editingNotes || null);
      editingCourseId = null;
      editingNotes = '';
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
    removeMode = false;
  }

  function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }

  function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ` at ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function toggleInstance(courseId: string, instanceId: string) {
    if (expandedInstanceIds.has(instanceId)) {
      // Removing instance
      const wasInPlan = $plansStore.activePlan?.instanceIds.includes(instanceId) ?? false;
      
      expandedInstanceIds.delete(instanceId);
      expandedInstanceIds = new SvelteSet(expandedInstanceIds);

      // Show notification if it was in the plan
      if (wasInPlan) {
        NotificationService.error(`Instance removed from ${$plansStore.activePlan?.name || 'plan'}`);
        // Optionally remove from plan
        removedInstanceFromPlan(instanceId);
      }
    } else {
      const courses = getCoursesForId(courseId);
      courses.forEach(c => expandedInstanceIds.delete(c.id));
      expandedInstanceIds.add(instanceId);
      expandedInstanceIds = new SvelteSet(expandedInstanceIds);
    }
  }

  async function removedInstanceFromPlan(instanceId: string) {
    try {
      await plansStore.removeInstanceFromActivePlan(instanceId);
    } catch (err) {
      console.error('Failed to remove instance from plan:', err);
    }
  }

  async function addInstanceToActivePlan(instanceId: string) {
    try {
      if (!$plansStore.activePlan) {
        NotificationService.error('No active plan');
        return;
      }

      await plansStore.addInstanceToActivePlan(instanceId);
      NotificationService.success(`Instance added to ${$plansStore.activePlan.name}`);
    } catch (err) {
      console.error('Failed to add instance to plan:', err);
      NotificationService.error('Failed to add instance to plan');
    }
  }

  function isInstanceInActivePlan(instanceId: string): boolean {
    return $plansStore.activePlan?.instanceIds.includes(instanceId) ?? false;
  }

  function isInstanceExpanded(instanceId: string): boolean {
    return expandedInstanceIds.has(instanceId);
  }
</script>

<div class="favourites-container">
  {#if !isSignedIn}
    <div class="state-card">
      <div class="icon-circle">👤</div>
      <h2>Sign in to save favourites</h2>
      <p>Create an account to keep track of your courses across devices.</p>
    </div>

  {:else if $favouritesStore.loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Fetching your collection...</p>
    </div>

  {:else if $favouritesStore.error}
    <div class="state-card error">
      <h2>Something went wrong</h2>
      <p>{$favouritesStore.error}</p>
      <button on:click={() => favouritesStore.load()} class="btn btn-secondary">Try Again</button>
    </div>

  {:else if $favouritesStore.favourites.length === 0}
    <div class="header-section">
      <div class="title-group">
        <h1>Your Favourites</h1>
      </div>
      <PlanManager compact={true} />
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
        <h1>Your Favourites</h1>
      </div>
      
      <PlanManager compact={true} />

      <div class="controls">
        {#if removeMode}
          <button class="btn btn-secondary" on:click={exitRemoveMode}>
            Done
          </button>
        {:else}
          <div class="sort-box">
            <label for="sort">Sort by:</label>
            <select id="sort" bind:value={sortBy} on:change={() => handleSort(sortBy)}>
              <option value="addedAt">Recently Added</option>
              <option value="courseId">Course Code</option>
              <option value="courseName">Course Name</option>
              <option value="credits">Credits</option>
              <option value="startDate">Start Date</option>
            </select>
            <button class="sort-dir" on:click={() => { sortDirection *= -1; }}>
              {sortDirection === 1 ? '↑' : '↓'}
            </button>
          </div>
          <button class="btn btn-secondary" on:click={() => { removeMode = true; }}>
            Remove
          </button>
        {/if}
      </div>
    </div>

    <div class="favourites-list">
      {#each sortedFavourites as favourite (favourite.courseId)}
        {@const courses =
          [...getCoursesForId(favourite.courseId)].sort(
            (a, b) => new Date(a.courseDate.start).getTime() - new Date(b.courseDate.start).getTime()
          )
        }

        {@const instanceToAdd = (() => {
          if (!$plansStore.activePlan) return null;
          const expanded = courses.find(c => expandedInstanceIds.has(c.id) && !isInstanceInActivePlan(c.id));
          if (expanded && !isInstanceInActivePlan(expanded.id)) return expanded;
          return null;
        })()}
        
        {@const visibleInstances = (() => {
          const active = courses.find(c => expandedInstanceIds.has(c.id));
          return active ? [active] : courses;
        })()}

        <div class="favourite-item" class:remove-mode={removeMode}>
          <div class="item-header">
              <div class="code-and-info">
                <a 
                  href="https://sisu.aalto.fi/student/courseunit/{courses[0]?.unitId}/brochure" 
                  target="_blank"
                  class="course-code-link"
                >
                  <h3 class="course-code">{favourite.courseId}</h3>
                </a>
                {#if courses.length > 0}
                  <p class="course-name">{courses[0].name.en.split(",").slice(0, -1).join(",")}</p>
                {/if}
                <div class="metadata">
                  <span class="added-date">Added {formatDateTime(favourite.addedAt)}</span>
                </div>
              </div>
              {#if removeMode}
                <button 
                  class="remove-btn" 
                  on:click={() => removeFavourite(favourite.courseId)}
                  aria-label="Remove from favourites"
                  title="Remove from favourites"
                >
                  ✕
                </button>
              {:else}
                {#if instanceToAdd}
                  <button 
                    class="add-btn" 
                    aria-label="Add to active plan"
                    on:click={async () => {
                      await addInstanceToActivePlan(instanceToAdd.id);
                    }}
                    title="Add to {$plansStore.activePlan?.name || 'plan'}"
                  >
                    +
                  </button>
                {/if}
              {/if}
            </div>

          {#if !removeMode}
            <div class="instances-container">
              {#each visibleInstances as course (course.id)}
                <div
                  class="instance {isInstanceExpanded(course.id) ? 'selected' : ''} {isInstanceInActivePlan(course.id) ? 'in-plan' : ''}"
                  role="button"
                  tabindex="0"
                  on:click={(e) => { 
                    if ((e.target as HTMLElement).closest('.study-group-button') == null) {
                      toggleInstance(favourite.courseId, course.id);
                    }
                  }}
                  on:keydown={(e) => e.key === 'Enter' && toggleInstance(favourite.courseId, course.id)}
                >
                  <div class="instance-top">
                    <div class="instance-dates">
                      <span class="date-range">
                        {formatDate(course.courseDate.start)}
                        –
                        {formatDate(course.courseDate.end)}
                      </span>
                    </div>
                    <div class="format-badge" data-format={course.format}>
                      {course.format}
                    </div>
                  </div>
                  {#if isInstanceExpanded(course.id)}
                    <div role="presentation" on:click|stopPropagation>
                      <StudyGroupsSection {course} isExpanded={isInstanceExpanded(course.id)} />
                    </div>
                  {/if}
                </div>
              {/each}
            </div>

            <div class="notes-section">
              {#if editingCourseId === favourite.courseId}
                <div class="editor">
                  <textarea 
                    bind:value={editingNotes} 
                    placeholder="Add your notes here..."
                    aria-label="Edit notes"
                  ></textarea>
                  <div class="editor-actions">
                    <button 
                      on:click={() => saveNotes(favourite.courseId)} 
                      class="btn-text save"
                    >
                      Save
                    </button>
                    <button 
                      on:click={cancelEditingNotes} 
                      class="btn-text cancel"
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
                      class="edit-trigger" 
                      on:click={() => startEditingNotes(favourite.courseId, favourite.notes)}
                    >
                      Edit note
                    </button>
                  {:else}
                    <button 
                      class="edit-trigger" 
                      on:click={() => startEditingNotes(favourite.courseId, null)}
                    >
                      + Add note
                    </button>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
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

  h1 {
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
    min-width: 32px;
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

  @media (max-width: 440px) {
    .header-section {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>