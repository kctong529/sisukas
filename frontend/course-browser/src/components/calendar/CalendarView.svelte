<script lang="ts">
  import { onMount } from 'svelte';

  import { calendarCoursesForWeek } from '@application/calendar/calendarCoursesForWeek';
  import { calendarDataNotices, calendarEmptyMessage } from '@application/calendar/calendarDataStates';
  import { aggregateCalendarDisplayEntries, displayEntryLocations } from '@application/calendar/calendarDisplayAggregation';
  import { weekAwareOfferingColorIndices } from '@application/calendar/calendarOfferingColors';
  import { chooseOverlappingOccurrence } from '@application/calendar/calendarOverlapChoice';
  import { calendarEventPresentation } from '@application/calendar/calendarPresentation';
  import { calendarEntryVisible } from '@application/calendar/calendarVisibility';
  import { chooseCalendarGroup, showAllCalendarGroups } from '@application/calendar/calendarVisibilityShortcuts';
  import { currentHelsinkiWeek } from '@application/calendar/currentHelsinkiWeek';
  import { shiftHelsinkiWeek } from '@application/calendar/weekNavigation';
  import { layoutCalendarWeek } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import { NotificationService } from '@infrastructure/services/NotificationService';
  import { calendarProjectionStore } from '@lib/stores/calendarProjectionStore.svelte';
  import { calendarVisibilitySessionStore } from '@lib/stores/calendarVisibilitySessionStore.svelte';
  import { courseIndexStore } from '@lib/stores/courseIndexStore.svelte';
  import { plansStore } from '@lib/stores/plansStore.svelte';

  import PlanManager from '../planning/PlanManager.svelte';
  import WeekGrid from './WeekGrid.svelte';
  import WeekNavigation from './WeekNavigation.svelte';

  import type { CalendarGroupSelection } from '@domain/services/calendar/CalendarProjection';
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';

  let weekStart = $state(currentHelsinkiWeek());
  let panelSide = $state<'left' | 'right'>('left');
  const todayWeek = currentHelsinkiWeek;
  let loadError = $state<string | null>(null);
  let plansReady = $state(false);
  const activePlan = $derived(plansStore.read.getActive());
  const projection = $derived(calendarProjectionStore.projection);
  const accountId = $derived(calendarVisibilitySessionStore.state.accountId);
  const preferenceState = $derived(accountId && activePlan && activePlan.userId === accountId
    ? calendarVisibilitySessionStore.read.stateFor(accountId, activePlan.id)
    : { status: 'unknown' } as const);
  // A local edit is displayed only after server hydration. Step 5 persists it.
  const visibility = $derived(accountId && activePlan && activePlan.userId === accountId
    ? calendarVisibilitySessionStore.read.displayFor(accountId, activePlan.id)
    : null);
  const writeStatus = $derived(accountId && activePlan
    ? calendarVisibilitySessionStore.read.writesFor(accountId, activePlan.id)
    : { pending: 0, failed: 0 });
  // A failure notification is tied to one authenticated plan and dismissed
  // when the failure resolves or the user changes account/plan.
  let failedWriteNotification: { id: string; scope: string } | null = null;
  $effect(() => {
    const currentAccount = accountId;
    const currentPlan = activePlan;
    const failed = writeStatus.failed;
    const scope = currentAccount && currentPlan && currentPlan.userId === currentAccount
      ? JSON.stringify([currentAccount, currentPlan.id])
      : null;

    if (failedWriteNotification && (failed === 0 || failedWriteNotification.scope !== scope)) {
      NotificationService.dismiss(failedWriteNotification.id);
      failedWriteNotification = null;
    }
    if (scope && currentAccount && currentPlan && failed > 0 && !failedWriteNotification) {
      const account = currentAccount;
      const plan = currentPlan.id;
      const id = NotificationService.errorWithAction(
        `${failed} Calendar visibility change(s) could not be saved. Changes remain in this session.`,
        'Retry',
        () => {
          if (calendarVisibilitySessionStore.state.accountId !== account) return;
          calendarVisibilitySessionStore.actions.retryFailedWrites(account, plan);
        },
      );
      failedWriteNotification = { id, scope };
    }
  });

  onMount(() => () => {
    if (failedWriteNotification) NotificationService.dismiss(failedWriteNotification.id);
  });
  const display = $derived(projection ? aggregateCalendarDisplayEntries(projection.entries) : null);
  const visibleEntries = $derived(display && visibility ? display.entries.filter(entry =>
    // A room-aggregated card is one visual occurrence; hiding it hides all its members.
    (display.membersByEntry.get(entry) ?? [entry]).some(member => calendarEntryVisible(member, visibility))) : []);
  const layout = $derived(display && visibility ? layoutCalendarWeek(visibleEntries, weekStart) : null);
  const unfilteredLayout = $derived(display ? layoutCalendarWeek(display.entries, weekStart) : null);
  const weekCourses = $derived(activePlan && unfilteredLayout
    ? calendarCoursesForWeek(activePlan.instanceIds,
        id => courseIndexStore.read.resolveByInstanceId(id), unfilteredLayout.days)
    : []);
  function groupsForCourse(offeringId: string) {
    const course = courseIndexStore.read.resolveByInstanceId(offeringId);
    return course ? calendarProjectionStore.readGroups(course.unitId, offeringId) ?? [] : [];
  }
  function toggleGroup(offeringId: string, groupId: string, hidden: boolean): void {
    if (!accountId || !activePlan || preferenceState.status !== 'ready') return;
    calendarVisibilitySessionStore.actions.setGroupHidden(
      accountId, activePlan.id, { courseOfferingId: offeringId, studyGroupId: groupId }, hidden,
    );
  }
  // The offering scope is passed explicitly; avoid relying on the displayed week.
  function performVisibilityChanges(offeringId: string, changes: ReturnType<typeof chooseCalendarGroup>): void {
    if (!accountId || !activePlan || preferenceState.status !== 'ready') return;
    for (const group of changes.groups) {
      calendarVisibilitySessionStore.actions.setGroupHidden(accountId, activePlan.id, {
        courseOfferingId: offeringId, studyGroupId: group.groupId,
      }, group.hidden);
    }
    for (const key of changes.occurrenceKeysToReset) {
      calendarVisibilitySessionStore.actions.setOccurrenceVisibility(accountId, activePlan.id, key, null);
    }
  }
  function chooseGroup(offeringId: string, groupId: string, groups: readonly { groupId: string; type: string }[]): void {
    if (!visibility) return;
    performVisibilityChanges(offeringId, chooseCalendarGroup(offeringId, groupId,
      groups.map(group => ({ id: group.groupId, type: group.type })), visibility));
  }
  function showAll(offeringId: string): void {
    if (!visibility) return;
    performVisibilityChanges(offeringId, showAllCalendarGroups(offeringId, visibility));
  }
  function hideGroup(segment: WeeklyCalendarSegment): void {
    const { courseOfferingId, studyGroupId } = segment.entry.source;
    toggleGroup(courseOfferingId, studyGroupId, true);
  }
  function toggleOccurrence(segment: WeeklyCalendarSegment, state: 'hidden' | 'visible' | null): void {
    if (!accountId || !activePlan || preferenceState.status !== 'ready') return;
    const keys = membersForSegment(segment).map(member => member.occurrenceKey);
    if (keys.some(key => key === null)) return;
    // One visual card may contain several distinct source occurrence identities.
    for (const key of new Set(keys as string[])) {
      calendarVisibilitySessionStore.actions.setOccurrenceVisibility(
        accountId, activePlan.id, key, state,
      );
    }
  }
  function hideOccurrence(segment: WeeklyCalendarSegment): void {
    toggleOccurrence(segment, 'hidden');
  }
  function overlapChoice(segment: WeeklyCalendarSegment) {
    if (!display || !visibility) return null;
    if (projection?.selectionByGroup[segment.entry.source.courseOfferingId]?.[segment.entry.source.studyGroupId] === 'excluded') return null;
    const chosen = { entry: segment.entry, members: membersForSegment(segment) };
    const candidates = display.entries
      .filter(entry => projection?.selectionByGroup[entry.source.courseOfferingId]?.[entry.source.studyGroupId] !== 'excluded')
      .map(entry => ({
        entry, members: display.membersByEntry.get(entry) ?? [entry],
      }));
    const choice = chooseOverlappingOccurrence(chosen, candidates, visibility);
    return !choice.available && choice.reason === 'No visible overlapping events to hide.'
      ? null : choice;
  }
  function resolveOverlap(segment: WeeklyCalendarSegment): void {
    if (!accountId || !activePlan || preferenceState.status !== 'ready') return;
    const choice = overlapChoice(segment);
    if (!choice?.available) return;
    // Apply the entire intent synchronously in the optimistic session store.
    // Existing per-identity PUT queues and retry notifications handle persistence.
    for (const key of choice.keysToShow) {
      calendarVisibilitySessionStore.actions.setOccurrenceVisibility(accountId, activePlan.id, key, 'visible');
    }
    for (const key of choice.keysToHide) {
      calendarVisibilitySessionStore.actions.setOccurrenceVisibility(accountId, activePlan.id, key, 'hidden');
    }
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

  function retryPreferences(): void {
    if (!activePlan || !accountId) return;
    void calendarVisibilitySessionStore.actions.retryLoad(accountId, activePlan.id);
  }

  // #173 owns default active-plan retrieval at the application boundary.
  // The calendar observes authoritative entries and only retries on user action.

  function groupsForSegment(segment: WeeklyCalendarSegment) {
    const offeringId = segment.entry.source.courseOfferingId;
    const course = courseIndexStore.read.resolveByInstanceId(offeringId);
    return course ? calendarProjectionStore.readGroups(course.unitId, offeringId) : null;
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

<section class="calendar-view" aria-labelledby="calendar-title"
  data-benchmark-plan={loadError ? 'error' : !plansReady ? 'loading' : activePlan ? 'active' : 'none'}
  data-benchmark-status={projection?.completeness.status ?? 'pending'}
  data-benchmark-total={projection?.completeness.totalCourses ?? -1}
  data-benchmark-available={projection?.completeness.availableCourses ?? -1}
  data-benchmark-stale={projection?.completeness.staleCourses ?? -1}
  data-benchmark-missing={projection?.completeness.missingCourses ?? -1}
  data-benchmark-loading={projection?.completeness.loadingCourses ?? -1}
  data-benchmark-failed={projection?.completeness.failedCourses ?? -1}>
  <header class="header-section">
    <div class="title-group">
      <h1 id="calendar-title">Weekly calendar</h1>
    </div>
    <div class="header-actions">
      <PlanManager compact={true} />
      <WeekNavigation
        {weekStart}
        onPrevious={() => { weekStart = shiftHelsinkiWeek(weekStart, -1); }}
        onNext={() => { weekStart = shiftHelsinkiWeek(weekStart, 1); }}
        onToday={() => { weekStart = todayWeek(); }}
      />
      <button
        type="button"
        class="ui-button ui-button--secondary panel-position-button"
        onclick={() => { panelSide = panelSide === 'left' ? 'right' : 'left'; }}
        aria-label={panelSide === 'left' ? 'Move event details panel to the right' : 'Move event details panel to the left'}
      >
        {panelSide === 'left' ? 'Move panel right' : 'Move panel left'}
      </button>
    </div>
  </header>

  {#if loadError}
    <p role="alert">Unable to load study plans: {loadError}</p>
  {:else if !plansReady}
    <p role="status">Loading study plans…</p>
  {:else if !activePlan}
    <p>No active study plan. Create or select a plan in LEGO to see its calendar.</p>
  {:else if preferenceState.status === 'failed'}
    <p role="alert">Unable to load Calendar visibility preferences: {preferenceState.error}</p>
    <button type="button" class="ui-button ui-button--secondary retry-data" onclick={retryPreferences}>Retry Calendar preferences</button>
  {:else if preferenceState.status !== 'ready'}
    <p role="status">Loading Calendar visibility preferences…</p>
  {:else if layout && visibility}
    {#each notices as notice (notice.kind)}
      <p role={notice.kind === 'failed' ? 'alert' : 'status'} class={`data-notice ${notice.kind}`}>
        {notice.message}
      </p>
    {/each}
    {#if projection && (projection.completeness.failedCourses > 0 || projection.completeness.missingCourses > 0)}
      <button type="button" class="ui-button ui-button--secondary retry-data" onclick={() => calendarProjectionStore.retryUnavailableGroups()}>
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
    <WeekGrid {panelSide} {layout} {colorByOffering} {presentationForSegment} {groupsForSegment} {membersForSegment} {selectionForSegment}
      {hideGroup} {hideOccurrence} {overlapChoice} {resolveOverlap} {weekCourses} {groupsForCourse} {visibility}
      unfilteredSegments={unfilteredLayout?.segments ?? []}
      onToggleGroup={toggleGroup} onToggleOccurrence={toggleOccurrence}
      onChooseGroup={chooseGroup} onShowAll={showAll} />

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
  /* Match the title/action header structure used by Favourites and LEGO. */
  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .title-group { display: flex; flex-direction: column; gap: 0.5rem; }
  h1 { margin: 0; font-size: 1.3rem; font-weight: 600; }
  /* WeekNavigation owns control sizing; the header owns the bottom spacing. */
  .header-section :global(.week-navigation) { margin-bottom: 0; }
  .header-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.5rem 0.85rem; }
  .panel-position-button { height: 34px; min-height: 34px; padding: 0.4rem 0.7rem; font-size: 0.8rem; }
  @media (max-width: 1000px) { .panel-position-button { display: none; } }
  .data-notice { margin: 0 0 0.5rem; font-size: 0.85rem; line-height: 1.5; }
  .data-notice.failed { color: var(--ui-danger-text); }
  .data-notice.stale { color: #854d0e; }
  /* Keep the original Calendar retry geometry and blue text; shared primitives
     own the border, background, hover, and keyboard-focus treatment. */
  .retry-data {
    height: auto;
    min-height: 0;
    margin: 0 0 0.75rem;
    padding: 0.45rem 0.8rem;
    color: var(--calendar-primary);
    font-size: 0.8rem;
    font-weight: 600;
    line-height: normal;
  }
  [role='status'] { color: var(--calendar-muted); font-size: 0.85rem; margin-bottom: 0.75rem; }
</style>
