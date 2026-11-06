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
  import type { CalendarGroupSelection } from '@domain/services/calendar/CalendarProjection';
  import { calendarOfferingColorIndices } from '@application/calendar/calendarOfferingColors';

  interface Props {
    layout: WeeklyCalendarLayoutResult;
    offeringIds?: readonly string[];
    colorByOffering?: Readonly<Record<string, number>>;
    presentationForSegment: (segment: WeeklyCalendarSegment) => CalendarEventPresentation;
    groupsForSegment?: (segment: WeeklyCalendarSegment) => readonly StudyGroup[] | null;
    membersForSegment?: (segment: WeeklyCalendarSegment) => readonly CalendarEntry[];
    selectionForSegment?: (segment: WeeklyCalendarSegment) => CalendarGroupSelection;
    hideGroup?: (segment: WeeklyCalendarSegment) => void;
    hideOccurrence?: (segment: WeeklyCalendarSegment) => void;
  }
  let {
    layout, offeringIds, colorByOffering: assignedColors, presentationForSegment, groupsForSegment = () => null,
    membersForSegment = segment => [segment.entry],
    selectionForSegment = () => 'candidate', hideGroup = () => {}, hideOccurrence = () => {},
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
  let overlapTrigger: HTMLButtonElement | null = null;
  let workspaceElement: HTMLDivElement;

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
      {colorByOffering}
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
      onHideGroup={() => { if (displayedSegment) { hideGroup(displayedSegment); pinnedId = null; previewId = null; } }}
      onHideOccurrence={() => { if (displayedSegment) { hideOccurrence(displayedSegment); pinnedId = null; previewId = null; } }}
      canHideOccurrence={displayedSegment !== null && membersForSegment(displayedSegment).every(entry => entry.occurrenceKey !== null)}
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
  onClose={closeGroup}
/>

<style>
  .calendar-panel-controls { display: flex; justify-content: flex-end; margin-bottom: 0.5rem; }
  .panel-position-button { border: 1px solid var(--calendar-border, #e2e8f0); background: var(--calendar-card, #fff); color: var(--calendar-text, #1e293b); border-radius: 6px; padding: 0.4rem 0.7rem; cursor: pointer; font: inherit; font-size: 0.8rem; }
  .panel-position-button:hover { border-color: var(--calendar-primary, #2f7fd6); background: #f1f5f9; }
  .panel-position-button:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
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

    /* Left/right positioning is not applicable to the stacked layout. */
    .calendar-panel-controls {
      display: none;
    }
  }
</style>
