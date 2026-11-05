<script lang="ts">
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { CalendarEventPresentation } from '@application/calendar/calendarPresentation';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';
  import type { CalendarGroupAlternative } from '@application/calendar/calendarGroupAlternatives';
  import type { CalendarEntry } from '@domain/models/CalendarEntry';
  import CalendarGroupAlternatives from './CalendarGroupAlternatives.svelte';
  import CalendarLocationList from './CalendarLocationList.svelte';

  interface Props {
    segment: WeeklyCalendarSegment | null;
    presentation: CalendarEventPresentation | null;
    date: string | null;
    isPinned: boolean;
    onClear: () => void;
    members?: readonly CalendarEntry[];
    alternatives?: readonly CalendarGroupAlternative[];
    previewGroupId?: string | null;
    retainedGroupId?: string | null;
    onAlternativePreview?: (id: string | null) => void;
    onAlternativeToggle?: (id: string) => void;
  }
  let {
    segment, presentation, date, isPinned, onClear, members = [],
    alternatives = [], previewGroupId = null, retainedGroupId = null,
    onAlternativePreview = () => {}, onAlternativeToggle = () => {},
  }: Props = $props();
  const range = $derived(segment
    ? `${formatCalendarMinute(segment.startMinute)}–${formatCalendarMinute(segment.endMinute)}`
    : null);
</script>

<aside class="context-panel" aria-labelledby="calendar-context-title">
  <header>
    <h2 id="calendar-context-title">Event details</h2>
    <button type="button" class="clear" onclick={onClear} disabled={!isPinned}>Clear selection</button>
  </header>
  {#if segment && presentation}
    <div class="event-information" aria-live="off">
      {#if presentation.courseCode}<p class="code">{presentation.courseCode}</p>{/if}
      <h3>{presentation.courseTitle}</h3>
      {#if presentation.groupLabel}<p class="group">{presentation.groupLabel}</p>{/if}
      <dl>
        <dt>Date</dt><dd>{date}</dd>
        <dt>Time</dt><dd>{range} · Europe/Helsinki</dd>
        {#if presentation.locationLabel}
          <dt>Location</dt><dd>{presentation.locationLabel}</dd>
        {/if}
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
      {#if !isPinned}<p class="hint">Previewing · Select the event to keep its details here.</p>{/if}
      <CalendarGroupAlternatives
        {alternatives}
        {previewGroupId}
        {retainedGroupId}
        onPreview={onAlternativePreview}
        onTogglePreview={onAlternativeToggle}
      />
    </div>
  {:else}
    <p class="empty">Hover over an event, use Tab to focus one, or select it to keep its details here.</p>
  {/if}
</aside>

<style>
  .context-panel { box-sizing: border-box; min-width: 0; padding: 16px; border: 1px solid #dce4ee; border-radius: 8px; background: #fff; color: #0f172a; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 16px; }
  h2 { font-size: 1rem; margin: 0; }
  h3 { font-size: 1.05rem; margin: 4px 0 12px; overflow-wrap: anywhere; }
  .clear { border: 1px solid #94a3b8; background: #fff; border-radius: 5px; padding: 5px 8px; cursor: pointer; font-size: .75rem; }
  .clear:focus-visible { outline: 2px solid #2563eb; }
  .clear:disabled { opacity: .55; cursor: not-allowed; }
  .code { font-size: .85rem; font-weight: 700; color: #1d4ed8; margin: 0; }
  .group { font-weight: 600; font-size: .88rem; margin: 0 0 14px; }
  dl { display: grid; grid-template-columns: 65px minmax(0, 1fr); gap: 10px; font-size: .84rem; margin: 0; }
  dt { color: #64748b; }
  dd { margin: 0; overflow-wrap: anywhere; }
  .empty, .hint, .continuation { font-size: .84rem; line-height: 1.5; color: #475569; }
  .hint { margin: 16px 0 0; }
  @media (max-width: 1000px) { .context-panel { margin-top: 4px; } }
</style>
