<script lang="ts">
  import { calendarEventLocationRows } from '@application/calendar/calendarEventLocationRows';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';

  import CalendarDetailsHeading from './CalendarDetailsHeading.svelte';
  import CalendarGroupAlternatives from './CalendarGroupAlternatives.svelte';
  import CalendarLocationList from './CalendarLocationList.svelte';
  import CalendarTimeSlotAlternatives from './CalendarTimeSlotAlternatives.svelte';

  import type { CalendarGroupAlternative } from '@application/calendar/calendarGroupAlternatives';
  import type { OverlapChoice } from '@application/calendar/calendarOverlapChoice';
  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import type { TimeSlotAlternative } from '@application/calendar/calendarTimeSlotAlternatives';
  import type { CalendarEntry } from '@domain/models/CalendarEntry';
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';

  interface Props {
    segment: WeeklyCalendarSegment | null;
    presentation: CalendarEventPresentation | null;
    date: string | null;
    isPinned: boolean;
    onClear: () => void;
    onShowCourse?: () => void;
    onHideGroup?: () => void;
    onHideOccurrence?: () => void;
    canHideOccurrence?: boolean;
    overlapChoice?: OverlapChoice | null;
    onResolveOverlap?: () => void;
    members?: readonly CalendarEntry[];
    alternatives?: readonly CalendarGroupAlternative[];
    previewGroupId?: string | null;
    retainedGroupId?: string | null;
    onAlternativePreview?: (id: string | null) => void;
    onAlternativeToggle?: (id: string) => void;
    onAlternativeChoose?: (id: string) => void;
    alternativeContextKey?: string | null;
    timeSlotAlternatives?: readonly TimeSlotAlternative[];
    onRestoreTimeSlot?: (segment: WeeklyCalendarSegment) => void;
    onHideTimeSlot?: (segment: WeeklyCalendarSegment) => void;
    onPreviewTimeSlot?: (segment: WeeklyCalendarSegment | null) => void;
  }
  let {
    segment, presentation, date, isPinned, onClear, onShowCourse = () => {}, members = [],
    onHideGroup = () => {}, onHideOccurrence = () => {}, canHideOccurrence = true,
    overlapChoice = null, onResolveOverlap = () => {},
    alternatives = [], previewGroupId = null, retainedGroupId = null,
    onAlternativePreview = () => {}, onAlternativeToggle = () => {},
    onAlternativeChoose = () => {}, alternativeContextKey = null,
    timeSlotAlternatives = [], onRestoreTimeSlot = () => {}, onHideTimeSlot = () => {}, onPreviewTimeSlot = () => {},
  }: Props = $props();
  const locationRows = $derived(segment ? calendarEventLocationRows(segment.entry.source.event) : null);
  const range = $derived(segment
    ? `${formatCalendarMinute(segment.startMinute)}–${formatCalendarMinute(segment.endMinute)}`
    : null);
</script>

<aside class="context-panel" aria-labelledby="calendar-context-title">
  {#if segment && presentation}
    <CalendarDetailsHeading kind="Event" titleId="calendar-context-title"
      code={presentation.courseCode} title={presentation.courseTitle} {isPinned} {onClear} />
    <div class="event-information" aria-live="off">
      {#if presentation.groupLabel}<p class="group">{presentation.groupLabel}</p>{/if}
      <dl>
        <dt>Date</dt><dd>{date}</dd>
        <dt>Time</dt><dd>{range} · Europe/Helsinki</dd>
        {#if locationRows?.location}
          <dt>Location</dt>
          <dd class="location-row">{locationRows.location}</dd>
        {/if}
        {#if locationRows?.building}
          <dt>Building</dt>
          <dd class="location-row">{locationRows.building}</dd>
        {/if}
        {#if segment.entry.source.event.notice}
          <dt>Notice</dt><dd>{segment.entry.source.event.notice}</dd>
        {/if}
      </dl>
      {#if members.length > 1}
        <CalendarLocationList {members} />
      {/if}
      {#if segment.continuesBefore || segment.continuesAfter}
        <p class="continuation">This occurrence continues beyond the visible day.</p>
      {/if}
      {#if !isPinned}<p class="hint">Previewing · Click the event to pin its details here.</p>{/if}
      <div class="visibility-actions" aria-label="Calendar visibility">
        <button type="button" class="ui-button ui-button--secondary" onclick={onShowCourse}>Course overview and visibility</button>
        <button type="button" class="ui-button ui-button--secondary" onclick={onHideGroup}>Hide teaching group</button>
        <button type="button" class="ui-button ui-button--secondary" onclick={onHideOccurrence} disabled={!canHideOccurrence} title={canHideOccurrence ? undefined : 'This event has no unambiguous source identity'}>Hide this event</button>
        {#if overlapChoice}
          <button type="button" class="ui-button ui-button--secondary resolve-overlap" onclick={onResolveOverlap}
            disabled={!overlapChoice.available} title={overlapChoice.reason ?? undefined}>
            {overlapChoice.available ? `Keep this · Hide ${overlapChoice.overlapCount} overlapping ${overlapChoice.overlapCount === 1 ? 'event' : 'events'}` : 'Cannot resolve overlaps'}
          </button>
        {/if}
      </div>
      <CalendarTimeSlotAlternatives alternatives={timeSlotAlternatives}
        onRestore={onRestoreTimeSlot} onHide={onHideTimeSlot} onPreview={onPreviewTimeSlot} />
      <CalendarGroupAlternatives
        {alternatives}
        {previewGroupId}
        {retainedGroupId}
        onPreview={onAlternativePreview}
        onTogglePreview={onAlternativeToggle}
        onChoose={onAlternativeChoose}
        contextKey={alternativeContextKey}
      />
    </div>
  {:else}
    <CalendarDetailsHeading kind="Event" titleId="calendar-context-title" code={null}
      title="" {isPinned} {onClear} />
    <p class="empty">Hover over an event, use Tab to focus one, or click it to pin its details here.</p>
  {/if}
</aside>

<style>
  .visibility-actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); margin-top: 0.85rem; }
  .visibility-actions .ui-button { height: auto; min-height: 32.5px; padding: 0.4rem 0.6rem; font-size: 0.75rem; white-space: normal; }
  .context-panel { box-sizing: border-box; min-width: 0; padding: var(--ui-space-4); border: 1px solid var(--calendar-border, #e2e8f0); border-radius: var(--ui-radius-surface); background: var(--calendar-card, #fff); color: var(--calendar-text, #1e293b); }
  .group { font-weight: 600; font-size: 0.85rem; margin: 0 0 0.75rem; }
  dl { display: grid; grid-template-columns: 65px minmax(0, 1fr); gap: 0.6rem; font-size: 0.8rem; margin: 0; }
  dt { color: var(--calendar-muted, #64748b); }
  dd { margin: 0; overflow-wrap: anywhere; }
  .empty, .hint, .continuation { font-size: 0.8rem; line-height: 1.5; color: var(--calendar-muted, #64748b); }
  .hint { margin: 0.75rem 0 0; }
  @media (max-width: 1000px) { .context-panel { margin-top: 4px; } }
</style>
