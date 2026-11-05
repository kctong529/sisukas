<script lang="ts">
  import type {
    WeeklyCalendarLayoutResult,
    WeeklyCalendarSegment,
  } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import { formatCalendarMinute, displayEventLocation } from '@application/calendar/calendarPresentation';
  import { denseOverlapPresentation } from '@application/calendar/denseOverlapPresentation';
  import type { DenseOverlapDisplay } from '@application/calendar/denseOverlapPresentation';
  import CalendarEvent from './CalendarEvent.svelte';
  import DenseOverlapCard from './DenseOverlapCard.svelte';

  interface Props {
    layout: WeeklyCalendarLayoutResult;
    labelForSegment: (segment: WeeklyCalendarSegment) => string;
  }
  let { layout, labelForSegment }: Props = $props();

  const hours = Array.from({ length: 25 }, (_, i) => i);
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
</script>

<div class="week-scroll" aria-label="Weekly calendar">
  <div class="week-grid">
    <div class="corner" aria-hidden="true"></div>
    {#each layout.days as date (date)}
      <div class="day-heading">{date}</div>
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
            <CalendarEvent {segment} label={labelForSegment(segment)} />
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
        <li>
          <strong>{labelForSegment(segment)}</strong>
          <span>{formatCalendarMinute(segment.startMinute)}–{formatCalendarMinute(segment.endMinute)}</span>
          {#if displayEventLocation(segment.entry.source.event)}
            <span>{displayEventLocation(segment.entry.source.event)}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</dialog>

<style>
  .week-scroll { overflow-x: auto; border: 1px solid #dce4ee; border-radius: 8px; background: #fff; }
  .week-grid { display: grid; grid-template-columns: 60px repeat(7, minmax(145px, 1fr)); min-width: 1075px; }
  .corner, .day-heading { position: sticky; top: 0; background: #f1f5f9; z-index: 2; border-bottom: 1px solid #cbd5e1; }
  .day-heading { padding: 12px 4px; text-align: center; font-size: 0.85rem; font-weight: 600; border-left: 1px solid #e2e8f0; }
  .time-axis, .day-column { height: 960px; position: relative; }
  .time-axis span { position: absolute; right: 8px; font-size: 0.7rem; color: #64748b; transform: translateY(-45%); }
  .day-column { border-left: 1px solid #e2e8f0; background: repeating-linear-gradient(to bottom, transparent 0, transparent calc(100% / 24 - 1px), #e2e8f0 calc(100% / 24 - 1px), #e2e8f0 calc(100% / 24)); }
  .event, .cluster { position: absolute; box-sizing: border-box; overflow: hidden; border-radius: 4px; }
  .event { container: calendar-card / inline-size; border: 1px solid #1d4ed8; background: #dbeafe; color: #1e3a8a; font-size: 0.68rem; line-height: 1.25; }
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
