<script lang="ts">
  import type {
    WeeklyCalendarLayoutResult,
    WeeklyCalendarSegment,
  } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import { denseOverlapPresentation } from '@application/calendar/denseOverlapPresentation';
  import type { DenseOverlapDisplay } from '@application/calendar/denseOverlapPresentation';
  import CalendarContextPanel from './CalendarContextPanel.svelte';
  import CalendarTimetable from './CalendarTimetable.svelte';
  import DenseOverlapDialog from './DenseOverlapDialog.svelte';
  import type { StudyGroup } from '@domain/models/StudyGroup';
  import type { CalendarEntry } from '@domain/models/CalendarEntry';
  import { calendarGroupAlternatives } from '@application/calendar/calendarGroupAlternatives';
  import type { CalendarOfferingSelection } from '@domain/services/calendar/CalendarProjection';

  interface Props {
    layout: WeeklyCalendarLayoutResult;
    presentationForSegment: (segment: WeeklyCalendarSegment) => CalendarEventPresentation;
    groupsForSegment?: (segment: WeeklyCalendarSegment) => readonly StudyGroup[] | null;
    membersForSegment?: (segment: WeeklyCalendarSegment) => readonly CalendarEntry[];
    selectionForSegment?: (segment: WeeklyCalendarSegment) => CalendarOfferingSelection;
  }
  let {
    layout, presentationForSegment, groupsForSegment = () => null,
    membersForSegment = segment => [segment.entry],
    selectionForSegment = () => 'candidate',
  }: Props = $props();

  const presentation = $derived(denseOverlapPresentation(layout));
  // A preview never changes the plan. A pinned event remains when hover ends.
  // Resolve stored IDs against the current layout so week changes cannot show stale data.
  let previewId = $state<string | null>(null);
  let pinnedId = $state<string | null>(null);
  let panelSide = $state<'left' | 'right'>('left');
  const previewSegment = $derived(layout.segments.find(segment => segment.id === previewId) ?? null);
  const pinnedSegment = $derived(layout.segments.find(segment => segment.id === pinnedId) ?? null);
  const displayedSegment = $derived(previewSegment ?? pinnedSegment);
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
  function toggleAlternative(id: string): void {
    if (retainedAlternativeContext === alternativeContext && retainedAlternativeId === id) {
      retainedAlternativeId = null;
      retainedAlternativeContext = null;
    } else {
      retainedAlternativeContext = alternativeContext;
      retainedAlternativeId = id;
    }
  }
  let selectedGroup = $state<DenseOverlapDisplay | null>(null);
  let detailsDialog: DenseOverlapDialog;
  let workspaceElement: HTMLDivElement;

  function openGroup(group: DenseOverlapDisplay): void {
    selectedGroup = group;
    detailsDialog.showModal();
  }

  function handleCalendarKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;

    // Let the existing modal handle Escape.
    if (detailsDialog?.isOpen()) return;

    // Ignore keyboard events outside the calendar.
    const target = event.target;
    if (!(target instanceof Node)) return;

    if (!workspaceElement?.contains(target)) return;

    if (pinnedId !== null || previewId !== null) {
      pinnedId = null;
      previewId = null;
      hoveredAlternativeId = null;
      retainedAlternativeId = null;
      event.preventDefault();
    }
  }
</script>

<svelte:window onkeydown={handleCalendarKeydown} />

<div class="calendar-panel-controls">
  <button
    type="button"
    class="panel-position-button"
    onclick={() => { panelSide = panelSide === 'left' ? 'right' : 'left'; }}
    aria-label={panelSide === 'left' ? 'Move event details panel to the right' : 'Move event details panel to the left'}
  >
    {panelSide === 'left' ? 'Move panel right' : 'Move panel left'}
  </button>
</div>
<div bind:this={workspaceElement} class="calendar-workspace" class:panel-right={panelSide === 'right'} data-panel-side={panelSide}>
  <div class="calendar-grid-pane">
    <CalendarTimetable
      {layout}
      visibleSegments={presentation.visibleSegments}
      denseGroups={presentation.displays}
      {presentationForSegment}
      {selectionForSegment}
      onPreview={id => { previewId = id; }}
      onPreviewEnd={id => { if (previewId === id) previewId = null; }}
      onInspect={id => { pinnedId = id; }}
      onOpenGroup={openGroup}
      {previewGroupId}
      {previewOfferingId}
    />
  </div>
  <div class="calendar-panel-pane">
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
    />
  </div>
</div>

<DenseOverlapDialog
  bind:this={detailsDialog}
  group={selectedGroup}
  {layout}
  {presentationForSegment}
  {membersForSegment}
  {selectionForSegment}
  onClose={() => { selectedGroup = null; }}
/>

<style>
  .calendar-panel-controls { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  .panel-position-button { border: 1px solid #94a3b8; background: #fff; color: #0f172a; border-radius: 5px; padding: 5px 10px; cursor: pointer; font-size: .8rem; }
  .panel-position-button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .calendar-workspace { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 14px; align-items: start; }
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

    /* Left/right positioning is not applicable to the stacked layout. */
    .calendar-panel-controls {
      display: none;
    }
  }
</style>
