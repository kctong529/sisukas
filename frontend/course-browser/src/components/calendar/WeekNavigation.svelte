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
</script>

<nav class="week-navigation" aria-label="Calendar week navigation">
  <div class="controls">
    <button type="button" aria-label="Previous week" onclick={onPrevious}>←</button>
    <button type="button" aria-label="Next week" onclick={onNext}>→</button>
    <button type="button" onclick={onToday} disabled={isCurrentWeek}>Today</button>
  </div>
  <p class="week-range" aria-live="polite">
    <span class="dates">{week.days[0]} – {week.days[6]}</span>
    <span class="timezone">Europe/Helsinki</span>
  </p>
</nav>

<style>
  .week-navigation { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.85rem; margin-bottom: 1rem; }
  .controls { display: flex; gap: 0.35rem; align-items: center; }
  button {
    min-height: 34px;
    min-width: 34px;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--calendar-border, #e2e8f0);
    border-radius: 6px;
    background: var(--calendar-card, #fff);
    color: var(--calendar-text, #1e293b);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  button:hover:not(:disabled) { border-color: var(--calendar-primary, #2f7fd6); background: #f1f5f9; }
  button:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
  button:disabled { opacity: 0.55; cursor: default; }
  .week-range { margin: 0; display: flex; gap: 0.3rem 0.65rem; flex-wrap: wrap; align-items: baseline; }
  .dates { font-weight: 600; font-size: 0.9rem; }
  .timezone { font-size: 0.8rem; color: var(--calendar-muted, #64748b); }
</style>
