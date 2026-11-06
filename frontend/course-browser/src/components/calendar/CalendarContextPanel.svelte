<script lang="ts">
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';
  import type { CalendarGroupAlternative } from '@application/calendar/calendarGroupAlternatives';
  import type { CalendarEntry } from '@domain/models/CalendarEntry';
  import CalendarGroupAlternatives from './CalendarGroupAlternatives.svelte';
  import CalendarDetailsHeading from './CalendarDetailsHeading.svelte';
  import CalendarLocationList from './CalendarLocationList.svelte';
  import { calendarSelectionLabel } from '@application/calendar/calendarSelectionPresentation';
  import type { CalendarGroupSelection } from '@domain/services/calendar/CalendarProjection';

  interface Props {
    segment: WeeklyCalendarSegment | null;
    presentation: CalendarEventPresentation | null;
    date: string | null;
    isPinned: boolean;
    selection?: CalendarGroupSelection;
    onClear: () => void;
    onShowCourse?: () => void;
    onHideGroup?: () => void;
    onHideOccurrence?: () => void;
    canHideOccurrence?: boolean;
    members?: readonly CalendarEntry[];
    alternatives?: readonly CalendarGroupAlternative[];
    previewGroupId?: string | null;
    retainedGroupId?: string | null;
    onAlternativePreview?: (id: string | null) => void;
    onAlternativeToggle?: (id: string) => void;
  }
  let {
    segment, presentation, date, isPinned, selection = 'candidate', onClear, onShowCourse = () => {}, members = [],
    onHideGroup = () => {}, onHideOccurrence = () => {}, canHideOccurrence = true,
    alternatives = [], previewGroupId = null, retainedGroupId = null,
    onAlternativePreview = () => {}, onAlternativeToggle = () => {},
  }: Props = $props();
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
        {#if presentation.locationLabel}
          <dt>Location</dt><dd>{presentation.locationLabel}</dd>
        {/if}
        <dt>Plan choice</dt><dd data-selection={selection}>{calendarSelectionLabel(selection)}</dd>
        <dt>Status</dt>
        <dd>{segment.entry.source.event.cancelled ? 'Cancelled' : segment.entry.source.event.excluded ? 'Excluded' : 'Scheduled occurrence'}</dd>
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
        <button type="button" onclick={onShowCourse}>Course overview and visibility</button>
        <button type="button" onclick={onHideGroup}>Hide teaching group</button>
        <button type="button" onclick={onHideOccurrence} disabled={!canHideOccurrence} title={canHideOccurrence ? undefined : 'This event has no unambiguous source identity'}>Hide this event</button>
      </div>
      <CalendarGroupAlternatives
        {alternatives}
        {previewGroupId}
        {retainedGroupId}
        onPreview={onAlternativePreview}
        onTogglePreview={onAlternativeToggle}
      />
    </div>
  {:else}
    <CalendarDetailsHeading kind="Event" titleId="calendar-context-title" code={null}
      title="" {isPinned} {onClear} />
    <p class="empty">Hover over an event, use Tab to focus one, or click it to pin its details here.</p>
  {/if}
</aside>

<style>
  .visibility-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.85rem; }
  .visibility-actions button { border: 1px solid var(--calendar-border, #e2e8f0); border-radius: 6px; background: var(--calendar-card, #fff); color: var(--calendar-primary, #2f7fd6); padding: 0.4rem 0.6rem; font: inherit; font-size: 0.75rem; cursor: pointer; }
  .visibility-actions button:disabled { opacity: .55; cursor: not-allowed; }
  .visibility-actions button:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
  .context-panel { box-sizing: border-box; min-width: 0; padding: 1rem; border: 1px solid var(--calendar-border, #e2e8f0); border-radius: 8px; background: var(--calendar-card, #fff); color: var(--calendar-text, #1e293b); }
  .group { font-weight: 600; font-size: 0.85rem; margin: 0 0 0.75rem; }
  dl { display: grid; grid-template-columns: 65px minmax(0, 1fr); gap: 0.6rem; font-size: 0.8rem; margin: 0; }
  dt { color: var(--calendar-muted, #64748b); }
  dd { margin: 0; overflow-wrap: anywhere; }
  .empty, .hint, .continuation { font-size: 0.8rem; line-height: 1.5; color: var(--calendar-muted, #64748b); }
  .hint { margin: 0.75rem 0 0; }
  @media (max-width: 1000px) { .context-panel { margin-top: 4px; } }
</style>
