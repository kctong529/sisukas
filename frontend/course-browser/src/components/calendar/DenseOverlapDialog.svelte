<script lang="ts">
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';
  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import type { WeeklyCalendarLayoutResult, WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { DenseOverlapDisplay } from '@application/calendar/denseOverlapPresentation';
  import type { CalendarEntry } from '@domain/models/CalendarEntry';
  import { displayEntryLocations } from '@application/calendar/calendarDisplayAggregation';

  interface Props {
    group: DenseOverlapDisplay | null;
    layout: WeeklyCalendarLayoutResult;
    presentationForSegment: (segment: WeeklyCalendarSegment) => CalendarEventPresentation;
    onClose: () => void;
    membersForSegment?: (segment: WeeklyCalendarSegment) => readonly CalendarEntry[];
  }

  let { group: selectedGroup, layout, presentationForSegment, onClose, membersForSegment = segment => [segment.entry] }: Props = $props();
  let dialogElement: HTMLDialogElement;

  export function showModal(): void {
    dialogElement.showModal();
  }

  export function isOpen(): boolean {
    return dialogElement?.open ?? false;
  }
</script>

<dialog bind:this={dialogElement} onclose={onClose} aria-label="Overlapping calendar events" class="event-details">
  {#if selectedGroup}
    <header>
      <div>
        <h2>{selectedGroup.segments.length} calendar items in busy period</h2>
        <p>{layout.days[selectedGroup.group.dayIndex]} · {formatCalendarMinute(selectedGroup.startMinute)}–{formatCalendarMinute(selectedGroup.endMinute)} · Europe/Helsinki</p>
      </div>
      <form method="dialog"><button class="close" type="submit">Close</button></form>
    </header>
    <ul>
      {#each selectedGroup.segments as segment (segment.id)}
        {@const info = presentationForSegment(segment)}
        {@const members = membersForSegment(segment)}
        {@const locations = members.length > 1 ? displayEntryLocations(members) : []}
        <li>
          <strong>{info.courseCode ? `${info.courseCode} · ` : ''}{info.courseTitle}</strong>
          {#if info.groupLabel}<span>{info.groupLabel}</span>{/if}
          <span>{formatCalendarMinute(segment.startMinute)}–{formatCalendarMinute(segment.endMinute)}</span>
          {#if info.locationLabel}<span>{info.locationLabel}</span>{/if}
          {#if members.length > 1}
            <details><summary>{members.length} source events · Show listed rooms</summary>
              <ul class="rooms">{#each locations as room (room)}<li>{room}</li>{/each}</ul>
            </details>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</dialog>

<style>
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
  .event-details .rooms { list-style: disc; padding-left: 20px; margin-top: 6px; }
  .event-details .rooms li { display: list-item; padding: 0; background: transparent; }
  .event-details li span { color: #475569; font-variant-numeric: tabular-nums; }
</style>
