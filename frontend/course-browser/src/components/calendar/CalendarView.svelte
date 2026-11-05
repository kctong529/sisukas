<script lang="ts">
  import { onMount } from 'svelte';
  import { calendarProjectionStore } from '@lib/stores/calendarProjectionStore.svelte';
  import { plansStore } from '@lib/stores/plansStore.svelte';
  import { courseIndexStore } from '@lib/stores/courseIndexStore.svelte';
  import { layoutCalendarWeek } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import { currentHelsinkiWeek } from '@application/calendar/currentHelsinkiWeek';
  import WeekGrid from './WeekGrid.svelte';

  const weekStart = currentHelsinkiWeek(); // Fixed initial week; navigation is the next slice.
  let loadError = $state<string | null>(null);
  let plansReady = $state(false);
  const activePlan = $derived(plansStore.read.getActive());
  const projection = $derived(calendarProjectionStore.projection);
  const layout = $derived(projection ? layoutCalendarWeek(projection.entries, weekStart) : null);

  onMount(() => {
    void plansStore.actions.ensureLoaded()
      .then(() => { plansReady = true; })
      .catch(error => { loadError = error instanceof Error ? error.message : String(error); });
  });

  // Reactive to plan and course-index changes. Imperative fetching stays out of $derived.
  $effect(() => {
    if (!plansReady || !activePlan) return;
    // Read the plan membership and course index to retry as either changes.
    const offerings = activePlan.instanceIds.join('|');
    const indexedCourses = courseIndexStore.state.byInstanceId.size;
    if (offerings.length === 0 || indexedCourses === 0) return;
    calendarProjectionStore.ensureActivePlanGroups();
  });

  function labelForSegment(segment: WeeklyCalendarSegment): string {
    const offeringId = segment.entry.source.courseOfferingId;
    const course = courseIndexStore.read.resolveByInstanceId(offeringId);
    const name = course?.name.en || course?.code.value || offeringId;
    const group = segment.entry.source.studyGroupId;
    return `${name} · ${group}`;
  }
</script>

<section class="calendar-view" aria-labelledby="calendar-title">
  <h1 id="calendar-title">Weekly calendar</h1>
  <p class="week-label">Week of {weekStart} · Europe/Helsinki</p>

  {#if loadError}
    <p role="alert">Unable to load study plans: {loadError}</p>
  {:else if !plansReady}
    <p role="status">Loading study plans…</p>
  {:else if !activePlan}
    <p>No active study plan. Create or select a plan in LEGO to see its calendar.</p>
  {:else if layout}
    {#if projection?.completeness.status === 'partial'}
      {#if layout.segments.length === 0}
        <p role="status">
          Loading calendar events… Some study-group data
          is not yet available.
        </p>
      {:else}
        <p role="status">
          Some study-group data is still missing or loading;
          this calendar may be incomplete.
        </p>
      {/if}
    {:else if layout.segments.length === 0}
      <p>No fixed events in this week for the active plan.</p>
    {/if}

    <WeekGrid {layout} {labelForSegment} />
  {/if}
</section>

<style>
  .calendar-view { margin: 1rem auto; padding: 1rem; max-width: 1500px; }
  h1 { font-size: 1.45rem; margin: 0 0 0.3rem; }
  .week-label { color: #64748b; font-size: 0.9rem; margin: 0 0 1rem; }
  [role='status'] {
    color: #475569;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
</style>
