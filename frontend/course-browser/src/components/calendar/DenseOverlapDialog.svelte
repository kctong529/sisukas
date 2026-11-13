<script lang="ts">
  import { displayEntryLocations } from '@application/calendar/calendarDisplayAggregation';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';
  import { calendarSelectionLabel } from '@application/calendar/calendarSelectionPresentation';

  import type { OverlapChoice } from '@application/calendar/calendarOverlapChoice';
  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import type { DenseOverlapDisplay } from '@application/calendar/denseOverlapPresentation';
  import type { CalendarEntry } from '@domain/models/CalendarEntry';
  import type { CalendarGroupSelection } from '@domain/services/calendar/CalendarProjection';
  import type { WeeklyCalendarLayoutResult, WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';

  interface Props {
    group: DenseOverlapDisplay | null;
    layout: WeeklyCalendarLayoutResult;
    presentationForSegment: (segment: WeeklyCalendarSegment) => CalendarEventPresentation;
    onClose: () => void;
    overlapChoice?: (segment: WeeklyCalendarSegment) => OverlapChoice | null;
    onResolveOverlap?: (segment: WeeklyCalendarSegment) => void;
    membersForSegment?: (segment: WeeklyCalendarSegment) => readonly CalendarEntry[];
    selectionForSegment?: (segment: WeeklyCalendarSegment) => CalendarGroupSelection;
  }

  let { group: selectedGroup, layout, presentationForSegment, onClose, membersForSegment = segment => [segment.entry], selectionForSegment = () => 'candidate', overlapChoice = () => null, onResolveOverlap = () => {} }: Props = $props();
  let dialogElement: HTMLDialogElement;

  export function showModal(): void {
    dialogElement.showModal();
  }

  export function isOpen(): boolean {
    return dialogElement?.open ?? false;
  }

  function resolveInDialog(segment: WeeklyCalendarSegment): void {
    if (!overlapChoice(segment)?.available) return;
    onResolveOverlap(segment);
    // HTMLDialogElement.close is not implemented in jsdom. Native browsers use close().
    if (typeof dialogElement.close === 'function') dialogElement.close();
    else { dialogElement.removeAttribute('open'); onClose(); }
  }

  function handleBackdropPointerDown(event: PointerEvent): void {
    // A click on the backdrop targets the <dialog> itself. Clicks inside
    // its visible rectangle must not close it (including dialog padding).
    if (event.target !== dialogElement) return;
    const bounds = dialogElement.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) dialogElement.close();
  }
</script>

<dialog bind:this={dialogElement} onclose={onClose} onpointerdown={handleBackdropPointerDown} aria-label="Overlapping calendar events" class="event-details">
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
        {@const choice = overlapChoice(segment)}
        <li>
          <strong>{info.courseCode ? `${info.courseCode} · ` : ''}{info.courseTitle}</strong>
          {#if info.groupLabel}<span>{info.groupLabel}</span>{/if}
          <span data-selection={selectionForSegment(segment)}>{calendarSelectionLabel(selectionForSegment(segment))}</span>
          <span>{formatCalendarMinute(segment.startMinute)}–{formatCalendarMinute(segment.endMinute)}</span>
          {#if info.locationLabel}<span>{info.locationLabel}</span>{/if}
          {#if choice}
            <button type="button" class="resolve-overlap" onclick={() => resolveInDialog(segment)}
              disabled={!choice.available} title={choice.reason ?? undefined}>
              {choice.available ? `Keep this · Hide ${choice.overlapCount} overlapping ${choice.overlapCount === 1 ? 'event' : 'events'}` : 'Cannot resolve overlaps'}
            </button>
          {/if}
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
  .event-details { border: 1px solid var(--calendar-border, #e2e8f0); border-radius: var(--ui-radius-dialog); padding: 1.25rem; max-width: min(560px, calc(100vw - 32px)); width: 100%; max-height: min(75vh, 650px); overflow-y: auto; color: var(--calendar-text, #1e293b); background: var(--calendar-card, #fff); box-shadow: 0 16px 42px #0f172a40; }
  .event-details::backdrop { background: #0f172a80; }
  .event-details header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  .event-details h2 { font-size: 1.1rem; margin: 0 0 4px; }
  .event-details p { margin: 0; font-size: 0.82rem; color: #475569; }
  .event-details .close { border: 1px solid var(--calendar-border, #e2e8f0); border-radius: 6px; color: var(--calendar-text, #1e293b); background: var(--calendar-card, #fff); padding: 0.4rem 0.7rem; cursor: pointer; font: inherit; font-size: 0.8rem; }
  .event-details .close:hover { border-color: var(--calendar-primary, #2f7fd6); background: #f1f5f9; }
  .event-details .close:focus-visible { outline: 3px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
  .event-details ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .event-details li { display: flex; flex-direction: column; gap: 2px; padding: 10px; background: #f1f5f9; border-radius: 6px; font-size: 0.85rem; }
  .event-details li strong { overflow-wrap: anywhere; }
  .event-details .resolve-overlap { align-self: flex-start; margin-top: 0.4rem; border: 1px solid var(--calendar-border, #e2e8f0); border-radius: 6px; background: var(--calendar-card, #fff); color: var(--calendar-primary, #2f7fd6); padding: 0.4rem 0.6rem; font: inherit; font-size: 0.75rem; cursor: pointer; }
  .event-details .resolve-overlap:disabled { opacity: 0.55; cursor: not-allowed; }
  .event-details .resolve-overlap:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
  .event-details .rooms { list-style: disc; padding-left: 20px; margin-top: 6px; }
  .event-details .rooms li { display: list-item; padding: 0; background: transparent; }
  .event-details li span { color: #475569; font-variant-numeric: tabular-nums; }
</style>
