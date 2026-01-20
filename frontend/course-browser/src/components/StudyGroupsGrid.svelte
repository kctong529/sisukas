<!-- src/components/StudyGroupsGrid.svelte -->
<script lang="ts">
  import { studyGroupStore } from '../lib/stores/studyGroupStore';
  import type { Course } from '../domain/models/Course';
  import type { StudyGroup } from '../domain/models/StudyGroup';
  import { onDestroy } from 'svelte';

  export let course: Course;           // The full, rich Course domain model
  export let isExpanded: boolean;      // Whether this instance is currently expanded

  // Reactive load trigger: fetch when expanded
  $: if (isExpanded && course) {
    studyGroupStore.fetch(course.unitId, course.id);
  }

  // Subscribe to store for reactive updates
  let studyGroups: StudyGroup[] = [];
  let isLoading = false;
  let unsubscribe: (() => void) | null = null;

  $: if (course) {
    // Clean up previous subscription
    if (unsubscribe) unsubscribe();
    
    // Subscribe to store changes
    unsubscribe = studyGroupStore.subscribe(state => {
      const key = `${course.unitId}:${course.id}`;
      studyGroups = state.cache[key] || [];
      isLoading = state.loadingKeys.includes(key);
    });
  }

  // Clean up subscription on component destroy
  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  })
</script>

<div class="study-groups-grid">
  {#if isLoading}
    <div class="loading">Loading study groups...</div>
  {:else if studyGroups.length === 0}
    <div class="empty">No study groups available</div>
  {:else}
    <div class="squares-container">
      {#each studyGroups as group (group.groupId)}
        <div class="study-group-square" title={group.name}>
          <div class="square-name">{group.name}</div>
          <div class="square-type">{group.type}</div>
          <!-- <div class="square-schedule">{aggregateStudyEvents(group.studyEvents)}</div> -->
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  :root {
    --primary: #4a90e2;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
  }

  .study-groups-grid {
    width: 100%;
  }

  .loading,
  .empty {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
    padding: 0.25rem 0;
  }

  .squares-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem;
  }

  .study-group-square {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 52px;
    padding: 0.4rem;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.2s;
  }

  .study-group-square:hover {
    border-color: var(--primary);
    background: #f8fafc;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  }

  .square-name {
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1.1;
    word-break: break-word;
    color: var(--primary);
  }

  .square-type {
    font-size: 0.6rem;
    background: #dbeafe;
    color: #1e40af;
    padding: 0.1rem 0.25rem;
    border-radius: 2px;
    width: fit-content;
  }
</style>