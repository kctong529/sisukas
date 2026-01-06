<!-- src/components/PeriodSelector.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AcademicPeriod } from '../domain/models/AcademicPeriod';
  
  export let periods: AcademicPeriod[];
  export let selectedPeriods: string[] = [];
  export let visible: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let isSelecting = false;
  let firstSelectedIndex = -1;
  
  // Group periods by academic year
  $: groupedPeriods = periods.reduce((acc, period) => {
    if (!acc[period.academicYear]) {
      acc[period.academicYear] = [];
    }
    acc[period.academicYear].push(period);
    return acc;
  }, {} as Record<string, AcademicPeriod[]>);
  
  $: yearEntries = Object.entries(groupedPeriods);
  
  function isPeriodSelected(periodId: string): boolean {
    return selectedPeriods.includes(periodId);
  }
  
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
    if (isSelecting && firstSelectedIndex !== -1) {
      const start = Math.min(firstSelectedIndex, index);
      const end = Math.max(firstSelectedIndex, index);
      
      // Get all period IDs in range
      const allPeriods = periods.map(p => p.id);
      selectedPeriods = allPeriods.slice(start, end + 1);
      dispatch('change', selectedPeriods);
    }
  }
  
  function handleMouseUp(event: MouseEvent) {
    event.stopPropagation();
    isSelecting = false;
  }
  
  function handleTouchStart(index: number, periodId: string, event: TouchEvent) {
    event.preventDefault();
    event.stopPropagation();
    isSelecting = true;
    firstSelectedIndex = index;
    selectedPeriods = [periodId];
    dispatch('change', selectedPeriods);
  }
  
  function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    event.stopPropagation();
    const touch = event.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element?.classList.contains('period')) {
      const index = parseInt(element.getAttribute('data-index') || '-1');
      if (index !== -1 && isSelecting && firstSelectedIndex !== -1) {
        const start = Math.min(firstSelectedIndex, index);
        const end = Math.max(firstSelectedIndex, index);
        
        const allPeriods = periods.map(p => p.id);
        selectedPeriods = allPeriods.slice(start, end + 1);
        dispatch('change', selectedPeriods);
      }
    }
  }
  
  function handleTouchEnd(event: TouchEvent) {
    event.stopPropagation();
    isSelecting = false;
  }
  
  // Format period name for display
  function formatPeriodName(name: string): string {
    return name.replace('Period ', '');
  }
</script>

{#if visible}
  <div id="periods-container">
    {#each yearEntries as [year, yearPeriods], yearIndex}
      <div class="year">
        <span id="year">{year}</span>
        {#each yearPeriods as period, periodIndex}
          {@const globalIndex = periods.findIndex(p => p.id === period.id)}
          <div
            class="period"
            class:selected={isPeriodSelected(period.id)}
            data-period={period.id}
            data-index={globalIndex}
            on:mousedown={(e) => handleMouseDown(globalIndex, period.id, e)}
            on:mouseover={(e) => handleMouseOver(globalIndex, e)}
            on:mouseup={handleMouseUp}
            on:touchstart={(e) => handleTouchStart(globalIndex, period.id, e)}
            on:touchmove={handleTouchMove}
            on:touchend={handleTouchEnd}
            role="button"
            tabindex="0"
          >
            <span class="full-text">{period.name}</span>
            <span class="abbreviated-text">{formatPeriodName(period.name)}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Basic styling for the container */
  #periods-container {
    position: absolute;
    display: flex;
    top: -8em;
    left: 2%;
    flex-wrap: wrap;
    gap: 2px;
    padding: 2px;
    z-index: 10;
  }

  /* Styling for the year div */
  .year {
    width: 55%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  }

  #year {
    display: flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    margin-right: 4px;
  }

  /* Styling for each period */
  .period {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    box-shadow: 0 2px 5px rgb(0 0 0 / 10%);
    border: 1px solid #ddd;
    border-radius: 4px;
    padding-left: 0.7em;
    padding-right: 0.7em;
    font-size: 1em;
    cursor: pointer;
    height: 2.7em;
    text-align: center;
    background-color: #f0f0f0;
    font-weight: 500;
    user-select: none;
  }

  /* Hover effect */
  .period:hover {
    background-color: #eee;
    border-color: #888;
    box-shadow: 0 4px 6px rgb(0 0 0 / 10%);
  }

  /* Selected state */
  .period.selected {
    background-color: #08D;
    color: white;
    border-color: #DDD;
    box-shadow: 0 4px 8px rgb(0 0 0 / 20%);
  }

  /* Active state during dragging */
  .period:active {
    background-color: #08D;
    border-color: #DDD;
  }

  /* Focus outline for accessibility */
  .period:focus {
    outline: 2px solid #008CBA;
    outline-offset: 2px;
  }

  .abbreviated-text {
    display: none;
  }

  .full-text {
    display: inline;
  }

  /* Custom Responsive Styling for .period */
  @media (width <= 620px) {
    .period .full-text {
      display: none;
    }

    .period .abbreviated-text {
      display: inline;
    }
  }
</style>