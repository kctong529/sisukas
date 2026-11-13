<script lang="ts">
  import { onMount } from 'svelte';

  import { calendarDayHeading } from '@application/calendar/calendarDayHeading';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';

  import CalendarEvent from './CalendarEvent.svelte';
  import DenseOverlapCard from './DenseOverlapCard.svelte';

  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import type { DenseOverlapDisplay } from '@application/calendar/denseOverlapPresentation';
  import type { CalendarGroupSelection } from '@domain/services/calendar/CalendarProjection';
  import type { WeeklyCalendarLayoutResult, WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';

  interface Props {
    layout: WeeklyCalendarLayoutResult;
    colorByOffering: Readonly<Record<string, number>>;
    visibleSegments: WeeklyCalendarSegment[];
    previewOnlySegments?: readonly WeeklyCalendarSegment[];
    denseGroups: DenseOverlapDisplay[];
    presentationForSegment: (segment: WeeklyCalendarSegment) => CalendarEventPresentation;
    selectionForSegment: (segment: WeeklyCalendarSegment) => CalendarGroupSelection;
    onPreview: (id: string) => void;
    onPreviewEnd: (id: string) => void;
    onInspect: (id: string) => void;
    onOpenGroup: (group: DenseOverlapDisplay) => void;
    previewGroupId?: string | null;
    previewOfferingId?: string | null;
    previewCourseId?: string | null;
    previewOccurrenceId?: string | null;
  }

  let {
    layout, colorByOffering, visibleSegments, previewOnlySegments = [], denseGroups, presentationForSegment, selectionForSegment,
    onPreview, onPreviewEnd, onInspect, onOpenGroup,
    previewGroupId = null, previewOfferingId = null, previewCourseId = null, previewOccurrenceId = null,
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
  const previewOnlyByDay = $derived(layout.days.map((_, dayIndex) =>
    previewOnlySegments.filter(segment => segment.dayIndex === dayIndex)));

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
      <div class="day-column" role="group" aria-label={date}>
        {#each previewOnlyByDay[dayIndex] as segment (segment.id)}
          <!-- Ephemeral placement guide only: no click, conflict, or planning semantics. -->
          <div class="hidden-preview" style={segmentStyle(segment)}
            data-preview-segment-id={segment.id} aria-hidden="true">
            <span>{segment.entry.source.studyGroupName || segment.entry.source.studyGroupId}</span>
          </div>
        {/each}
        {#each segmentsByDay[dayIndex] as segment (segment.id)}
          <div
            class="event"
            class:occurrence-highlight={previewOccurrenceId !== null && segment.id === previewOccurrenceId}
            class:occurrence-dim={previewOccurrenceId !== null && segment.id !== previewOccurrenceId}
            class:course-highlight={previewOccurrenceId === null && previewGroupId === null && previewCourseId !== null && segment.entry.source.courseOfferingId === previewCourseId}
            class:course-dim={previewOccurrenceId === null && previewGroupId === null && previewCourseId !== null && segment.entry.source.courseOfferingId !== previewCourseId}
            class:inactive={!segment.conflictEligible}
            class:cancelled={segment.entry.source.event.cancelled}
            class:alternative-highlight={previewOccurrenceId === null && previewGroupId !== null &&
              segment.entry.source.courseOfferingId === previewOfferingId &&
              segment.entry.source.studyGroupId === previewGroupId}
            class:alternative-dim={previewOccurrenceId === null && previewGroupId !== null &&
              segment.entry.source.courseOfferingId === previewOfferingId &&
              segment.entry.source.studyGroupId !== previewGroupId}
            style={segmentStyle(segment)}
            data-segment-id={segment.id}
            data-offering-color={colorByOffering[segment.entry.source.courseOfferingId] ?? 0}
          >
            <CalendarEvent
              {segment}
              selection={selectionForSegment(segment)}
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
    border: 1px solid var(--calendar-border, #e2e8f0);
    border-radius: var(--ui-radius-surface);
    background: var(--calendar-card, #fff);
  }
  .week-scroll:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
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
    border-bottom: 1px solid var(--calendar-border, #e2e8f0);
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
  .day-name { font-size: 0.8rem; font-weight: 700; color: var(--calendar-text, #1e293b); }
  .day-date { font-size: 0.75rem; color: var(--calendar-muted, #64748b); }
  .time-axis, .day-column { height: 1440px; position: relative; }
  .time-axis { position: sticky; left: 0; z-index: 3; background: var(--calendar-card, #fff); }
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
  .event, .cluster, .hidden-preview { position: absolute; box-sizing: border-box; overflow: hidden; border-radius: 4px; }
  /* A visibility-hidden event is shown only as a noninteractive location guide.
     It is deliberately distinct from a normal scheduled event. */
  .hidden-preview {
    z-index: 2;
    pointer-events: none;
    border: 2px dashed #0f766e;
    background: repeating-linear-gradient(135deg, #ccfbf1b0 0 5px, #f0fdfaab 5px 10px);
    color: #115e59;
    font-size: .67rem;
    line-height: 1.25;
    padding: .25rem;
    min-width: 0;
  }
  .hidden-preview span { font-weight: 600; overflow-wrap: anywhere; }

  /* Preserve contrasting event states and dense-lane readability. */
  /* First six hues are LEGO's block colors; the remaining six extend the palette. */
  .event[data-offering-color="0"] { --event-rgb: 234, 88, 12; }
  .event[data-offering-color="1"] { --event-rgb: 21, 128, 61; }
  .event[data-offering-color="2"] { --event-rgb: 124, 58, 237; }
  .event[data-offering-color="3"] { --event-rgb: 2, 132, 199; }
  .event[data-offering-color="4"] { --event-rgb: 245, 158, 11; }
  .event[data-offering-color="5"] { --event-rgb: 219, 39, 119; }
  .event[data-offering-color="6"] { --event-rgb: 13, 148, 136; }
  .event[data-offering-color="7"] { --event-rgb: 79, 70, 229; }
  .event[data-offering-color="8"] { --event-rgb: 190, 24, 93; }
  .event[data-offering-color="9"] { --event-rgb: 101, 163, 13; }
  .event[data-offering-color="10"] { --event-rgb: 180, 83, 9; }
  .event[data-offering-color="11"] { --event-rgb: 8, 145, 178; }
  .event { container: calendar-card / inline-size; border: 1px solid rgb(var(--event-rgb, 47, 127, 214)); background: color-mix(in srgb, rgb(var(--event-rgb, 47, 127, 214)) 14%, white); color: color-mix(in srgb, rgb(var(--event-rgb, 47, 127, 214)) 60%, black); font-size: 0.68rem; line-height: 1.25; }
  .event.occurrence-highlight { outline: 3px solid #0f766e; outline-offset: -2px; z-index: 2; }
  .event.occurrence-dim { opacity: .35; }
  .event.course-highlight { outline: 3px solid var(--calendar-primary, #2f7fd6); outline-offset: -2px; z-index: 2; }
  .event.course-dim { opacity: .28; }
  .event.alternative-highlight { outline: 3px solid #0f766e; outline-offset: -2px; z-index: 2; }
  .event.alternative-dim { opacity: .38; }
  .event:hover, .event:focus-within { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: -2px; z-index: 2; }
  .event.inactive { border-style: dashed; border-color: #94a3b8; background: #f1f5f9; color: #475569; }
  .event.cancelled { border-color: var(--ui-danger); background: var(--ui-danger-surface); color: var(--ui-danger-text); }
  .cluster {
    z-index: 3;
    right: 3px;
    width: max-content;
    max-width: calc(100% - 6px);
    height: 26px;
    overflow: visible;
  }
</style>
