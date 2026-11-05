<script lang="ts">
  import { onMount } from 'svelte';
  import { calendarProjectionStore } from '@lib/stores/calendarProjectionStore.svelte';
  import { plansStore } from '@lib/stores/plansStore.svelte';
  import { courseIndexStore } from '@lib/stores/courseIndexStore.svelte';
  import { layoutCalendarWeek } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import { calendarEventPresentation } from '@application/calendar/calendarPresentation';
  import { currentHelsinkiWeek } from '@application/calendar/currentHelsinkiWeek';
  import { shiftHelsinkiWeek } from '@application/calendar/weekNavigation';
  import WeekNavigation from './WeekNavigation.svelte';
  import WeekGrid from './WeekGrid.svelte';
  import { studyGroupStore } from '@lib/stores/studyGroupStore.svelte';

  let weekStart = $state(currentHelsinkiWeek());
  const todayWeek = currentHelsinkiWeek;
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

  function groupsForSegment(segment: WeeklyCalendarSegment) {
    const offeringId = segment.entry.source.courseOfferingId;
    const course = courseIndexStore.read.resolveByInstanceId(offeringId);
    return course ? studyGroupStore.read.getCached(course.unitId, offeringId) : null;
  }

  function presentationForSegment(segment: WeeklyCalendarSegment) {
    const offeringId = segment.entry.source.courseOfferingId;
    const course = courseIndexStore.read.resolveByInstanceId(offeringId);
    return calendarEventPresentation(segment.entry.source, course);
  }
</script>

<section class="calendar-view" aria-labelledby="calendar-title">
  <h1 id="calendar-title">Weekly calendar</h1>
  <WeekNavigation
    {weekStart}
    onPrevious={() => { weekStart = shiftHelsinkiWeek(weekStart, -1); }}
    onNext={() => { weekStart = shiftHelsinkiWeek(weekStart, 1); }}
    onToday={() => { weekStart = todayWeek(); }}
  />

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

    <WeekGrid {layout} {presentationForSegment} {groupsForSegment} />
  {/if}
</section>

<style>
  .calendar-view { margin: 1rem auto; padding: 1rem; max-width: 1500px; }
  h1 { font-size: 1.45rem; margin: 0 0 0.3rem; }
  [role='status'] {
    color: #475569;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
</style>
