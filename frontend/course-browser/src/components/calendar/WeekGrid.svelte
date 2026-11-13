<script lang="ts">
  import { calendarGroupAlternatives } from '@application/calendar/calendarGroupAlternatives';
  import { calendarOfferingColorIndices } from '@application/calendar/calendarOfferingColors';
  import { calendarPreviewLayout } from '@application/calendar/calendarPreviewLayout';
  import { calendarTimeSlotAlternatives } from '@application/calendar/calendarTimeSlotAlternatives';
  import { denseOverlapPresentation } from '@application/calendar/denseOverlapPresentation';

  import CalendarContextPanel from './CalendarContextPanel.svelte';
  import CalendarCourseBar from './CalendarCourseBar.svelte';
  import CalendarCourseContext from './CalendarCourseContext.svelte';
  import CalendarTimetable from './CalendarTimetable.svelte';
  import DenseOverlapDialog from './DenseOverlapDialog.svelte';

  import type { CalendarWeekCourse } from '@application/calendar/calendarCoursesForWeek';
  import type { OverlapChoice } from '@application/calendar/calendarOverlapChoice';
  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import type { TimeSlotAlternative } from '@application/calendar/calendarTimeSlotAlternatives';
  import type { CalendarVisibility } from '@application/calendar/calendarVisibility';
  import type { DenseOverlapDisplay } from '@application/calendar/denseOverlapPresentation';
  import type { CalendarEntry } from '@domain/models/CalendarEntry';
  import type { CalendarGroupSelection } from '@domain/services/calendar/CalendarProjection';
  import type {
    WeeklyCalendarLayoutResult,
    WeeklyCalendarSegment,
  } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { StudyGroup } from '@modules/study-groups';

  interface Props {
    layout: WeeklyCalendarLayoutResult;
    panelSide?: 'left' | 'right';
    offeringIds?: readonly string[];
    colorByOffering?: Readonly<Record<string, number>>;
    presentationForSegment: (segment: WeeklyCalendarSegment) => CalendarEventPresentation;
    groupsForSegment?: (segment: WeeklyCalendarSegment) => readonly StudyGroup[] | null;
    membersForSegment?: (segment: WeeklyCalendarSegment) => readonly CalendarEntry[];
    selectionForSegment?: (segment: WeeklyCalendarSegment) => CalendarGroupSelection;
    hideGroup?: (segment: WeeklyCalendarSegment) => void;
    hideOccurrence?: (segment: WeeklyCalendarSegment) => void;
    overlapChoice?: (segment: WeeklyCalendarSegment) => OverlapChoice | null;
    resolveOverlap?: (segment: WeeklyCalendarSegment) => void;
    weekCourses?: readonly CalendarWeekCourse[];
    groupsForCourse?: (offeringId: string) => readonly StudyGroup[];
    unfilteredSegments?: readonly WeeklyCalendarSegment[];
    visibility?: CalendarVisibility;
    onToggleGroup?: (offeringId: string, groupId: string, hidden: boolean) => void;
    onChooseGroup?: (offeringId: string, groupId: string, groups: readonly { groupId: string; type: string }[]) => void;
    onShowAll?: (offeringId: string) => void;
    onToggleOccurrence?: (segment: WeeklyCalendarSegment, state: 'hidden' | 'visible' | null) => void;
  }
  let {
    layout, panelSide = 'left', offeringIds, colorByOffering: assignedColors, presentationForSegment, groupsForSegment = () => null,
    membersForSegment = segment => [segment.entry],
    selectionForSegment = () => 'candidate', hideGroup = () => {}, hideOccurrence = () => {},
    overlapChoice = () => null, resolveOverlap = () => {},
    weekCourses = [], groupsForCourse = () => [], unfilteredSegments = [],
    visibility = { hiddenGroups: [], occurrenceOverrides: {} },
    onToggleGroup = () => {}, onToggleOccurrence = () => {},
    onChooseGroup = () => {}, onShowAll = () => {},
  }: Props = $props();

  // Callers supply the whole active plan so colors do not change with the week.
  // Standalone/test instances can derive a fallback from the visible layout.
  const colorByOffering = $derived(assignedColors ?? calendarOfferingColorIndices(offeringIds ??
    layout.segments.map(segment => segment.entry.source.courseOfferingId).sort()));
  const presentation = $derived(denseOverlapPresentation(layout));
  // A preview never changes the plan. A pinned event remains when hover ends.
  // Resolve stored IDs against the current layout so week changes cannot show stale data.
  let previewId = $state<string | null>(null);
  let pinnedId = $state<string | null>(null);
  let selectedOfferingId = $state<string | null>(null);
  let previewCourseId = $state<string | null>(null);
  // Preview overrides the pinned course context, but leaving restores the pin.
  const selectedCourse = $derived(weekCourses.find(course => course.offeringId === selectedOfferingId) ?? null);
  const previewedCourse = $derived(weekCourses.find(course => course.offeringId === previewCourseId) ?? null);
  const displayedCourse = $derived(previewedCourse ?? selectedCourse);
  const coursePinned = $derived(selectedCourse !== null && (previewedCourse === null || previewedCourse.offeringId === selectedCourse.offeringId));
  // Ephemeral event inspection wins, without clearing a pinned course.
  const courseSegments = $derived(displayedCourse ? [...new Map(unfilteredSegments
    .filter(segment => segment.entry.source.courseOfferingId === displayedCourse.offeringId)
    .map(segment => [segment.entry, segment] as const)).values()] : []);
  const previewSegment = $derived(layout.segments.find(segment => segment.id === previewId) ?? null);
  const pinnedSegment = $derived(layout.segments.find(segment => segment.id === pinnedId) ?? null);
  const displayedSegment = $derived(previewSegment ?? pinnedSegment);
  const showCourse = $derived(previewSegment === null && displayedCourse !== null);
  // Course-group and occurrence hover is highlighting only, never a visibility edit.
  let courseGroupPreviewId = $state<string | null>(null);
  let courseOccurrencePreviewId = $state<string | null>(null);
  let previewTimeSlotId = $state<string | null>(null);
  const alternatives = $derived(displayedSegment
    ? calendarGroupAlternatives(groupsForSegment(displayedSegment), displayedSegment.entry.source.studyGroupId)
    : []);
  // A clicked alternative retains a read-only highlight; it does not select a group.
  let hoveredAlternativeId = $state<string | null>(null);
  let retainedAlternativeId = $state<string | null>(null);
  let retainedAlternativeContext = $state<string | null>(null);
  const alternativeContext = $derived(displayedSegment
    ? `${displayedSegment.entry.source.courseOfferingId}\u0000${displayedSegment.entry.source.studyGroupId}`
    : null);
  const requestedAlternativeId = $derived(hoveredAlternativeId ?? (
    retainedAlternativeContext === alternativeContext ? retainedAlternativeId : null));
  const retainedGroupId = $derived(retainedAlternativeContext === alternativeContext ? retainedAlternativeId : null);
  const previewGroupId = $derived(alternatives.some(group => group.groupId === requestedAlternativeId)
    ? requestedAlternativeId : null);
  const previewOfferingId = $derived(previewGroupId ? displayedSegment?.entry.source.courseOfferingId ?? null : null);
  const timeSlotAlternatives: TimeSlotAlternative[] = $derived(displayedSegment
    ? calendarTimeSlotAlternatives(displayedSegment, unfilteredSegments, visibility,
        membersForSegment, selectionForSegment, presentationForSegment)
    : []);
  function restoreTimeSlot(segment: WeeklyCalendarSegment): void {
    if (membersForSegment(segment).every(member => member.occurrenceKey !== null)) {
      onToggleOccurrence(segment, 'visible');
    }
  }
  function hideTimeSlot(segment: WeeklyCalendarSegment): void {
    if (membersForSegment(segment).every(member => member.occurrenceKey !== null)) {
      onToggleOccurrence(segment, 'hidden');
    }
  }
  // Visibility-filtered entries have no rendered calendar card. During an explicit
  // group/occurrence inspection, render their positions as read-only outlines.
  // Planning exclusions (and source exclusions) are not visibility preferences.
  const hiddenPreviewSegments = $derived.by(() => {
    const groupId = courseOccurrencePreviewId === null ? courseGroupPreviewId ?? previewGroupId : null;
    const offeringId = courseGroupPreviewId !== null
      ? displayedCourse?.offeringId ?? null : previewOfferingId;
    const visibleEntries = new Set(layout.segments.map(segment => segment.entry));
    return unfilteredSegments.filter(segment => {
      if (visibleEntries.has(segment.entry)) return false;
      if (segment.entry.source.event.excluded || selectionForSegment(segment) === 'excluded') return false;
      if (courseOccurrencePreviewId !== null) return segment.id === courseOccurrencePreviewId;
      if (previewTimeSlotId !== null && segment.id === previewTimeSlotId) return true;
      return groupId !== null && offeringId !== null &&
        segment.entry.source.studyGroupId === groupId &&
        segment.entry.source.courseOfferingId === offeringId;
    });
  });
  // Reflow both the ghost and its visible neighbors together before rendering.
  const previewGeometry = $derived(calendarPreviewLayout(layout, hiddenPreviewSegments));
  function toggleAlternative(id: string): void {
    if (retainedAlternativeContext === alternativeContext && retainedAlternativeId === id) {
      retainedAlternativeId = null;
      retainedAlternativeContext = null;
    } else {
      retainedAlternativeContext = alternativeContext;
      retainedAlternativeId = id;
    }
  }
  function chooseAlternative(id: string): void {
    if (!displayedSegment || !alternatives.some(group => group.groupId === id)) return;
    const sourceGroups = groupsForSegment(displayedSegment);
    if (!sourceGroups?.some(group => group.groupId === id)) return;
    onChooseGroup(displayedSegment.entry.source.courseOfferingId, id,
      sourceGroups.map(group => ({ groupId: group.groupId, type: group.type })));
    // Selecting an alternative can hide the event currently being inspected.
    hoveredAlternativeId = null;
    retainedAlternativeId = null;
    retainedAlternativeContext = null;
    previewId = null;
    pinnedId = null;
  }
  let selectedGroup = $state<DenseOverlapDisplay | null>(null);
  let detailsDialog: DenseOverlapDialog;
  let overlapTrigger: HTMLButtonElement | null = null;
  let workspaceElement: HTMLDivElement;
  let courseBarElement: HTMLDivElement;

  function openGroup(group: DenseOverlapDisplay): void {
    // Remember the invoking control so focus returns after the native dialog closes.
    overlapTrigger = document.activeElement instanceof HTMLButtonElement
      ? document.activeElement : null;
    selectedGroup = group;
    detailsDialog.showModal();
  }

  function closeGroup(): void {
    selectedGroup = null;
    // The trigger may have disappeared after a projection or week change.
    if (overlapTrigger?.isConnected) overlapTrigger.focus();
    overlapTrigger = null;
  }

  function handleCalendarKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;

    // Let the existing modal handle Escape.
    if (detailsDialog?.isOpen()) return;

    // Ignore keyboard events outside the calendar.
    const target = event.target;
    if (!(target instanceof Node)) return;

    if (!workspaceElement?.contains(target) && !courseBarElement?.contains(target)) return;

    if (pinnedId !== null || previewId !== null || selectedOfferingId !== null || previewCourseId !== null || courseGroupPreviewId !== null || courseOccurrencePreviewId !== null) {
      pinnedId = null;
      previewId = null;
      selectedOfferingId = null;
      previewCourseId = null;
      courseGroupPreviewId = null;
      courseOccurrencePreviewId = null;
      hoveredAlternativeId = null;
      retainedAlternativeId = null;
      event.preventDefault();
    }
  }
</script>

<svelte:window onkeydown={handleCalendarKeydown} />

<div bind:this={courseBarElement}>
<CalendarCourseBar courses={weekCourses} {colorByOffering}
  {selectedOfferingId}
  onSelect={id => { selectedOfferingId = id; pinnedId = null; previewId = null; courseGroupPreviewId = null; courseOccurrencePreviewId = null; }}
  onPreview={id => { previewCourseId = id; courseGroupPreviewId = null; courseOccurrencePreviewId = null; }} />
</div>
<div bind:this={workspaceElement} class="calendar-workspace" class:panel-right={panelSide === 'right'} data-panel-side={panelSide}>
  <div class="calendar-grid-pane">
    <CalendarTimetable
      {layout}
      {colorByOffering}
      visibleSegments={previewGeometry.visibleSegments}
      denseGroups={presentation.displays}
      {presentationForSegment}
      {selectionForSegment}
      previewOnlySegments={previewGeometry.previewOnlySegments}
      onPreview={id => { previewId = id; }}
      onPreviewEnd={id => { if (previewId === id) previewId = null; }}
      onInspect={id => { selectedOfferingId = null; previewCourseId = null; pinnedId = id; }}
      onOpenGroup={openGroup}
      previewGroupId={courseGroupPreviewId ?? previewGroupId}
      previewOfferingId={courseGroupPreviewId !== null ? displayedCourse?.offeringId ?? null : previewOfferingId}
      {previewCourseId}
      previewOccurrenceId={courseOccurrencePreviewId}
    />
  </div>
  <div class="calendar-panel-pane">
    {#if showCourse && displayedCourse}
      <CalendarCourseContext course={displayedCourse} isPinned={coursePinned} groups={groupsForCourse(displayedCourse.offeringId)}
        segments={courseSegments} {visibility} {membersForSegment}
        {onToggleGroup} {onToggleOccurrence} {onChooseGroup} {onShowAll}
        onGroupPreview={id => { courseGroupPreviewId = id; courseOccurrencePreviewId = null; }}
        onOccurrencePreview={id => { courseOccurrencePreviewId = id; }}
        onClear={() => { selectedOfferingId = null; previewCourseId = null; }} />
    {:else}
    <CalendarContextPanel
      segment={displayedSegment}
      presentation={displayedSegment ? presentationForSegment(displayedSegment) : null}
      date={displayedSegment ? layout.days[displayedSegment.dayIndex] : null}
      isPinned={pinnedSegment !== null}
      selection={displayedSegment ? selectionForSegment(displayedSegment) : 'candidate'}
      members={displayedSegment ? membersForSegment(displayedSegment) : []}
      onClear={() => { pinnedId = null; previewId = null; hoveredAlternativeId = null; retainedAlternativeId = null; }}
      {alternatives}
      {previewGroupId}
      {retainedGroupId}
      onAlternativePreview={id => { hoveredAlternativeId = id; }}
      onAlternativeToggle={toggleAlternative}
      onAlternativeChoose={chooseAlternative}
      {timeSlotAlternatives}
      onRestoreTimeSlot={restoreTimeSlot}
      onHideTimeSlot={hideTimeSlot}
      onPreviewTimeSlot={segment => { previewTimeSlotId = segment?.id ?? null; }}
      alternativeContextKey={alternativeContext}
      onHideGroup={() => { if (displayedSegment) { hideGroup(displayedSegment); pinnedId = null; previewId = null; } }}
      onHideOccurrence={() => { if (displayedSegment) { hideOccurrence(displayedSegment); pinnedId = null; previewId = null; } }}
      canHideOccurrence={displayedSegment !== null && membersForSegment(displayedSegment).every(entry => entry.occurrenceKey !== null)}
      overlapChoice={displayedSegment ? overlapChoice(displayedSegment) : null}
      onResolveOverlap={() => { if (displayedSegment) { resolveOverlap(displayedSegment); pinnedId = null; previewId = null; } }}
      onShowCourse={() => {
        if (displayedSegment) { selectedOfferingId = displayedSegment.entry.source.courseOfferingId; pinnedId = null; previewId = null; }
      }}
    />
    {/if}
  </div>
</div>

<DenseOverlapDialog
  bind:this={detailsDialog}
  group={selectedGroup}
  {layout}
  {presentationForSegment}
  {membersForSegment}
  {selectionForSegment}
  {overlapChoice} onResolveOverlap={resolveOverlap}
  onClose={closeGroup}
/>

<style>
  .calendar-workspace { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 0.75rem; align-items: start; }
  .calendar-grid-pane { min-width: 0; order: 2; }
  .calendar-panel-pane { min-width: 0; order: 1; }
  .calendar-workspace.panel-right { grid-template-columns: minmax(0, 1fr) 300px; }
  .calendar-workspace.panel-right .calendar-grid-pane { order: 1; }
  .calendar-workspace.panel-right .calendar-panel-pane { order: 2; }
  @media (max-width: 1000px) {
    .calendar-workspace,
    .calendar-workspace.panel-right {
      grid-template-columns: minmax(0, 1fr);
    }

    .calendar-grid-pane,
    .calendar-workspace.panel-right .calendar-grid-pane {
      order: 1;
    }

    .calendar-panel-pane,
    .calendar-workspace.panel-right .calendar-panel-pane {
      order: 2;
    }

  }
</style>
