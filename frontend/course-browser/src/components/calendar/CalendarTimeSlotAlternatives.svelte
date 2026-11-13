<script lang="ts">
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';

  import type { TimeSlotAlternative } from '@application/calendar/calendarTimeSlotAlternatives';
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';

  interface Props {
    alternatives: readonly TimeSlotAlternative[];
    onRestore: (segment: WeeklyCalendarSegment) => void;
    onHide: (segment: WeeklyCalendarSegment) => void;
    onPreview: (segment: WeeklyCalendarSegment | null) => void;
  }

  let { alternatives, onRestore, onHide, onPreview }: Props = $props();
</script>

{#if alternatives.length > 0}
  <section class="time-slot-alternatives" aria-label="Overlapping events from all courses">
    <header>
      <h3>Overlapping events</h3>
      <span>{alternatives.length} alternatives</span>
    </header>
    <p class="help">Click an event to show or hide it. Hover or focus on a hidden event to preview it.</p>
    <ul>
      {#each alternatives as alternative (alternative.segment.entry)}
        <li>
          <button type="button" class:concealed={alternative.hidden}
            onclick={() => alternative.hidden ? onRestore(alternative.segment) : onHide(alternative.segment)}
            onpointerenter={() => onPreview(alternative.hidden ? alternative.segment : null)}
            onpointerleave={() => onPreview(null)}
            onfocus={() => onPreview(alternative.hidden ? alternative.segment : null)}
            onblur={() => onPreview(null)}
            disabled={!alternative.canRestore}
            title={alternative.canRestore ? undefined : 'This event has an ambiguous source identity'}
            aria-label={`${alternative.hidden ? 'Show' : 'Hide'} ${alternative.presentation.courseCode ?? alternative.presentation.courseTitle}, ${alternative.presentation.groupLabel ?? alternative.segment.entry.source.studyGroupId}`}>
            <span class="description">
              <strong>{alternative.presentation.courseCode ? `${alternative.presentation.courseCode} · ` : ''}{alternative.presentation.courseTitle}</strong>
              <span>{alternative.presentation.groupLabel ?? alternative.segment.entry.source.studyGroupId}</span>
              <span>{formatCalendarMinute(alternative.segment.startMinute)}–{formatCalendarMinute(alternative.segment.endMinute)}</span>
            </span>
            <span class="visibility-state" class:hidden={alternative.hidden}>{alternative.hidden ? 'Hidden' : 'Visible'}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .time-slot-alternatives {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--calendar-border, #e2e8f0);
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  h3 { margin: 0; font-size: 0.9rem; }
  header > span { flex: 0 0 auto; }
  header > span, .help {
    color: var(--calendar-muted, #64748b);
    font-size: 0.78rem;
  }
  .help {
    margin: 0.3rem 0 0.65rem;
    line-height: 1.45;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  li { margin: 0; }
  li > button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--calendar-border, #e2e8f0);
    border-radius: 6px;
    background: #f8fafc;
    color: var(--calendar-text, #1e293b);
    font: inherit;
    font-size: 0.8rem;
    text-align: left;
    cursor: pointer;
  }
  li > button:hover:not(:disabled), li > button:focus-visible {
    border-color: var(--calendar-primary, #2f7fd6);
    background: #eff6ff;
  }
  li > button:focus-visible {
    outline: 2px solid var(--calendar-primary, #2f7fd6);
    outline-offset: 2px;
  }
  li > button.concealed { border-style: dashed; }
  li > button:disabled { opacity: 0.55; cursor: not-allowed; }
  .description {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .description strong {
    font-size: inherit;
    font-weight: 600;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .description span {
    color: var(--calendar-muted, #64748b);
    font-size: 0.75rem;
    line-height: 1.3;
  }
  .visibility-state {
    flex: 0 0 auto;
    color: var(--calendar-muted, #64748b);
    font-size: 0.75rem;
    font-weight: 500;
  }
  .visibility-state.hidden { font-style: italic; }
</style>
