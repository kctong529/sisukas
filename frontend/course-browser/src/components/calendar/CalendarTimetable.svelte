<script lang="ts">
  import { onMount } from 'svelte';
  import { calendarDayHeading } from '@application/calendar/calendarDayHeading';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';
  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import type { WeeklyCalendarLayoutResult, WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { DenseOverlapDisplay } from '@application/calendar/denseOverlapPresentation';
  import CalendarEvent from './CalendarEvent.svelte';
  import DenseOverlapCard from './DenseOverlapCard.svelte';

  interface Props {
    layout: WeeklyCalendarLayoutResult;
    visibleSegments: WeeklyCalendarSegment[];
    denseGroups: DenseOverlapDisplay[];
    presentationForSegment: (segment: WeeklyCalendarSegment) => CalendarEventPresentation;
    onPreview: (id: string) => void;
    onPreviewEnd: (id: string) => void;
    onInspect: (id: string) => void;
    onOpenGroup: (group: DenseOverlapDisplay) => void;
    previewGroupId?: string | null;
    previewOfferingId?: string | null;
  }

  let {
    layout, visibleSegments, denseGroups, presentationForSegment,
    onPreview, onPreviewEnd, onInspect, onOpenGroup,
    previewGroupId = null, previewOfferingId = null,
  }: Props = $props();

  const hours = Array.from({ length: 25 }, (_, i) => i);
  const HOUR_HEIGHT_PX = 60;
  const FIRST_VISIBLE_HOUR = 8;
  let scrollViewport: HTMLDivElement;

  // Scroll once on mount; week navigation preserves the scroll position.
  onMount(() => {
    scrollViewport.scrollTop = FIRST_VISIBLE_HOUR * HOUR_HEIGHT_PX;
  });

  const segmentsByDay = $derived(layout.days.map((_, dayIndex) =>
    visibleSegments.filter(segment => segment.dayIndex === dayIndex)));
  const denseByDay = $derived(layout.days.map((_, dayIndex) =>
    denseGroups.filter(display => display.group.dayIndex === dayIndex)));

  /** Geometry comes from the domain layout; this component only renders it. */
  function segmentStyle(segment: WeeklyCalendarSegment): string {
    const top = segment.startMinute / 1440 * 100;
    const height = Math.max(0, segment.endMinute - segment.startMinute) / 1440 * 100;
    const count = Math.max(1, segment.columnCount);
    const index = Math.min(segment.columnIndex, count - 1);
    return `top:${top}%;height:max(2px,${height}%);left:${index / count * 100}%;width:${100 / count}%;`;
  }

  /** A small badge marks the start of each dense interval. */
  function groupStyle(group: DenseOverlapDisplay): string {
    const top = group.startMinute / 1440 * 100;
    return `top:${top}%;`;
  }
</script>

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
            class:alternative-highlight={previewGroupId !== null &&
              segment.entry.source.courseOfferingId === previewOfferingId &&
              segment.entry.source.studyGroupId === previewGroupId}
            class:alternative-dim={previewGroupId !== null &&
              segment.entry.source.courseOfferingId === previewOfferingId &&
              segment.entry.source.studyGroupId !== previewGroupId}
            style={segmentStyle(segment)}
            data-segment-id={segment.id}
          >
            <CalendarEvent
              {segment}
              presentation={presentationForSegment(segment)}
              onPreview={() => onPreview(segment.id)}
              onPreviewEnd={() => onPreviewEnd(segment.id)}
              onInspect={() => onInspect(segment.id)}
            />
          </div>
        {/each}
        {#each denseByDay[dayIndex] as display (display.id)}
          <div class="cluster" style={groupStyle(display)} data-overlap-group-id={display.group.id} data-dense-window-id={display.id}>
            <DenseOverlapCard {display} onOpen={() => onOpenGroup(display)} />
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
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
  .event.alternative-highlight { outline: 3px solid #0f766e; outline-offset: -2px; z-index: 2; }
  .event.alternative-dim { opacity: .38; }
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
</style>
