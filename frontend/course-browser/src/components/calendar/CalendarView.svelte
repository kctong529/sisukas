<script lang="ts">
  import { onMount } from 'svelte';
  import { calendarProjectionStore } from '@lib/stores/calendarProjectionStore.svelte';
  import { plansStore } from '@lib/stores/plansStore.svelte';
  import { courseIndexStore } from '@lib/stores/courseIndexStore.svelte';
  import { layoutCalendarWeek } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import { calendarEventPresentation } from '@application/calendar/calendarPresentation';
  import { aggregateCalendarDisplayEntries, displayEntryLocations } from '@application/calendar/calendarDisplayAggregation';
  import { currentHelsinkiWeek } from '@application/calendar/currentHelsinkiWeek';
  import { shiftHelsinkiWeek } from '@application/calendar/weekNavigation';
  import { calendarDataNotices, calendarEmptyMessage } from '@application/calendar/calendarDataStates';
  import WeekNavigation from './WeekNavigation.svelte';
  import WeekGrid from './WeekGrid.svelte';
  import type { CalendarGroupSelection } from '@domain/services/calendar/CalendarProjection';
  import { studyGroupStore } from '@lib/stores/studyGroupStore.svelte';

  let weekStart = $state(currentHelsinkiWeek());
  const todayWeek = currentHelsinkiWeek;
  let loadError = $state<string | null>(null);
  let plansReady = $state(false);
  const activePlan = $derived(plansStore.read.getActive());
  const projection = $derived(calendarProjectionStore.projection);
  const display = $derived(projection ? aggregateCalendarDisplayEntries(projection.entries) : null);
  const layout = $derived(display ? layoutCalendarWeek(display.entries, weekStart) : null);
  const notices = $derived(projection ? calendarDataNotices(projection.completeness) : []);
  const emptyMessage = $derived(projection ? calendarEmptyMessage(projection.completeness) : null);
  const unresolvedSelections = $derived(projection
    ? projection.diagnostics.filter(item => item.code === 'selected_study_group_missing').length : 0);

  function selectionForSegment(segment: WeeklyCalendarSegment): CalendarGroupSelection {
    const { courseOfferingId, studyGroupId } = segment.entry.source;
    return projection?.selectionByGroup[courseOfferingId]?.[studyGroupId] ?? 'candidate';
  }

  function membersForSegment(segment: WeeklyCalendarSegment) {
    return display?.membersByEntry.get(segment.entry) ?? [segment.entry];
  }

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
    const info = calendarEventPresentation(segment.entry.source, course);
    const members = membersForSegment(segment);
    if (members.length < 2) return info;
    return { ...info, locationLabel: `${displayEntryLocations(members).length} listed rooms` };
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
    {#each notices as notice (notice.kind)}
      <p role={notice.kind === 'failed' ? 'alert' : 'status'} class={`data-notice ${notice.kind}`}>
        {notice.message}
      </p>
    {/each}
    {#if projection && (projection.completeness.failedCourses > 0 || projection.completeness.missingCourses > 0)}
      <button class="retry-data" onclick={() => calendarProjectionStore.retryUnavailableGroups()}>
        Retry unavailable study-group data
      </button>
    {/if}
    {#if layout.segments.length === 0 && emptyMessage}
      <p role="status">{emptyMessage}</p>
    {/if}

    {#if unresolvedSelections > 0}
      <p role="status">{unresolvedSelections} explicit teaching-group choice reference(s) could not be found in the available source data.</p>
    {/if}
    <p class="selection-explanation">Candidate and selected labels describe Sisukas planning choices, not SISU registration.</p>
    <WeekGrid {layout} {presentationForSegment} {groupsForSegment} {membersForSegment} {selectionForSegment} />
  {/if}
</section>

<style>
  .calendar-view { margin: 1rem auto; padding: 1rem; max-width: 1500px; }
  h1 { font-size: 1.45rem; margin: 0 0 0.3rem; }
  .selection-explanation { color: #475569; font-size: .82rem; margin: 0 0 10px; }
  .data-notice.failed { color: #991b1b; }
  .data-notice.stale { color: #854d0e; }
  .retry-data { margin: 0 0 12px; padding: 6px 10px; cursor: pointer; }
  [role='status'] {
    color: #475569;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
</style>
