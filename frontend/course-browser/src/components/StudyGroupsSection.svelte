<!-- src/components/StudyGroupsSection.svelte -->
<script lang="ts">
  import type { Course } from "../domain/models/Course";
  import { studyGroupStore } from "../lib/stores/studyGroupStore.svelte";
  import type { StudyGroupSummary } from "../lib/stores/studyGroupStore.svelte";
  import { formatStudyEventSchedule, formatStudyEventTime } from "../lib/studyGroups/studyGroupFormatters";

  const { course, isExpanded } = $props<{ course: Course; isExpanded: boolean }>();

  const status = $derived.by(() => {
    if (!course) {
      return { key: "", hasFull: false, hasAny: false, isLoading: false, isStale: false };
    }
    return studyGroupStore.read.getStatus(course.unitId, course.id);
  });

  const groups = $derived.by(() => {
    if (!course) return [];
    return studyGroupStore.read.getGroups(course.unitId, course.id);
  });

  const summaries = $derived.by<StudyGroupSummary[]>(() => {
    if (!course) return [];
    return studyGroupStore.read.getSummaries(course.unitId, course.id);
  });

  // When expanded, ask the store to ensure it has data (store decides what that means)
  $effect(() => {
    if (!isExpanded || !course) return;
    studyGroupStore.actions.ensureFetched(course.unitId, course.id);
  });
</script>

<div class="study-groups-container">
  <div class="study-groups-content">
    {#if groups.length > 0}
      <!-- PRIORITY 1: Full data -->
      <div class="study-groups-list">
        {#each groups as group (group.groupId)}
          <div class="study-group-item">
            <div class="group-header">
              <h4 class="group-name">{group.name}</h4>
              <span class="group-type">{group.type}</span>
            </div>

            <div class="group-schedule">
              {formatStudyEventSchedule(group.studyEvents ?? [])}
            </div>

            {#if (group.studyEvents?.length ?? 0) > 3}
              <details class="group-events">
                <summary>Show all {group.studyEvents.length} events</summary>
                <div class="events-list">
                  {#each group.studyEvents as event (event.id)}
                    <div class="event-item">
                      {formatStudyEventTime(event)}
                    </div>
                  {/each}
                </div>
              </details>
            {/if}

            {#if status.isStale}
              <div class="updating-badge">Refreshing...</div>
            {/if}
          </div>
        {/each}
      </div>

    {:else if summaries.length > 0}
      <!-- PRIORITY 2: Summaries fallback -->
      <div class="study-groups-list">
        {#each summaries as s (s.groupId)}
          <div class="study-group-item">
            <div class="group-header">
              <h4 class="group-name">{s.name}</h4>
              <span class="group-type">{s.type}</span>
            </div>

            <div class="group-schedule">{s.schedule}</div>
            <div class="group-meta">{s.eventCount} events</div>

            {#if status.isStale}
              <div class="updating-badge">Refreshing...</div>
            {/if}
          </div>
        {/each}
      </div>

    {:else if status.isLoading}
      <div class="loading">Loading study groups...</div>

    {:else}
      <div class="empty">No study groups available</div>
    {/if}
  </div>
</div>

<style>
  /* unchanged */
  .study-groups-container { margin-top: 0; }

  .loading,
  .empty {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
    padding: 0.25rem 0;
  }

  .study-groups-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .study-group-item {
    padding: 0.5rem;
    background: white;
    border-radius: 5px;
    border: 1px solid #e0e0e0;
    position: relative;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .group-name {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-main);
  }

  .group-type {
    font-size: 0.65rem;
    background: #e0e7ff;
    color: var(--primary);
    padding: 0.15rem 0.3rem;
    border-radius: 3px;
    font-weight: 500;
  }

  .group-schedule {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }

  .group-meta {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .updating-badge {
    font-size: 0.65rem;
    color: #059669;
    margin-top: 0.25rem;
    font-style: italic;
    padding: 0.15rem 0.3rem;
    background: #d1fae5;
    border-radius: 3px;
    display: inline-block;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .group-events { margin-top: 0.25rem; }

  .group-events summary {
    font-size: 0.7rem;
    color: var(--primary);
    cursor: pointer;
    padding-top: 0.15rem;
  }

  .group-events summary:hover { color: #d9534f; }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-top: 0.25rem;
    padding-left: 1rem;
  }

  .event-item {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
</style>
