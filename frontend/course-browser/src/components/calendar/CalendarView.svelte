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
  import { weekAwareOfferingColorIndices } from '@application/calendar/calendarOfferingColors';
  import { calendarVisibilitySessionStore } from '@lib/stores/calendarVisibilitySessionStore.svelte';
  import { calendarCoursesForWeek } from '@application/calendar/calendarCoursesForWeek';
  import {
    calendarEntryVisible,
    setCalendarGroupHidden, setCalendarOccurrenceVisibility,
    type CalendarVisibility,
  } from '@application/calendar/calendarVisibility';

  let weekStart = $state(currentHelsinkiWeek());
  const todayWeek = currentHelsinkiWeek;
  let loadError = $state<string | null>(null);
  let plansReady = $state(false);
  const activePlan = $derived(plansStore.read.getActive());
  const projection = $derived(calendarProjectionStore.projection);
  // Session-scoped and keyed by plan: survives view remounts and A -> B -> A switching.
  // Deliberately not persisted across reloads (#93).
  const visibility = $derived(calendarVisibilitySessionStore.forPlan(activePlan?.id));
  const display = $derived(projection ? aggregateCalendarDisplayEntries(projection.entries) : null);
  const visibleEntries = $derived(display ? display.entries.filter(entry =>
    // A room-aggregated card is one visual occurrence; hiding it hides all its members.
    (display.membersByEntry.get(entry) ?? [entry]).some(member => calendarEntryVisible(member, visibility))) : []);
  const layout = $derived(display ? layoutCalendarWeek(visibleEntries, weekStart) : null);
  const unfilteredLayout = $derived(display ? layoutCalendarWeek(display.entries, weekStart) : null);
  const weekCourses = $derived(activePlan && unfilteredLayout
    ? calendarCoursesForWeek(activePlan.instanceIds,
        id => courseIndexStore.read.resolveByInstanceId(id), unfilteredLayout.days)
    : []);
  function groupsForCourse(offeringId: string) {
    const course = courseIndexStore.read.resolveByInstanceId(offeringId);
    return course ? studyGroupStore.read.getCached(course.unitId, offeringId) ?? [] : [];
  }
  function updateVisibility(next: CalendarVisibility): void {
    if (!activePlan) return;
    calendarVisibilitySessionStore.setForPlan(activePlan.id, next);
  }
  function toggleGroup(offeringId: string, groupId: string, hidden: boolean): void {
    updateVisibility(setCalendarGroupHidden(visibility, offeringId, groupId, hidden));
  }
  function hideGroup(segment: WeeklyCalendarSegment): void {
    const { courseOfferingId, studyGroupId } = segment.entry.source;
    toggleGroup(courseOfferingId, studyGroupId, true);
  }
  function toggleOccurrence(segment: WeeklyCalendarSegment, state: 'hidden' | 'visible' | null): void {
    const members = membersForSegment(segment);
    const keys = members.map(member => member.occurrenceKey);
    if (keys.some(key => key === null)) return;
    updateVisibility(setCalendarOccurrenceVisibility(visibility, keys as string[], state));
  }
  function hideOccurrence(segment: WeeklyCalendarSegment): void {
    toggleOccurrence(segment, 'hidden');
  }
  // Depends on full projection, not weekStart; navigation only reads this map.
  const colorByOffering = $derived(activePlan && projection
    ? weekAwareOfferingColorIndices(activePlan.instanceIds, projection.entries)
    : {});
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
    {#if layout.segments.length === 0 && unfilteredLayout && unfilteredLayout.segments.length > 0}
      <p role="status">All events for this week are hidden. Select a course above to restore its teaching groups or events.</p>
    {:else if layout.segments.length === 0 && emptyMessage}
      <p role="status">{emptyMessage}</p>
    {/if}

    {#if unresolvedSelections > 0}
      <p role="status">{unresolvedSelections} explicit teaching-group choice reference(s) could not be found in the available source data.</p>
    {/if}
    <p class="selection-explanation">Candidate and selected labels describe Sisukas planning choices, not SISU registration.</p>
    <WeekGrid {layout} {colorByOffering} {presentationForSegment} {groupsForSegment} {membersForSegment} {selectionForSegment}
      {hideGroup} {hideOccurrence} {weekCourses} {groupsForCourse} {visibility}
      unfilteredSegments={unfilteredLayout?.segments ?? []}
      onToggleGroup={toggleGroup} onToggleOccurrence={toggleOccurrence} />

  {/if}
</section>

<style>
  .calendar-view {
    /* Match the page shell used by Favourites, LEGO, and Timeline. */
    --calendar-primary: var(--primary, #2f7fd6);
    --calendar-primary-hover: var(--primary-hover, #2980f1);
    --calendar-card: var(--card-bg, #fff);
    --calendar-text: var(--text-main, #1e293b);
    --calendar-muted: var(--text-muted, #64748b);
    --calendar-border: var(--border, #e2e8f0);
    max-width: 1400px;
    margin: 1.5rem auto;
    padding: 0 1rem;
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--calendar-text);
  }
  h1 { margin: 0 0 1rem; font-size: 1.3rem; font-weight: 600; }
  .selection-explanation { margin: 0 0 0.75rem; color: var(--calendar-muted); font-size: 0.8rem; line-height: 1.45; }
  .data-notice { margin: 0 0 0.5rem; font-size: 0.85rem; line-height: 1.5; }
  .data-notice.failed { color: #991b1b; }
  .data-notice.stale { color: #854d0e; }
  .retry-data {
    margin: 0 0 0.75rem;
    padding: 0.45rem 0.8rem;
    border: 1px solid var(--calendar-border);
    border-radius: 6px;
    background: var(--calendar-card);
    color: var(--calendar-primary);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }
  .retry-data:hover { border-color: var(--calendar-primary); background: #eff6ff; }
  .retry-data:focus-visible { outline: 2px solid var(--calendar-primary); outline-offset: 2px; }
  [role='status'] { color: var(--calendar-muted); font-size: 0.85rem; margin-bottom: 0.75rem; }
</style>
