<script lang="ts">
  import { academicPeriodStore } from '../lib/stores/academicPeriodStore';
  import { overlaps, type DateRange } from '../domain/valueObjects/DateRange';

  let { courseDate }: { courseDate: DateRange } = $props();
  let showAcademicYear = $state(false);

  const academicYear = $derived.by(() => {
    const matchingYears = ($academicPeriodStore ?? [])
      .filter(period => overlaps(courseDate, period.dateRange))
      .map(period => period.academicYear);

    return matchingYears.length > 0
      ? matchingYears.reduce((earliest, year) => year < earliest ? year : earliest)
      : null;
  });

  const academicYearLabel = $derived(
    academicYear?.replace('-', ' – ') ?? null
  );

  const dateLabel = $derived(
    `${formatDate(courseDate.start)} – ${formatDate(courseDate.end)}`
  );

  function formatDate(date: Date): string {
    return date.toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit' });
  }
</script>

{#if academicYear}
  <button
    type="button"
    class="card-period"
    aria-pressed={showAcademicYear}
    aria-label={showAcademicYear ? 'Show course dates' : 'Show academic year'}
    onclick={() => showAcademicYear = !showAcademicYear}
  >
    {showAcademicYear ? academicYearLabel : dateLabel}
  </button>
{:else}
  <span class="card-period">{dateLabel}</span>
{/if}

<style>
  .card-period {
    background: #2f7fd6;
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
    font-family: inherit;
    white-space: nowrap;
  }

  button.card-period {
    border: 0;
    cursor: pointer;
  }

  button.card-period:focus-visible {
    outline: 2px solid #1d4ed8;
    outline-offset: 2px;
  }
</style>
