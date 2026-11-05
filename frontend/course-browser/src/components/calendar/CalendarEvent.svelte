<script lang="ts">
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import { formatCalendarMinute, displayEventLocation } from '@application/calendar/calendarPresentation';

  interface Props {
    segment: WeeklyCalendarSegment;
    label: string;
  }

  let { segment, label }: Props = $props();
  const cancelled = $derived(segment.entry.source.event.cancelled);
  const excluded = $derived(segment.entry.source.event.excluded);
  const location = $derived(displayEventLocation(segment.entry.source.event));
  const range = $derived(`${formatCalendarMinute(segment.startMinute)}–${formatCalendarMinute(segment.endMinute)}`);
  const compact = $derived(segment.endMinute - segment.startMinute < 45);
  const continuation = $derived([
    segment.continuesBefore ? 'Continues from earlier' : null,
    segment.continuesAfter ? 'Continues later' : null,
  ].filter(Boolean).join('; '));
  const accessibleText = $derived([
    label, `Study group ${segment.entry.source.studyGroupId}`, range,
    cancelled ? 'Cancelled' : excluded ? 'Excluded' : null,
    location, continuation,
  ].filter(Boolean).join(', '));
</script>

<div
  class="calendar-event"
  class:compact
  class:cancelled
  class:excluded
  title={accessibleText}
  role="group"
  aria-label={accessibleText}
  data-compact={compact}
>
  <span class="event-title">
    {#if segment.continuesBefore}<span class="continuation" aria-hidden="true">↤ </span>{/if}
    {label}
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
</div>

<style>
  .calendar-event {
    box-sizing: border-box;
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
  .calendar-event.compact { padding: 1px 4px; }
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
    .event-time, .event-location { display: none; }
  }
</style>
