<!-- src/components/StudyGroupsSection.svelte -->
<!-- 
  Shows how to display cached summaries while full data loads,
  then switch to full data when available.
-->

<script lang="ts">
  import { onDestroy } from "svelte";
  import { studyGroupStore, type StudyGroupSummary } from "../lib/stores/studyGroupStore";
  import type { Course } from "../domain/models/Course";
  import type { StudyGroup } from "../domain/models/StudyGroup";
  import type { StudyEvent } from "../domain/models/StudyEvent";

  export let course: Course;
  export let isExpanded: boolean;

  const keyOf = (c: Course) => `${c.unitId}:${c.id}`;

  // STATE: What we display
  let groups: StudyGroup[] = [];           // Full groups (rich display)
  let summaries: StudyGroupSummary[] = []; // Summary fallback
  let isLoading = false;                   // Show spinner
  let isStale = false;                     // Show "Refreshing..." badge

  let unsubscribe: (() => void) | null = null;
  let currentKey: string | null = null;

  /**
   * Subscribe to store state
   * Strategy: Show full data if available, otherwise show summaries
   */
  function subscribeForKey(k: string) {
    if (unsubscribe) unsubscribe();

    unsubscribe = studyGroupStore.subscribe((state) => {
      const full = state.cache[k];
      const hasFull = full !== undefined;

      groups = full ?? [];
      summaries = studyGroupStore.getSummaries(course.unitId, course.id);

      const isKeyLoading = state.loadingKeys.includes(k);
      const staleKey = state.staleKeys.has(k);

      isLoading =
        !hasFull &&
        summaries.length === 0 &&
        isKeyLoading;

      isStale =
        staleKey &&
        (hasFull || summaries.length > 0);
    });
  }

  $: if (course) {
    const k = keyOf(course);
    if (k !== currentKey) {
      currentKey = k;
      subscribeForKey(k);
    }
  }

  // Fetch when expanded
  $: if (isExpanded && course && currentKey) {
    const isAlreadyLoading = studyGroupStore.isLoading(course.unitId, course.id);
    const hasFull = studyGroupStore.hasFull(course.unitId, course.id);

    if (!hasFull && !isAlreadyLoading) {
      void studyGroupStore.fetch(course.unitId, course.id);
    }
  }

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  function aggregateStudyEvents(events: StudyEvent[]): string {
    if (events.length === 0) return 'No events';

    const timeSlotMap = new Map<string, Set<string>>();

    events.forEach(event => {
      const startDate = new Date(event.start);
      const endDate = new Date(event.end);

      const startTime = startDate.toLocaleTimeString('en-FI', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const endTime = endDate.toLocaleTimeString('en-FI', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const dayOfWeek = startDate.toLocaleDateString('en-US', { weekday: 'short' });
      const timeSlot = `${startTime} - ${endTime}`;

      if (!timeSlotMap.has(timeSlot)) {
        timeSlotMap.set(timeSlot, new Set());
      }
      timeSlotMap.get(timeSlot)!.add(dayOfWeek);
    });

    const patterns: string[] = [];
    timeSlotMap.forEach((days, timeSlot) => {
      const daysList = Array.from(days).join(', ');
      patterns.push(`${daysList} ${timeSlot}`);
    });

    return patterns.join(' | ');
  }

  function formatEventTime(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const dateStr = startDate.toLocaleDateString('en-FI', {
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
    });

    const startTime = startDate.toLocaleTimeString('en-FI', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const endTime = endDate.toLocaleTimeString('en-FI', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return `${dateStr} ${startTime} – ${endTime}`;
  }
</script>

<div class="study-groups-container">
  <div class="study-groups-content">
    {#if groups.length > 0}
      <!-- PRIORITY 1: Full data display (rich event details) -->
      <div class="study-groups-list">
        {#each groups as group (group.groupId)}
          <div class="study-group-item">
            <div class="group-header">
              <h4 class="group-name">{group.name}</h4>
              <span class="group-type">{group.type}</span>
            </div>

            <div class="group-schedule">
              {aggregateStudyEvents(group.studyEvents)}
            </div>

            {#if group.studyEvents.length > 3}
              <details class="group-events">
                <summary>Show all {group.studyEvents.length} events</summary>
                <div class="events-list">
                  {#each group.studyEvents as event (event.id)}
                    <div class="event-item">
                      {formatEventTime(event.startIso ?? event.start, event.endIso ?? event.end)}
                    </div>
                  {/each}
                </div>
              </details>
            {/if}

            {#if isStale}
              <div class="updating-badge">Refreshing...</div>
            {/if}
          </div>
        {/each}
      </div>

    {:else if summaries.length > 0}
      <!-- PRIORITY 2: Cached summary display (while full data loads) -->
      <div class="study-groups-list">
        {#each summaries as s (s.groupId)}
          <div class="study-group-item">
            <div class="group-header">
              <h4 class="group-name">{s.name}</h4>
              <span class="group-type">{s.type}</span>
            </div>

            <div class="group-schedule">{s.schedule}</div>

            <div class="group-meta">
              {s.eventCount} events
            </div>
            {#if isStale}
              <div class="updating-badge">Refreshing...</div>
            {/if}
          </div>
        {/each}
      </div>

    {:else if isLoading}
      <div class="loading">Loading study groups...</div>

    {:else}
      <div class="empty">No study groups available</div>
    {/if}
  </div>
</div>

<style>
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
