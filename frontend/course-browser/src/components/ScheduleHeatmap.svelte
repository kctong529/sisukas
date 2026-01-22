<!-- src/components/ScheduleHeatmap.svelte -->
<script lang="ts">
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import type { Segment, ScheduleCandidate } from '../lib/types/analytics';

  export let segments: Segment[] = [];
  export let selection: ScheduleCandidate['selection'] = [];
  export let title: string | undefined = undefined;

  // Configuration
  const binSize = 30; // 30-minute bins
  const hoursDisplay = 14; // Show 8:00 to 22:00
  const startHour = 8;
  const tz = 'Europe/Helsinki';

  // Intensity function: conflict load
  function computeIntensity(dtMs: number, concurrent: number): number {
    return dtMs * Math.max(0, concurrent - 1);
  }

  interface EventInfo {
    courseCode: string;
    courseName: string;
    blockName: string;
    studyGroupName: string;
  }

  interface BinData {
    intensity: number;
    maxConcurrent: number;
    concurrentEventIds: string[];
    events: EventInfo[];
  }

  type WeekGrid = Record<number, Record<number, BinData>>;

  // --- Timezone-safe helpers (Helsinki) ---
  const helsinkiDayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short', // Mon/Tue/...
  });

  const helsinkiTimeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function helsinkiDayIndex(ms: number): number {
    // Map Mon..Sun -> 0..6
    const wd = helsinkiDayFmt.format(new Date(ms)); // e.g. "Mon"
    switch (wd) {
      case 'Mon': return 0;
      case 'Tue': return 1;
      case 'Wed': return 2;
      case 'Thu': return 3;
      case 'Fri': return 4;
      case 'Sat': return 5;
      case 'Sun': return 6;
      default: return 0;
    }
  }

  function helsinkiMinutesOfDay(ms: number): number {
    const parts = helsinkiTimeFmt.formatToParts(new Date(ms));
    let h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    // Some Intl implementations can return 24:xx for midnight; normalize.
    if (h === 24) h = 0;
    return h * 60 + m;
  }

  // --- Selection -> studyGroupId map ---
  function buildStudyGroupMap(selection: ScheduleCandidate['selection']) {
    const map = new SvelteMap<string, EventInfo>();
    for (const item of selection) {
      map.set(item.studyGroupId, {
        courseCode: item.courseCode,
        courseName: item.courseName,
        blockName: item.blockName,
        studyGroupName: item.studyGroupName,
      });
    }
    return map;
  }

  function resolveEventId(eventId: string, studyGroupMap: Map<string, EventInfo>): EventInfo | null {
    // Event IDs formatted as "{studyGroupId}:{eventNumber}"
    const colonIndex = eventId.lastIndexOf(':');
    const studyGroupId = colonIndex === -1 ? eventId : eventId.substring(0, colonIndex);
    return studyGroupMap.get(studyGroupId) ?? null;
  }

  function emptyBin(): BinData {
    return { intensity: 0, maxConcurrent: 0, concurrentEventIds: [], events: [] };
  }

  // Build the weekly heatmap from segments (timezone-consistent)
  function buildWeekGrid(segments: Segment[]): WeekGrid {
    const grid: WeekGrid = {};
    const studyGroupMap = buildStudyGroupMap(selection);

    const totalBins = Math.ceil((hoursDisplay * 60) / binSize);

    for (let day = 0; day < 7; day++) {
      grid[day] = {};
      for (let bin = 0; bin < totalBins; bin++) grid[day][bin] = emptyBin();
    }

    const windowStart = startHour * 60;
    const windowEnd = (startHour + hoursDisplay) * 60;

    for (const seg of segments) {
      // Skip gap segments (concurrent==0) to save work and avoid confusing "ghost" bins
      if (seg.concurrent <= 0) continue;

      // Ignore cross-midnight segments in Helsinki time (you can split them in backend if needed)
      const dayStart = helsinkiDayIndex(seg.startMs);
      const dayEnd = helsinkiDayIndex(seg.endMs);
      if (dayStart !== dayEnd) continue;

      const startMinTotal = helsinkiMinutesOfDay(seg.startMs);
      const endMinTotal = helsinkiMinutesOfDay(seg.endMs);

      // Outside visible window
      if (endMinTotal <= windowStart || startMinTotal >= windowEnd) continue;

      const segStart = Math.max(startMinTotal, windowStart);
      const segEnd = Math.min(endMinTotal, windowEnd);
      if (segEnd <= segStart) continue;

      const binStart = Math.floor((segStart - windowStart) / binSize);
      const binEnd = Math.ceil((segEnd - windowStart) / binSize);

      const concurrentIds = seg.concurrentIds ?? [];
      for (let bin = binStart; bin < binEnd; bin++) {
        const binStartMin = windowStart + bin * binSize;
        const binEndMin = windowStart + (bin + 1) * binSize;

        const overlapStart = Math.max(segStart, binStartMin);
        const overlapEnd = Math.min(segEnd, binEndMin);
        if (overlapEnd <= overlapStart) continue;

        const overlapDurationMs = (overlapEnd - overlapStart) * 60000;

        const cell = grid[dayStart][bin];
        cell.intensity += computeIntensity(overlapDurationMs, seg.concurrent);
        cell.maxConcurrent = Math.max(cell.maxConcurrent, seg.concurrent);

        // Store concurrent event IDs and resolve to course info.
        // Keep it reasonably efficient without rebuilding Sets from scratch via array spreads.
        if (concurrentIds.length) {
          // Merge IDs (dedupe)
          const idSet = new SvelteSet(cell.concurrentEventIds);
          for (const id of concurrentIds) idSet.add(id);
          cell.concurrentEventIds = Array.from(idSet);

          // Add resolved event info (dedupe via key set)
          const existingKeys = new SvelteSet(
            cell.events.map(e => `${e.courseCode}|${e.blockName}|${e.studyGroupName}`)
          );

          for (const eventId of concurrentIds) {
            const info = resolveEventId(eventId, studyGroupMap);
            if (!info) continue;
            const key = `${info.courseCode}|${info.blockName}|${info.studyGroupName}`;
            if (!existingKeys.has(key)) {
              existingKeys.add(key);
              cell.events.push(info);
            }
          }
        }
      }
    }

    return grid;
  }

  function getNormalizedIntensity(intensity: number, maxIntensityInGrid: number): number {
    if (maxIntensityInGrid === 0) return 0;
    return Math.min(1, intensity / maxIntensityInGrid);
  }

  function getIntensityColor(normalized: number, hasEvents: boolean = false): string {
    if (normalized === 0 && hasEvents) return `hsl(45, 100%, 92%)`;
    if (normalized === 0) return `hsl(0, 0%, 95%)`;

    if (normalized < 0.33) {
      const t = normalized / 0.33;
      return `hsl(45, 100%, ${90 - t * 20}%)`;
    } else if (normalized < 0.66) {
      const t = (normalized - 0.33) / 0.33;
      return `hsl(${45 - t * 15}, 100%, ${70 - t * 10}%)`;
    } else {
      const t = (normalized - 0.66) / 0.34;
      return `hsl(${30 - t * 30}, 100%, ${60 - t * 20}%)`;
    }
  }

  $: grid = buildWeekGrid(segments);

  $: maxIntensity = Math.max(
    0,
    ...Object.values(grid).flatMap(day => Object.values(day).map(b => b.intensity))
  );

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from(
    { length: hoursDisplay },
    (_: unknown, i: number) => `${String(startHour + i).padStart(2, '0')}:00`
  );

  const binsPerHour = 60 / binSize;
</script>

<div class="schedule-heatmap">
  {#if title}
    <h3 class="heatmap-title">{title}</h3>
  {/if}

  <div class="heatmap-container">
    <div class="heatmap-grid">
      <div class="day-header">
        <div class="time-label-spacer"></div>
        {#each dayLabels as day (day)}
          <div class="day-header-label">{day}</div>
        {/each}
      </div>

      {#each hours as hour, hourIndex (hour)}
        {#each Array.from({ length: binsPerHour }, (_v, i) => i) as binOffset (binOffset)}
          {@const binIndex = hourIndex * binsPerHour + binOffset}
          <div class="time-row">
            {#if binOffset === 0}
              <div class="time-label">{hour}</div>
            {:else}
              <div class="time-label"></div>
            {/if}
            
            {#each Array.from({ length: dayLabels.length }, (_, i) => i) as dayIndex (dayIndex)}
              {@const binData = grid[dayIndex]?.[binIndex] ?? { intensity: 0, maxConcurrent: 0, concurrentEventIds: [], events: [] }}
              {@const normalized = getNormalizedIntensity(binData.intensity, maxIntensity)}
              {@const color = getIntensityColor(normalized, binData.events.length > 0)}

              <div class="heatmap-cell-wrapper">
                <!-- Make tooltip accessible by keyboard too -->
                <div class="heatmap-cell-wrapper">
                  <button
                    type="button"
                    class="heatmap-cell"
                    class:has-events={binData.events.length > 0}
                    style="background-color: {color};"
                    aria-label={
                      binData.events.length > 0
                        ? `Events: ${binData.events.map(e => `${e.courseCode} ${e.studyGroupName}`).join(', ')}`
                        : 'No events'
                    }
                  ></button>

                  {#if binData.events.length > 0}
                    <div class="heatmap-tooltip" role="tooltip">
                      <div class="tooltip-events">
                        {#each binData.events as event (event.courseCode + event.blockName + event.studyGroupName)}
                          <div class="tooltip-event">
                            <span class="event-code">{event.courseCode}</span>
                            <span class="event-group">{event.studyGroupName}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/each}
      {/each}
    </div>
  </div>

  <div class="heatmap-legend">
    <div class="legend-item">
      <div class="legend-swatch" style="background-color: {getIntensityColor(0, false)};"></div>
      <span>No events</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background-color: {getIntensityColor(0, true)};"></div>
      <span>1 event (no conflict)</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background-color: {getIntensityColor(0.5)};"></div>
      <span>Moderate conflict</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background-color: {getIntensityColor(1)};"></div>
      <span>High conflict</span>
    </div>
  </div>
</div>

<style>
  :root {
    --primary: #4a90e2;
    --bg: #f8fafc;
    --card-bg: #ffffff;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
  }

  .schedule-heatmap {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0;
  }

  .heatmap-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .heatmap-container {
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--bg);
    overflow: hidden;
  }

  .heatmap-grid {
    display: flex;
    flex-direction: column;
    padding: 0.3rem;
    width: 100%;
  }

  .day-header {
    display: grid;
    grid-template-columns: 2rem repeat(7, minmax(0, 1fr));
    gap: 1px;
    margin-bottom: 0.5rem;
  }

  .time-label-spacer {
    flex-shrink: 0;
    width: 2rem;
    visibility: hidden;
  }

  .day-header-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-align: center;
    color: var(--text-main);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0.3rem 0.2rem;
  }

  .time-row {
    display: grid;
    grid-template-columns: 2rem repeat(7, minmax(0, 1fr));
    gap: 0;
    align-items: stretch;
  }

  .time-label {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--text-muted);
    text-align: right;
    padding-right: 0.2rem;
    padding-top: 0.2rem;
    flex-shrink: 0;
    width: 1rem;
  }

  .heatmap-cell-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .heatmap-cell {
    position: relative;
    min-height: 0.85rem;
    border: 1px solid rgba(0, 0, 0, 0.08);
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .heatmap-cell:focus {
    outline: none;
  }

  .heatmap-cell:focus-visible {
    box-shadow: inset 0 0 0 2px var(--primary);
  }

  .heatmap-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 0.5rem;
    border-radius: 0.3rem;
    font-size: 0.7rem;
    pointer-events: none;
    margin-bottom: 0.3rem;
    z-index: 1000;
    max-width: 200px;
    white-space: normal;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    display: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .heatmap-cell-wrapper:hover .heatmap-tooltip,
  .heatmap-cell-wrapper:focus-within .heatmap-tooltip {
    display: block;
    opacity: 1;
  }

  .heatmap-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.9);
  }

  .tooltip-events {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 65px;
  }

  .tooltip-event {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
  }

  .event-code {
    font-weight: 600;
    color: #fff;
    font-size: 0.65rem;
  }

  .event-group {
    font-size: 0.6rem;
    opacity: 0.8;
  }

  .heatmap-legend {
    display: flex;
    gap: 1rem;
    padding: 0.5rem 0;
    font-size: 0.75rem;
    justify-content: flex-start;
    flex-wrap: wrap;
    color: var(--text-main);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .legend-swatch {
    width: 0.9rem;
    height: 0.9rem;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 0.2rem;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .day-header-label {
      font-size: 0.65rem;
    }

    .time-label {
      font-size: 0.6rem;
      padding-right: 0.25rem;
    }

    .heatmap-legend {
      font-size: 0.7rem;
      gap: 0.8rem;
    }

    .legend-swatch {
      width: 0.8rem;
      height: 0.8rem;
    }

    .heatmap-cell {
      min-height: 0.7rem;
    }
  }

  @media (max-width: 480px) {
    .day-header {
      grid-template-columns: 2rem repeat(7, 1fr);
    }

    .time-row {
      grid-template-columns: 2rem repeat(7, 1fr);
    }

    .day-header-label {
      font-size: 0.6rem;
    }

    .time-label {
      font-size: 0.55rem;
      padding-right: 0.2rem;
    }

    .heatmap-cell {
      min-height: 0.9rem;
    }
  }
</style>