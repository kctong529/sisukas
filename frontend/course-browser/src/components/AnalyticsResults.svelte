<!-- src/components/AnalyticsResults.svelte -->
<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import type { AnalyticsResponse, ScheduleCandidate, Segment } from '../lib/types/analytics';
  import ScheduleHeatmap from './ScheduleHeatmap.svelte';

  export let data: AnalyticsResponse | null = null;

  // -----------------------------
  // Selection / derived candidate
  // -----------------------------
  let selectedCandidateIndex = 0;

  function clampIndex(index: number, length: number) {
    if (length <= 0) return 0;
    return Math.max(0, Math.min(index, length - 1));
  }

  function selectCandidate(index: number) {
    const n = data?.top?.length ?? 0;
    selectedCandidateIndex = clampIndex(index, n);
  }

  $: top = data?.top ?? [];
  $: selectedCandidateIndex = clampIndex(selectedCandidateIndex, top.length);
  $: currentCandidate = top[selectedCandidateIndex];

  // -----------------------------
  // Study group color mapping
  // -----------------------------
  type ColorMapItem = {
    courseCode: string;
    blockName: string;
    studyGroupName: string;
    colorIndex: number;
  };

  function getStudyGroupColorMap(selection: ScheduleCandidate['selection']) {
    const map = new SvelteMap<string, ColorMapItem>();
    for (let idx = 0; idx < selection.length; idx++) {
      const item = selection[idx];
      if (!map.has(item.studyGroupId)) {
        map.set(item.studyGroupId, {
          courseCode: item.courseCode,
          blockName: item.blockName,
          studyGroupName: item.studyGroupName,
          colorIndex: idx % 6,
        });
      }
    }
    return map;
  }

  $: colorMap = currentCandidate ? getStudyGroupColorMap(currentCandidate.selection) : new Map<string, ColorMapItem>();

  // -----------------------------
  // Helsinki time helpers (singletons)
  // -----------------------------
  const helsinkiDateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const helsinkiTimeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Helsinki',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function helsinkiDateKey(ms: number) {
    return helsinkiDateFmt.format(new Date(ms)); // YYYY-MM-DD
  }

  function helsinkiMinutesOfDay(ms: number) {
    const parts = helsinkiTimeFmt.formatToParts(new Date(ms));
    let h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);

    // Some Intl outputs can yield "24:xx" for midnight
    if (h === 24) h = 0;

    return h * 60 + m;
  }

  // -----------------------------
  // Interval utilities
  // -----------------------------
  type MinuteInterval = { start: number; end: number };

  function mergeIntervals(segs: MinuteInterval[]) {
    const sorted = segs
      .filter(s => s.end > s.start)
      .sort((a, b) => a.start - b.start);

    const merged: MinuteInterval[] = [];
    for (const s of sorted) {
      const last = merged[merged.length - 1];
      if (!last || s.start > last.end) merged.push({ ...s });
      else last.end = Math.max(last.end, s.end);
    }
    return merged;
  }

  function sumIntervals(segs: MinuteInterval[]) {
    let sum = 0;
    for (const s of segs) sum += s.end - s.start;
    return sum;
  }

  // -----------------------------
  // Metrics
  // -----------------------------
  function computeLongestDayHours(segments: Segment[]): number {
    // Longest continuous span between earliest start and latest end in a day (Helsinki day).
    // Uses only segments with actual events (concurrent > 0) to avoid "gap segments" inflating.
    const dayRanges = new SvelteMap<string, { min: number; max: number }>();

    for (const seg of segments) {
      if (seg.concurrent <= 0) continue;

      // Keep same-day segments in Helsinki.
      if (helsinkiDateKey(seg.startMs) !== helsinkiDateKey(seg.endMs)) continue;

      const dateKey = helsinkiDateKey(seg.startMs);

      const existing = dayRanges.get(dateKey);
      if (!existing) {
        dayRanges.set(dateKey, { min: seg.startMs, max: seg.endMs });
      } else {
        existing.min = Math.min(existing.min, seg.startMs);
        existing.max = Math.max(existing.max, seg.endMs);
      }
    }

    let maxMs = 0;
    for (const r of dayRanges.values()) maxMs = Math.max(maxMs, r.max - r.min);

    const hours = maxMs / (1000 * 60 * 60);
    return Math.round(hours * 10) / 10;
  }

  function computeConflictDensityPct(segments: Segment[], totalOverlapMs: number): number {
    // totalOverlapMs / totalEventTime (merged union time)
    const sameDay = segments.filter(seg => {
      if (seg.concurrent <= 0) return false;
      return helsinkiDateKey(seg.startMs) === helsinkiDateKey(seg.endMs);
    });

    if (sameDay.length === 0) return 0;

    const sorted = [...sameDay].sort((a, b) => a.startMs - b.startMs);

    let totalEventTime = 0;
    let mergeStart = sorted[0].startMs;
    let mergeEnd = sorted[0].endMs;

    for (let i = 1; i < sorted.length; i++) {
      const seg = sorted[i];
      if (seg.startMs <= mergeEnd) {
        mergeEnd = Math.max(mergeEnd, seg.endMs);
      } else {
        totalEventTime += mergeEnd - mergeStart;
        mergeStart = seg.startMs;
        mergeEnd = seg.endMs;
      }
    }
    totalEventTime += mergeEnd - mergeStart;

    if (totalEventTime <= 0) return 0;

    return Math.round((totalOverlapMs / totalEventTime) * 100);
  }

  function computeDaysWithoutLunch(segments: Segment[]): number {
    // Count a day as "without lunch" if BUSY time within 10:30–15:00 is >= 4 hours.
    // (Note: this is not "no 2h break", it's "busy >= 4h inside the lunch window".)

    const lunchStart = 10.5 * 60; // 630
    const lunchEnd = 15 * 60;     // 900
    const minBusy = 4 * 60;       // 240

    const byDay = new SvelteMap<string, MinuteInterval[]>();

    for (const seg of segments) {
      if (seg.concurrent <= 0) continue;
      if (helsinkiDateKey(seg.startMs) !== helsinkiDateKey(seg.endMs)) continue;

      const dayKey = helsinkiDateKey(seg.startMs);

      const startMin = helsinkiMinutesOfDay(seg.startMs);
      const endMin = helsinkiMinutesOfDay(seg.endMs);

      if (!byDay.has(dayKey)) byDay.set(dayKey, []);
      byDay.get(dayKey)!.push({ start: startMin, end: endMin });
    }

    let count = 0;

    for (const segs of byDay.values()) {
      const clipped = segs
        .map(s => ({ start: Math.max(s.start, lunchStart), end: Math.min(s.end, lunchEnd) }))
        .filter(s => s.end > s.start);

      const merged = mergeIntervals(clipped);
      const busy = sumIntervals(merged);

      if (busy >= minBusy) count++;
    }

    return count;
  }

  // Derived metric values (computed once per candidate change)
  $: segments = currentCandidate?.segments ?? [];
  $: longestDay = computeLongestDayHours(segments);
  $: conflictDensity = computeConflictDensityPct(segments, currentCandidate?.totalOverlapMs ?? 0);
  $: daysWithoutLunch = computeDaysWithoutLunch(segments);

  // -----------------------------
  // Quick-nav indices
  // -----------------------------
  $: quickWindowStart = Math.max(0, Math.min(selectedCandidateIndex - 3, Math.max(0, top.length - 7)));
  $: quickIndices = Array.from({ length: Math.min(7, top.length) }, (_, i) => quickWindowStart + i).filter(i => i < top.length);
</script>

{#if !data}
  <div class="empty-state">
    <p>No results yet.</p>
  </div>
{:else}
  {#if data.warnings?.length}
    <div class="alert alert-warning mb-4">
      <div>
        <div class="font-semibold mb-1">⚠ {data.warnings[0].code}</div>
        <p class="text-sm">{data.warnings[0].message}</p>
      </div>
    </div>
  {/if}

  {#if top.length > 0 && currentCandidate}
    <div class="heatmap-section">
      <div class="content-grid">
        <div class="heatmap-container">
          <ScheduleHeatmap
            segments={currentCandidate.segments}
            selection={currentCandidate.selection}
          />
        </div>

        <div class="study-groups-display">
          <div class="sg-squares">
            {#each Array.from(colorMap.entries()) as [studyGroupId, group] (studyGroupId)}
              <div
                class="sg-square"
                data-color={group.colorIndex}
                title="{group.courseCode} / {group.blockName}"
              >
                <div class="sg-code">{group.courseCode}</div>
                <div class="sg-name">{group.studyGroupName}</div>
              </div>
            {/each}
          </div>

          <div class="metrics-section">
            <div class="metric-item">
              <div class="metric-label">Peak Overlap</div>
              <div class="metric-value">{currentCandidate.maxConcurrent}× events</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Conflict Density</div>
              <div class="metric-value">{conflictDensity}%</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Longest Day</div>
              <div class="metric-value">{longestDay}h</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Days Without Lunch</div>
              <div class="metric-value">{daysWithoutLunch}</div>
            </div>
          </div>
        </div>
      </div>

      {#if top.length > 1}
        <div class="quick-nav">
          <button
            class="btn btn-nav"
            disabled={selectedCandidateIndex === 0}
            on:click={() => selectCandidate(selectedCandidateIndex - 1)}
          >
            ←
          </button>

          {#each quickIndices as idx (idx)}
            <button
              class="quick-btn"
              class:active={idx === selectedCandidateIndex}
              on:click={() => selectCandidate(idx)}
            >
              {idx + 1}
            </button>
          {/each}

          <button
            class="btn btn-nav"
            disabled={selectedCandidateIndex === top.length - 1}
            on:click={() => selectCandidate(selectedCandidateIndex + 1)}
          >
            →
          </button>
        </div>
      {/if}
    </div>
  {/if}
{/if}

<style>
  :root {
    --primary: #2f7fd6;
    --bg: #f8fafc;
    --card-bg: #ffffff;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
    
    --c0: 234, 88, 12;   /* Burnt Orange */
    --c1: 21, 128, 61;   /* Forest Green */
    --c2: 124, 58, 237;  /* Deep Violet */
    --c3: 2, 132, 199;   /* Sky Blue */
    --c4: 245, 158, 11;  /* Amber */
    --c5: 219, 39, 119;  /* Deep Pink */
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid;
    background: #fef2f2;
    border-color: #fecaca;
    color: #991b1b;
  }

  .alert .font-semibold {
    margin-bottom: 0.25rem;
  }

  .alert p {
    margin: 0;
  }

  .alert-warning {
    margin-bottom: 1rem;
  }

  .mb-4 {
    margin-bottom: 1rem;
  }

  .mb-1 {
    margin-bottom: 0.25rem;
  }

  .text-sm {
    font-size: 0.875rem;
  }

  .heatmap-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .btn {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    background: var(--card-bg);
    border-radius: 0.4rem;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-main);
  }

  .btn:hover:not(:disabled) {
    border-color: var(--primary);
    background: var(--bg);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-nav {
    padding: 0.4rem 0.6rem;
  }

  .quick-nav {
    display: flex;
    gap: 0.4rem;
    justify-content: center;
    flex-wrap: wrap;
    align-items: center;
  }

  .quick-btn {
    min-width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--border);
    background: var(--card-bg);
    border-radius: 0.3rem;
    font-size: 0.75rem;
    font-weight: 100;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-main);
  }

  .quick-btn:hover {
    border-color: var(--primary);
    background: var(--bg);
  }

  .quick-btn.active {
    background: var(--primary);
    border-color: var(--primary);
    color: white;
  }

  .content-grid {
    display: grid;
    grid-template-columns: 0.73fr 0.27fr;
    gap: 0.5rem;
    align-items: start;
  }

  .heatmap-container {
    padding: 0;
    background: var(--card-bg);
    min-height: 0;
    overflow-x: auto;
  }

  .study-groups-display {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--card-bg);
    height: fit-content;
    overflow-y: auto;
  }

  .sg-squares {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .sg-square[data-color="0"] { --rgb: var(--c0); }
  .sg-square[data-color="1"] { --rgb: var(--c1); }
  .sg-square[data-color="2"] { --rgb: var(--c2); }
  .sg-square[data-color="3"] { --rgb: var(--c3); }
  .sg-square[data-color="4"] { --rgb: var(--c4); }
  .sg-square[data-color="5"] { --rgb: var(--c5); }

  .sg-square {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;

    /* keep your layout sizing */
    width: 70px;
    padding: 0.4rem;

    /* BlocksGrid base */
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-main);

    cursor: default;
    user-select: none;
  }

  .sg-square[data-color] {
    background: color-mix(in srgb, rgb(var(--rgb)), white 88%);
    border-color: rgb(var(--rgb));
    color: rgb(var(--rgb));
  }

  .sg-code {
    font-weight: 700;
    font-size: 0.7rem;
    line-height: 1.1;
    word-break: break-word;
  }

  .sg-name {
    font-size: 0.6rem;
    opacity: 0.85;
  }

  .metrics-section {
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .metric-item {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .metric-label {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--text-muted);
  }

  .metric-value {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-main);
  }

  @media (max-width: 768px) {
    .content-grid {
      grid-template-columns: 1fr;
      gap: 0.5rem;
      align-items: start;
    }

    .sg-square {
      display: flex;
      flex-direction: column;
      width: auto;
    }

    .sg-code {
      font-size: 0.55rem;
    }

    .sg-name {
      font-size: 0.5rem;
    }

    .metrics-section {
      flex-direction: row;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .metric-item {
      flex: 1;
      min-width: 80px;
    }
  }
</style>