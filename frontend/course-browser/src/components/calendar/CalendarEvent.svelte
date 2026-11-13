<script lang="ts">
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';
  import { calendarSelectionLabel } from '@application/calendar/calendarSelectionPresentation';

  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import type { CalendarGroupSelection } from '@domain/services/calendar/CalendarProjection';
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';

  interface Props {
    segment: WeeklyCalendarSegment;
    presentation: CalendarEventPresentation;
    selection?: CalendarGroupSelection;
    onPreview?: () => void;
    onPreviewEnd?: () => void;
    onInspect?: () => void;
  }

  let { segment, presentation, selection = 'candidate', onPreview, onPreviewEnd, onInspect }: Props = $props();
  const instructionId = $props.id();
  const cancelled = $derived(segment.entry.source.event.cancelled);
  const excluded = $derived(segment.entry.source.event.excluded);
  const location = $derived(presentation.locationLabel);
  const range = $derived(`${formatCalendarMinute(segment.startMinute)}–${formatCalendarMinute(segment.endMinute)}`);
  const compact = $derived(segment.endMinute - segment.startMinute < 45);
  const continuation = $derived([
    segment.continuesBefore ? 'Continues from earlier' : null,
    segment.continuesAfter ? 'Continues later' : null,
  ].filter(Boolean).join('; '));
  const accessibleText = $derived([
    presentation.courseCode, presentation.courseTitle, presentation.groupLabel, range,
    cancelled ? 'Cancelled' : excluded ? 'Excluded' : null,
    calendarSelectionLabel(selection), location, continuation,
  ].filter(Boolean).join(', '));
</script>

<button
  type="button"
  class="calendar-event"
  onpointerenter={() => onPreview?.()}
  onpointerleave={() => onPreviewEnd?.()}
  onfocus={() => onPreview?.()}
  onblur={() => onPreviewEnd?.()}
  onclick={() => onInspect?.()}
  class:compact
  class:cancelled
  class:excluded
  title={accessibleText}
  aria-label={accessibleText}
  aria-describedby={instructionId}
  data-compact={compact}
  data-selection={selection}
>
  <span id={instructionId} class="sr-only">
    Focus to preview event details; activate to pin details in the panel. This does not select a teaching group.
  </span>
  <span class="event-heading">
    {#if presentation.courseCode}<span class="event-code">{presentation.courseCode}</span>{/if}
    {#if presentation.groupLabel}<span class="event-group">{presentation.groupLabel}</span>{/if}
  </span>
  {#if !compact}
    <span class="selection-label" class:selected={selection === 'selected'}>{calendarSelectionLabel(selection)}</span>
  {/if}
  <span class="event-title">
    {#if segment.continuesBefore}<span class="continuation" aria-hidden="true">↤ </span>{/if}
    {presentation.courseTitle}
    {#if segment.continuesAfter}<span class="continuation" aria-hidden="true"> ↦</span>{/if}
  </span>
  {#if !compact}
    <span class="event-time">{range}</span>
    {#if cancelled}
      <span class="event-status">Cancelled</span>
    {:else if excluded}
      <span class="event-status">Excluded</span>
    {/if}
    {#if location}<span class="event-location">{location}</span>{/if}
  {/if}
</button>

<style>
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  .calendar-event {
    box-sizing: border-box;
    appearance: none;
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: 4px 6px;
    overflow: hidden;
  }
  .calendar-event:focus-visible { outline: 3px solid var(--calendar-primary, #2f7fd6); outline-offset: -3px; }
  .calendar-event.compact { padding: 1px 4px; }
  .event-heading {
    display: flex;
    flex-wrap: wrap;
    gap: 1px 5px;
    min-width: 0;
    overflow: hidden;
    font-size: 0.9em;
  }
  .selection-label { font-size: .72em; color: #475569; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .selection-label.selected { color: #166534; font-weight: 700; }
  .event-code { font-weight: 750; }
  .event-group { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .event-title {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    font-weight: 650;
    overflow-wrap: normal;
    word-break: normal;
  }
  .compact .event-heading { display: none; }
  .compact .event-title {
    display: block;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .event-time, .event-location, .event-status {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .event-time { font-variant-numeric: tabular-nums; }
  .event-status { font-weight: 650; }
  .continuation { font-weight: 800; }
  .cancelled .event-title { text-decoration: line-through; }
  /* Small lanes need a concise label, not several unreadable metadata rows. */
  @container calendar-card (max-width: 125px) {
    .selection-label { display: none; }
    .event-heading { display: block; }
    .event-group { display: none; }
  }
</style>
