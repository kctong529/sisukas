<!-- src/components/PeriodSelector.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AcademicPeriod } from '../domain/models/AcademicPeriod';
  import { AcademicPeriodVisibility } from '../domain/services/AcademicPeriodVisibility';
  
  export let periods: AcademicPeriod[];
  export let selectedPeriods: string[] = [];
  export let visible: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let isSelecting = false;
  let firstSelectedIndex = -1;
  
  // Filtered list used by UI + selection range
  $: visiblePeriods = AcademicPeriodVisibility.currentAndFuture(periods);

  // Group periods by academic year (VISIBLE ONLY)
  $: groupedPeriods = visiblePeriods.reduce((acc, period) => {
    (acc[period.academicYear] ??= []).push(period);
    return acc;
  }, {} as Record<string, AcademicPeriod[]>);
  
  $: yearEntries = Object.entries(groupedPeriods);
  
  function isPeriodSelected(periodId: string): boolean {
    return selectedPeriods.includes(periodId);
  }

  function endSelection() {
    isSelecting = false;
  }

  function updateSelectionRange(index: number) {
    if (!isSelecting || firstSelectedIndex === -1) return;

    const start = Math.min(firstSelectedIndex, index);
    const end = Math.max(firstSelectedIndex, index);

    const allPeriods = visiblePeriods.map(p => p.id);
    selectedPeriods = allPeriods.slice(start, end + 1);
    dispatch('change', selectedPeriods);
  }
  
  // Mouse handlers
  function handleMouseDown(index: number, periodId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    isSelecting = true;
    firstSelectedIndex = index;
    selectedPeriods = [periodId];
    dispatch('change', selectedPeriods);
  }
  
  function handleMouseOver(index: number, event: MouseEvent) {
    event.stopPropagation();
    updateSelectionRange(index);
  }
  
  function handleMouseUp() {
    endSelection();
  }
  
  // Touch handlers
  function handleTouchStart(index: number, periodId: string, event: TouchEvent) {
    event.preventDefault();
    isSelecting = true;
    firstSelectedIndex = index;
    selectedPeriods = [periodId];
    dispatch('change', selectedPeriods);
  }
  
  function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    const touch = event.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element?.classList.contains('period')) {
      const index = parseInt(element.getAttribute('data-index') || '-1');
      if (index !== -1) updateSelectionRange(index);
    }
  }
  
  function handleTouchEnd() {
    endSelection();
  }

  function handleFocus() {
    // intentionally empty
  }

  function handleBlur() {
    endSelection();
  }

  // Keyboard handler
  function handleKeyDown(event: KeyboardEvent, index: number, periodId: string) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      firstSelectedIndex = index;
      selectedPeriods = [periodId];
      dispatch('change', selectedPeriods);
      isSelecting = true;
    }
    if (event.key === 'Escape') {
      endSelection();
    }
  }
</script>

{#if visible}
  <div class="periods-container">
    {#each yearEntries as [year, yearPeriods] (year)}
      <div class="year-group">
        <span class="year-label">{year}</span>
        <div class="periods-row">
          {#each yearPeriods as period (period.id)}
            {@const globalIndex = visiblePeriods.findIndex(p => p.id === period.id)}
            <div
              class="period"
              class:selected={isPeriodSelected(period.id)}
              data-period={period.id}
              data-index={globalIndex}
              role="button"
              tabindex="0"

              on:mousedown={(e) => handleMouseDown(globalIndex, period.id, e)}
              on:mouseover={(e) => handleMouseOver(globalIndex, e)}
              on:mouseup={handleMouseUp}
              
              on:focus={handleFocus}
              on:blur={handleBlur}
              on:keydown={(e) => handleKeyDown(e, globalIndex, period.id)}

              on:touchstart={(e) => handleTouchStart(globalIndex, period.id, e)}
              on:touchmove={handleTouchMove}
              on:touchend={handleTouchEnd}
            >
              <span class="full-text">Period {period.name}</span>
              <span class="abbreviated-text">{period.name}</span>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  :root {
    --primary: #4a90e2;
    --primary-hover: #2980f1;
    --text-main: #1e293b;
    --border: #e2e8f0;
  }

  .periods-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #ffffff;
  }

  .year-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .year-label {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-main);
    white-space: nowrap;
    min-width: 60px;
  }

  .periods-row {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
    flex: 1;
  }

  /* Period button styling */
  .period {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem 0.6rem;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    height: 32.5px;
    box-sizing: border-box;
    white-space: nowrap;
    transition: all 0.2s;
    user-select: none;
  }

  .period:hover:not(.selected) {
    border-color: var(--primary);
    background: #f8fafc;
  }

  .period:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  /* Selected state */
  .period.selected {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .period.selected:hover {
    background: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  .period.selected:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.3);
  }

  .abbreviated-text {
    display: none;
  }

  .full-text {
    display: inline;
  }

  /* Responsive adjustments */
  @media (max-width: 600px) {
    .periods-container {
      padding: 0.5rem 0.75rem;
      gap: 0.5rem;
    }

    .year-label {
      font-size: 0.8rem;
      min-width: 50px;
    }

    .period {
      padding: 0.3rem 0.5rem;
      font-size: 0.75rem;
      height: 30px;
    }
  }

  @media (max-width: 484px) {
    .period .full-text {
      display: none;
    }

    .period .abbreviated-text {
      display: inline;
    }

    .period {
      padding: 0.3rem 0.4rem;
      min-width: 32px;
    }
  }

  @media (max-width: 372px) {
    .year-group {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.3rem;
    }

    .year-label {
      min-width: auto;
    }

    .periods-row {
      width: 100%;
    }
  }
</style>
