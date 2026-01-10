<!-- src/components/StudyGroupsSection.svelte -->
<script lang="ts">
  import type { Course } from '../domain/models/Course';

  export let course: Course;
  export let expandAll: boolean = false;

  let studyGroups: any[] = [];
  let loading = true;
  let expanded = false;

  // Sync expansion state with parent
  $: expanded = expandAll;

  interface StudyGroup {
    group_id: string;
    name: string;
    type: string;
    study_events: Array<{ start: string; end: string }>;
  }

  async function fetchStudyGroups(): Promise<StudyGroup[]> {
    try {
      const url = new URL('https://sisu-wrapper-api-test.sisukas.eu/study-groups');
      url.searchParams.append('course_unit_id', course.unitId);
      url.searchParams.append('course_offering_id', course.id);

      const response = await fetch(url.toString());
      if (!response.ok) return [];

      return await response.json();
    } catch (error) {
      console.error('Error fetching study groups:', error);
      return [];
    }
  }

  function aggregateStudyEvents(events: Array<{ start: string; end: string }>): string {
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

  async function loadStudyGroups() {
    if (expandAll) {
      // If expand all is on, we're already expanded, just load if needed
      if (studyGroups.length === 0) {
        loading = true;
        studyGroups = await fetchStudyGroups();
        loading = false;
      }
      return;
    }

    // Normal toggle behavior
    if (expanded) {
      expanded = false;
      return;
    }

    expanded = true;
    if (studyGroups.length > 0) return; // Already loaded

    loading = true;
    studyGroups = await fetchStudyGroups();
    loading = false;
  }
</script>

<div class="study-groups-container">
  <button class="study-groups-toggle" on:click={loadStudyGroups}>
    {expanded ? '▼' : '▶'} Study Groups
  </button>

  {#if expanded}
    <div class="study-groups-content">
      {#if loading}
        <div class="loading">Loading study groups...</div>
      {:else if studyGroups.length === 0}
        <div class="empty">No study groups available</div>
      {:else}
        <div class="study-groups-list">
          {#each studyGroups as group (group.group_id)}
            <div class="study-group-item">
              <div class="group-header">
                <h4 class="group-name">{group.name}</h4>
                <span class="group-type">{group.type}</span>
              </div>
              <div class="group-schedule">{aggregateStudyEvents(group.study_events)}</div>
              {#if group.study_events.length > 3}
                <details class="group-events">
                  <summary>Show all {group.study_events.length} events</summary>
                  <div class="events-list">
                    {#each group.study_events as event (event.start)}
                      <div class="event-item">{formatEventTime(event.start, event.end)}</div>
                    {/each}
                  </div>
                </details>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .study-groups-container {
    margin-top: 0.5rem;
  }

  .study-groups-toggle {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.25rem 0;
    transition: color 0.2s;
  }

  .study-groups-toggle:hover {
    color: var(--primary-hover);
  }

  .study-groups-content {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #f9fafb;
    border-radius: 4px;
    border: 1px solid #f0f0f0;
  }

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
    border-radius: 3px;
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
    font-weight: 600;
    color: var(--text-main);
  }

  .group-type {
    font-size: 0.65rem;
    background: #e0e7ff;
    color: var(--primary);
    padding: 0.15rem 0.4rem;
    border-radius: 2px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .group-schedule {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }

  .group-events {
    margin-top: 0.25rem;
  }

  .group-events summary {
    font-size: 0.7rem;
    color: var(--primary);
    cursor: pointer;
    padding: 0.15rem 0;
  }

  .group-events summary:hover {
    text-decoration: underline;
  }

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