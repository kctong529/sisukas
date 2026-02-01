<script lang="ts">
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { studyGroupStore, type StudyGroupSummary } from "../lib/stores/studyGroupStore";
  import type { Course } from "../domain/models/Course";
  import type { StudyGroup } from "../domain/models/StudyGroup";
  import type { StudyEvent } from "../domain/models/StudyEvent";

  export let course: Course;
  export let isExpanded: boolean;

  const keyOf = (c: Course) => `${c.unitId}:${c.id}`;

  let groups: StudyGroup[] = [];
  let summaries: StudyGroupSummary[] = [];
  let isLoading = false;

  let unsubscribe: (() => void) | null = null;
  let currentKey: string | null = null;

  function subscribeForKey(k: string) {
    if (unsubscribe) unsubscribe();

    unsubscribe = studyGroupStore.subscribe((state) => {
      groups = state.cache[k] || [];
      summaries = state.summaryCache[k] || [];

      const loadingKey = state.loadingKeys.includes(k);
      isLoading = loadingKey && groups.length === 0 && summaries.length === 0;
    });
  }

  // Subscribe only when the course key changes
  $: if (course) {
    const k = keyOf(course);
    if (k !== currentKey) {
      currentKey = k;
      subscribeForKey(k);
    }
  }

  // Fetch when expanded, but only if we don't already have full data AND we're not already loading
  $: if (isExpanded && course && currentKey) {
    const state = get(studyGroupStore);
    const hasFull = (state.cache[currentKey]?.length ?? 0) > 0;
    const isAlreadyLoading = state.loadingKeys.includes(currentKey);

    if (!hasFull && !isAlreadyLoading) {
      // low-priority enqueue in your store
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
      <!-- Full data wins -->
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
          </div>
        {/each}
      </div>

    {:else if summaries.length > 0}
      <!-- Cached summary shows instantly -->
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
              {#if isExpanded && isLoading}
                <span class="updating"> · updating…</span>
              {/if}
            </div>
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

  .updating {
    font-style: italic;
    opacity: 0.9;
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
