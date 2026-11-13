<script lang="ts">
  import { currentHelsinkiWeek } from '@application/calendar/currentHelsinkiWeek';
  import { resolveHelsinkiWeek } from '@domain/services/calendar/layout/WeeklyCalendarTime';

  interface Props {
    weekStart: string;
    onPrevious: () => void;
    onNext: () => void;
    onToday: () => void;
  }

  let { weekStart, onPrevious, onNext, onToday }: Props = $props();
  const week = $derived(resolveHelsinkiWeek(weekStart));
  const isCurrentWeek = $derived(weekStart === currentHelsinkiWeek());

  function formatDisplayDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}.${month}.${year}`;
  }
</script>

<nav class="week-navigation" aria-label="Calendar week navigation">
  <div class="controls">
    <button type="button" class="ui-button ui-button--secondary" aria-label="Previous week" onclick={onPrevious}>←</button>
    <button type="button" class="ui-button ui-button--secondary" aria-label="Next week" onclick={onNext}>→</button>
    <button type="button" class="ui-button ui-button--secondary" onclick={onToday} disabled={isCurrentWeek}>Today</button>
  </div>
  <p class="week-range" aria-live="polite">
    <span class="dates">{formatDisplayDate(week.days[0])} – {formatDisplayDate(week.days[6])}</span>
  </p>
</nav>

<style>
  .week-navigation { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.85rem; margin-bottom: 1rem; }
  .controls { display: flex; gap: 0.35rem; align-items: center; }
  /* Preserve Calendar's original 34px navigation geometry. Shared UI
     primitives own colors, borders, hover, disabled, and focus states. */
  .controls :global(.ui-button) {
    height: 34px;
    min-height: 34px;
    min-width: 34px;
    padding: 0.4rem 0.7rem;
  }
  .week-range { margin: 0; display: flex; gap: 0.3rem 0.65rem; flex-wrap: wrap; align-items: baseline; }
  /* DD.MM.YYYY dates always have the same number of characters. Tabular numerals
     prevent the navigation width shifting as the week changes. */
  .dates {
    display: inline-block;
    width: 23ch;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    font-size: 0.9rem;
  }
</style>
