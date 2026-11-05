<script lang="ts">
  import type {
    WeeklyCalendarLayoutResult,
    WeeklyCalendarSegment,
  } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';
  import CalendarEvent from './CalendarEvent.svelte';

  interface Props {
    layout: WeeklyCalendarLayoutResult;
    labelForSegment: (segment: WeeklyCalendarSegment) => string;
  }
  let { layout, labelForSegment }: Props = $props();

  const hours = Array.from({ length: 25 }, (_, i) => i);
  const segmentsByDay = $derived(
    layout.days.map((_, dayIndex) => layout.segments.filter(s => s.dayIndex === dayIndex))
  );

  /** Percentage geometry is derived only from the domain layout result. */
  function segmentStyle(segment: WeeklyCalendarSegment): string {
    const top = segment.startMinute / 1440 * 100;
    const height = Math.max(0, segment.endMinute - segment.startMinute) / 1440 * 100;
    const count = Math.max(1, segment.columnCount);
    const index = Math.min(segment.columnIndex, count - 1);
    return `top:${top}%;height:max(2px,${height}%);left:${index / count * 100}%;width:${100 / count}%;`;
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
      </div>
    {/each}
  </div>
</div>

<style>
  .week-scroll { overflow-x: auto; border: 1px solid #dce4ee; border-radius: 8px; background: #fff; }
  .week-grid { display: grid; grid-template-columns: 60px repeat(7, minmax(145px, 1fr)); min-width: 1075px; }
  .corner, .day-heading { position: sticky; top: 0; background: #f1f5f9; z-index: 2; border-bottom: 1px solid #cbd5e1; }
  .day-heading { padding: 12px 4px; text-align: center; font-size: 0.85rem; font-weight: 600; border-left: 1px solid #e2e8f0; }
  .time-axis, .day-column { height: 960px; position: relative; }
  .time-axis span { position: absolute; right: 8px; font-size: 0.7rem; color: #64748b; transform: translateY(-45%); }
  .day-column { border-left: 1px solid #e2e8f0; background: repeating-linear-gradient(to bottom, transparent 0, transparent calc(100% / 24 - 1px), #e2e8f0 calc(100% / 24 - 1px), #e2e8f0 calc(100% / 24)); }
  .event { container: calendar-card / inline-size; position: absolute; box-sizing: border-box; overflow: hidden; border: 1px solid #1d4ed8; border-radius: 4px; background: #dbeafe; color: #1e3a8a; font-size: 0.68rem; line-height: 1.25; }
  .event.inactive { border-style: dashed; border-color: #94a3b8; background: #f1f5f9; color: #475569; }
  .event.cancelled { border-color: #b91c1c; background: #fee2e2; color: #7f1d1d; }
</style>
