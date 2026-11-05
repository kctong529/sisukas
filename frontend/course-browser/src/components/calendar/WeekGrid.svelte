<script lang="ts">
  import { onMount } from 'svelte';
  import { calendarDayHeading } from '@application/calendar/calendarDayHeading';
  import type {
    WeeklyCalendarLayoutResult,
    WeeklyCalendarSegment,
  } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';
  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import { denseOverlapPresentation } from '@application/calendar/denseOverlapPresentation';
  import type { DenseOverlapDisplay } from '@application/calendar/denseOverlapPresentation';
  import CalendarEvent from './CalendarEvent.svelte';
  import DenseOverlapCard from './DenseOverlapCard.svelte';
  import CalendarContextPanel from './CalendarContextPanel.svelte';

  interface Props {
    layout: WeeklyCalendarLayoutResult;
    presentationForSegment: (segment: WeeklyCalendarSegment) => CalendarEventPresentation;
  }
  let { layout, presentationForSegment }: Props = $props();

  const hours = Array.from({ length: 25 }, (_, i) => i);
  const HOUR_HEIGHT_PX = 60;
  const FIRST_VISIBLE_HOUR = 8;
  let scrollViewport: HTMLDivElement;

  // Set an initial viewport without restricting the actual 00:00–24:00 grid.
  // Do this only on mount: changing weeks should preserve the user's scroll.
  onMount(() => {
    scrollViewport.scrollTop = FIRST_VISIBLE_HOUR * HOUR_HEIGHT_PX;
  });
  const presentation = $derived(denseOverlapPresentation(layout));
  const denseGroups = $derived(presentation.displays);
  const segmentsByDay = $derived(
    layout.days.map((_, dayIndex) => presentation.visibleSegments.filter(
      segment => segment.dayIndex === dayIndex
    ))
  );
  const denseByDay = $derived(
    layout.days.map((_, dayIndex) => denseGroups.filter(display => display.group.dayIndex === dayIndex))
  );

  // A preview never changes the plan. A pinned event remains when hover ends.
  // Resolve stored IDs against the current layout so week changes cannot show stale data.
  let previewId = $state<string | null>(null);
  let pinnedId = $state<string | null>(null);
  let panelSide = $state<'left' | 'right'>('left');
  const previewSegment = $derived(layout.segments.find(segment => segment.id === previewId) ?? null);
  const pinnedSegment = $derived(layout.segments.find(segment => segment.id === pinnedId) ?? null);
  const displayedSegment = $derived(previewSegment ?? pinnedSegment);
  let selectedGroup = $state<DenseOverlapDisplay | null>(null);
  let detailsDialog: HTMLDialogElement;

  function openGroup(group: DenseOverlapDisplay): void {
    selectedGroup = group;
    detailsDialog.showModal();
  }

  /** Percentage geometry is derived only from the domain layout result. */
  function segmentStyle(segment: WeeklyCalendarSegment): string {
    const top = segment.startMinute / 1440 * 100;
    const height = Math.max(0, segment.endMinute - segment.startMinute) / 1440 * 100;
    const count = Math.max(1, segment.columnCount);
    const index = Math.min(segment.columnIndex, count - 1);
    return `top:${top}%;height:max(2px,${height}%);left:${index / count * 100}%;width:${100 / count}%;`;
  }

  /** A small badge marks the start of each dense interval; never covers its entire span. */
  function groupStyle(group: DenseOverlapDisplay): string {
    const top = group.startMinute / 1440 * 100;
    return `top:${top}%;`;
  }

  function handleCalendarKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;

    // Let the existing modal handle Escape.
    if (detailsDialog?.open) return;

    // Ignore keyboard events outside the calendar.
    const target = event.target;
    if (!(target instanceof Node)) return;

    const workspace = scrollViewport?.closest('.calendar-workspace');
    if (!workspace?.contains(target)) return;

    if (pinnedId !== null || previewId !== null) {
      pinnedId = null;
      previewId = null;
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
<div class="calendar-workspace" class:panel-right={panelSide === 'right'} data-panel-side={panelSide}>
  <div class="calendar-grid-pane">
    <p class="small-screen-hint">Scroll sideways to see the other days.</p>
<!-- The scrollable timetable must be keyboard-focusable. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="week-scroll"
  bind:this={scrollViewport}
  role="region"
  tabindex="0"
  aria-label="Weekly calendar timetable"
>
  <div class="week-grid">
    <div class="corner" aria-hidden="true"></div>
    {#each layout.days as date (date)}
      {@const heading = calendarDayHeading(date)}
      <div class="day-heading" aria-label={heading.fullDate}>
        <span class="day-name">{heading.weekday}</span>
        <span class="day-date">{heading.date}</span>
      </div>
    {/each}

    <div class="time-axis" aria-hidden="true">
      {#each hours as hour (hour)}
        <span style={`top:${hour / 24 * 100}%`}>{formatCalendarMinute(hour * 60)}</span>
      {/each}
    </div>

    {#each layout.days as date, dayIndex (date)}
      <div class="day-column" aria-label={date}>
        {#each segmentsByDay[dayIndex] as segment (segment.id)}
          <div
            class="event"
            class:inactive={!segment.conflictEligible}
            class:cancelled={segment.entry.source.event.cancelled}
            style={segmentStyle(segment)}
            data-segment-id={segment.id}
          >
            <CalendarEvent
              {segment}
              presentation={presentationForSegment(segment)}
              onPreview={() => { previewId = segment.id; }}
              onPreviewEnd={() => { if (previewId === segment.id) previewId = null; }}
              onInspect={() => { pinnedId = segment.id; }}
            />
          </div>
        {/each}
        {#each denseByDay[dayIndex] as display (display.id)}
          <div class="cluster" style={groupStyle(display)} data-overlap-group-id={display.group.id} data-dense-window-id={display.id}>
            <DenseOverlapCard {display} onOpen={() => openGroup(display)} />
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
</div>
<div class="calendar-panel-pane">
  <CalendarContextPanel
    segment={displayedSegment}
    presentation={displayedSegment ? presentationForSegment(displayedSegment) : null}
    date={displayedSegment ? layout.days[displayedSegment.dayIndex] : null}
    isPinned={pinnedSegment !== null}
    onClear={() => { pinnedId = null; previewId = null; }}
  />
</div>
</div>

<dialog bind:this={detailsDialog} onclose={() => { selectedGroup = null; }} aria-label="Overlapping calendar events" class="event-details">
  {#if selectedGroup}
    <header>
      <div>
        <h2>{selectedGroup.segments.length} events in busy period</h2>
        <p>{layout.days[selectedGroup.group.dayIndex]} · {formatCalendarMinute(selectedGroup.startMinute)}–{formatCalendarMinute(selectedGroup.endMinute)} · Europe/Helsinki</p>
      </div>
      <form method="dialog"><button class="close" type="submit">Close</button></form>
    </header>
    <ul>
      {#each selectedGroup.segments as segment (segment.id)}
        {@const info = presentationForSegment(segment)}
        <li>
          <strong>{info.courseCode ? `${info.courseCode} · ` : ''}{info.courseTitle}</strong>
          {#if info.groupLabel}<span>{info.groupLabel}</span>{/if}
          <span>{formatCalendarMinute(segment.startMinute)}–{formatCalendarMinute(segment.endMinute)}</span>
          {#if info.locationLabel}<span>{info.locationLabel}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</dialog>

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
  /* Keep every hour available, but show a useful teaching-day viewport first. */
  .week-scroll {
    max-height: min(75vh, 760px);
    overflow: auto;
    overscroll-behavior: contain;
    border: 1px solid #dce4ee;
    border-radius: 8px;
    background: #fff;
  }
  .week-scroll:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .week-grid {
    display: grid;
    grid-template-columns: 60px repeat(7, minmax(160px, 1fr));
    min-width: 1180px;
  }
  .corner, .day-heading {
    position: sticky;
    top: 0;
    background: #f1f5f9;
    z-index: 4;
    border-bottom: 1px solid #cbd5e1;
  }
  .corner { left: 0; z-index: 6; }
  .day-heading {
    min-height: 45px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px;
    text-align: center;
    border-left: 1px solid #e2e8f0;
  }
  .day-name { font-size: 0.85rem; font-weight: 700; }
  .day-date { font-size: 0.75rem; color: #475569; }
  .time-axis, .day-column { height: 1440px; position: relative; }
  .time-axis { position: sticky; left: 0; z-index: 3; background: #fff; }
  .time-axis span {
    position: absolute;
    right: 8px;
    font-size: 0.7rem;
    color: #64748b;
    transform: translateY(-45%);
  }
  .day-column {
    border-left: 1px solid #e2e8f0;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(100% / 24 - 1px),
      #e2e8f0 calc(100% / 24 - 1px),
      #e2e8f0 calc(100% / 24)
    );
  }
  .small-screen-hint { display: none; }
  @media (max-width: 700px) {
    .week-scroll { max-height: min(70vh, 640px); }
    .week-grid {
      grid-template-columns: 52px repeat(7, minmax(175px, 1fr));
      min-width: 1277px;
    }
    .small-screen-hint {
      display: block;
      font-size: 0.8rem;
      color: #475569;
      margin: 0 0 0.4rem;
    }
  }
  .event, .cluster { position: absolute; box-sizing: border-box; overflow: hidden; border-radius: 4px; }
  .event { container: calendar-card / inline-size; border: 1px solid #1d4ed8; background: #dbeafe; color: #1e3a8a; font-size: 0.68rem; line-height: 1.25; }
  .event:hover, .event:focus-within { outline: 2px solid #1d4ed8; outline-offset: 1px; z-index: 2; }
  .event.inactive { border-style: dashed; border-color: #94a3b8; background: #f1f5f9; color: #475569; }
  .event.cancelled { border-color: #b91c1c; background: #fee2e2; color: #7f1d1d; }
  .cluster {
    z-index: 3;
    right: 3px;
    width: max-content;
    max-width: calc(100% - 6px);
    height: 26px;
    overflow: visible;
  }
  .event-details { border: 1px solid #cbd5e1; border-radius: 10px; padding: 20px; max-width: min(560px, calc(100vw - 32px)); width: 100%; max-height: min(75vh, 650px); color: #0f172a; background: #fff; box-shadow: 0 16px 42px #0f172a40; }
  .event-details::backdrop { background: #0f172a80; }
  .event-details header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  .event-details h2 { font-size: 1.1rem; margin: 0 0 4px; }
  .event-details p { margin: 0; font-size: 0.82rem; color: #475569; }
  .event-details .close { border: 1px solid #94a3b8; border-radius: 5px; background: #fff; padding: 5px 10px; cursor: pointer; }
  .event-details .close:focus-visible { outline: 3px solid #1d4ed8; }
  .event-details ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .event-details li { display: flex; flex-direction: column; gap: 2px; padding: 10px; background: #f1f5f9; border-radius: 6px; font-size: 0.85rem; }
  .event-details li strong { overflow-wrap: anywhere; }
  .event-details li span { color: #475569; font-variant-numeric: tabular-nums; }
</style>
