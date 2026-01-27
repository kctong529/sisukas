<!-- src/components/PeriodTimeline.svelte -->
<script lang="ts">
  import { periodTimelineStore } from '../lib/stores/periodTimelineStore';
  import type { PeriodTimelineChip, PeriodTimelineModel } from '../domain/viewModels/PeriodTimelineModel';
  import { SvelteMap } from 'svelte/reactivity';
  import PlanManager from './PlanManager.svelte';
  import { useSession } from '../lib/authClient';
  import { COURSE_PREFIX_RGB } from "../lib/coursePrefixColors";

  const session = useSession();
  let isSignedIn = $derived(!!$session.data?.user);
  const model = $derived($periodTimelineStore as PeriodTimelineModel | null);

  // Toggle: include spanning courses (split evenly) vs only single-period courses
  let useSinglePeriodOnly = $state(false);

  const creditsByPeriod = $derived.by(() => {
    if (!model) return null;
    return useSinglePeriodOnly
      ? model.singlePeriodCreditsPerPeriod
      : model.creditsPerPeriod;
  });

  function formatCredits(n: number | undefined): string {
    if (n === undefined) return '0';
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  }

  // courseKey -> { item, colStart, colEnd }
  const courseSpanMap = $derived.by(() => {
    if (!model) return null;

    const map = new SvelteMap<
      string,
      { item: PeriodTimelineChip; colStart: number; colEnd: number }
    >();

    model.columns.forEach((col, colIndex) => {
      col.items.forEach((item) => {
        const existing = map.get(item.key);
        if (!existing) {
          map.set(item.key, { item, colStart: colIndex, colEnd: colIndex });
        } else {
          existing.colStart = Math.min(existing.colStart, colIndex);
          existing.colEnd = Math.max(existing.colEnd, colIndex);
        }
      });
    });

    return map;
  });

  type Placement = {
    key: string;
    item: PeriodTimelineChip;
    colStart: number; // 0-based
    colEnd: number; // 0-based inclusive
    lane: number; // 0-based
    spanCount: number;
  };

  // Greedy lane packing (interval coloring on discrete indices)
  const placements = $derived.by((): Placement[] => {
    if (!courseSpanMap) return [];

    const spans = Array.from(courseSpanMap.entries()).map(([key, v]) => ({
      key,
      item: v.item,
      colStart: v.colStart,
      colEnd: v.colEnd,
      spanCount: v.colEnd - v.colStart + 1
    }));

    spans.sort(
      (a, b) =>
        a.colStart - b.colStart ||
        a.colEnd - b.colEnd ||
        String(a.item.courseCode).localeCompare(String(b.item.courseCode)) ||
        String(a.item.name).localeCompare(String(b.item.name))
    );

    const laneEnds: number[] = [];
    const out: Placement[] = [];

    for (const s of spans) {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] >= s.colStart) lane++;
      if (lane === laneEnds.length) laneEnds.push(s.colEnd);
      else laneEnds[lane] = s.colEnd;

      out.push({ ...s, lane });
    }

    return out;
  });

  const laneCount = $derived.by(() => {
    if (placements.length === 0) return 0;
    return Math.max(...placements.map((p) => p.lane)) + 1;
  });

  // Simple media query flag (so we can render a dedicated mobile matrix)
  let isMobile = $state(false);

  function updateIsMobile() {
    if (typeof window === 'undefined') return;
    isMobile = window.matchMedia('(max-width: 923px)').matches;
  }

  $effect(() => {
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  });
</script>

<section class="period-timeline">
  {#if !isSignedIn}
    <div class="state-card">
      <div class="icon-circle">📋</div>
      <h2>Sign in to view timeline</h2>
      <p>You need to be logged in to see your year timeline.</p>
    </div>
  {:else}
    <div class="header-section">
      <div class="title-group">
        <h2>Year Timeline</h2>
        {#if model}
          <span class="period-timeline__year">{model.academicYear}</span>
        {/if}
      </div>

      <PlanManager compact={true} />
    </div>

    {#if !model}
      <div class="state-card">
        <div class="icon-circle">📋</div>
        <h2>Nothing to show on timeline yet</h2>
        <p>No active plan or no course instances selected.</p>
      </div>
    {:else if model.columns.length === 0}
      <div class="state-card">
        <div class="icon-circle">📋</div>
        <h2>Cannot show timeline properly</h2>
        <p>Timeline built, but no matching periods for {model.academicYear}.</p>
      </div>
    {:else}
      {#if !isMobile}
        <!-- =========================
            DESKTOP VIEW (original)
            ========================= -->
        <div
          class="timelineGrid"
          style="
            --col-count: {model.columns.length};
            --lane-count: {laneCount};
            --lane-count-safe: {Math.max(laneCount, 1)};
          "
        >
          <!-- Row 1: headers -->
          {#each model.columns as col, colIndex (col.period.id)}
            <div class="periodCard periodCard--header" style="grid-column: {colIndex + 1};">
              <div class="periodCard__top">
                <div class="periodCard__title">Period {col.period.name}</div>
                <div class="periodCard__credits" title="Total credits in this period">
                  {formatCredits(creditsByPeriod?.[colIndex] ?? 0)} cr
                </div>
              </div>

              <div class="periodCard__dates">
                {col.period.dateRange.start.toLocaleDateString()}
                –
                {col.period.dateRange.end.toLocaleDateString()}
              </div>
            </div>
          {/each}

          <!-- Row 2: period bodies -->
          {#each model.columns as col, colIndex (col.period.id)}
            <div class="periodCard periodCard--body" style="grid-column: {colIndex + 1};">
              <div class="periodBody__inner">
                {#if laneCount === 0}
                  <div class="periodBody__empty">No courses</div>
                {:else}
                  {#each Array.from({ length: laneCount }, (_, idx) => idx) as i (i)}
                    <div class="laneSlot"></div>
                  {/each}
                {/if}
              </div>
            </div>
          {/each}

          <!-- Chips overlay -->
          <div class="chipLayer">
            {#each placements as p (p.key)}
              <button
                class="course-chip"
                class:course-chip--spanning={p.spanCount > 1}
                type="button"
                title={p.item.name}
                style="
                  --p-start: {p.colStart + 1};
                  --p-end: {p.colEnd + 2};
                  --lane: {p.lane + 1};
                  --chip-rgb: {COURSE_PREFIX_RGB[String(p.item.courseCode).split('-', 1)[0]] ?? COURSE_PREFIX_RGB.__OTHER__};
                "
                onclick={() => console.log('Clicked', p.item.courseCode)}
              >
                <div class="course-chip__header">
                  <span class="course-chip__credits">{p.item.credits} cr</span>
                  <span class="course-chip__code">{p.item.courseCode}</span>
                </div>
                <span class="course-chip__name">{p.item.name}</span>
              </button>
            {/each}
          </div>
        </div>

      {:else}
        <!-- =========================
            MOBILE ROTATED MATRIX
            (Rows = periods, Cols = lanes)
            Text is rotated too.
            ========================= -->
        <div
          class="mobileMatrix"
          style="
            --period-count: {model.columns.length};
            --lane-count-safe: {Math.max(laneCount, 1)};
          "
        >
          <!-- Period labels (col 1, row = period) -->
          {#each model.columns as col, colIndex (col.period.id)}
            <div
              class="mobilePeriodLabel"
              style="grid-row: {model.columns.length - colIndex};"
            >
              <div class="mobilePeriodLabel__rotate">
                <strong>Period {col.period.name}</strong>
                <span class="mobilePeriodLabel__cr">
                  • {formatCredits(creditsByPeriod?.[colIndex] ?? 0)} cr
                </span>
              </div>
            </div>
          {/each}

          <!-- Chips (col = lane + 1, rows = period span) -->
          {#each placements as p (p.key)}
            <button
              class="mobileChip"
              class:mobileChip--spanning={p.spanCount > 1}
              type="button"
              title={p.item.name}
              style="
                --p-start: {model.columns.length - p.colEnd};
                --p-end: {model.columns.length - p.colStart + 1};
                --lane: {p.lane + 1};
                --chip-rgb: {COURSE_PREFIX_RGB[String(p.item.courseCode).split('-', 1)[0]] ?? COURSE_PREFIX_RGB.__OTHER__};
              "
              onclick={() => console.log('Clicked', p.item.courseCode)}
            >
              <div class="mobileChip__rotate">
                <div class="course-chip__header">
                  <span class="course-chip__credits">{p.item.credits} cr</span>
                  <span class="course-chip__code">{p.item.courseCode}</span>
                </div>
                <span class="course-chip__name">{p.item.name}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .period-timeline {
    max-width: 1400px;
    margin: 1.5rem auto;
    padding: 0 1rem;
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--text-main);
  }

  h2 {
    font-size: 1.3rem;
    font-weight: 600;
    margin: 0;
  }

  p {
    margin: 0;
  }

  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .title-group {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .period-timeline__year {
    font-size: 1rem;
    color: #888;
    font-weight: 500;
  }

  .state-card {
    text-align: center;
    padding: 5rem 2rem;
    background: var(--card-bg);
    border-radius: 16px;
    border: 2px dashed var(--border);
  }

  .state-card h2 {
    font-size: 1.4rem;
    margin-bottom: 0.5rem;
  }

  .state-card p {
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }

  .icon-circle {
    width: 80px;
    height: 80px;
    background: var(--bg);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    margin: 0 auto 1.5rem;
  }

  /* =========================
     DESKTOP GRID
     ========================= */
  .timelineGrid {
    --lane-height: 54px;
    --lane-gap: 5px;
    --col-gap: 0;

    display: grid;
    grid-template-columns: repeat(var(--col-count), minmax(180px, 1fr));
    grid-template-rows: auto auto;
    column-gap: var(--col-gap);
    position: relative;
  }

  .periodCard {
    background: #fff;
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }

  .periodCard--header {
    padding: 12px;
    border-bottom: none;
  }

  .periodCard__top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f0f0f0;
  }

  .periodCard__title {
    color: var(--primary);
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.1;
  }

  .periodCard__credits {
    font-size: 0.82rem;
    color: #666;
    background: rgba(0, 0, 0, 0.04);
    padding: 2px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .periodCard__dates {
    margin-top: 6px;
    font-size: 0.8em;
    color: #999;
    line-height: 1.4;
  }

  .periodCard--body {
    position: relative;
    border-top: none;

    min-height: calc(
      (var(--lane-count-safe) * var(--lane-height)) +
      ((var(--lane-count-safe) - 1) * var(--lane-gap)) +
      50px
    );
  }

  .periodBody__inner {
    display: flex;
    flex-direction: column;
    gap: var(--lane-gap);
    box-sizing: border-box;
    padding-bottom: 50px;
  }

  .laneSlot {
    height: var(--lane-height);
    margin-left: 5px;
    margin-right: 5px;
    border-radius: 6px;
    border: 1px dashed rgba(0, 0, 0, 0.06);
    box-sizing: border-box;
  }

  .periodBody__empty {
    padding: 10px 0;
    font-size: 0.85em;
    color: #bbb;
    text-align: center;
    font-style: italic;
  }

  .chipLayer {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;

    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;

    display: grid;
    grid-template-columns: inherit;
    column-gap: var(--col-gap);
    row-gap: var(--lane-gap);
    grid-auto-rows: var(--lane-height);

    box-sizing: border-box;
    z-index: 5;
  }

  .course-chip {
    grid-column: var(--p-start) / var(--p-end);
    grid-row: var(--lane);

    height: var(--lane-height);
    min-height: var(--lane-height);
    display: flex;
    flex-direction: column;
    justify-content: center;

    width: calc(100% - 10px);
    margin-left: 5px;
    margin-right: 5px;

    box-sizing: border-box;
    gap: 4px;

    padding: 8px 10px 8px 12px;
    border-radius: 8px;
    border: 1px solid #b1b1b1;
    background: #ffffff;
    color: #111827;

    cursor: pointer;
    transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
    text-align: left;

    position: relative;
    overflow: hidden;
  }

  /* colored side-edge */
  .course-chip::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 8px;
    background: rgb(var(--chip-rgb));
    opacity: 0.6;
  }

  .course-chip:hover {
    border-color: #d1d5db;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }

  .course-chip__header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .course-chip__credits {
    font-size: 0.9em;
    color: #777;
    background: rgba(var(--chip-rgb), 0.18);
    padding: 2px 5px;
    border-radius: 3px;
    width: 30px;
    text-align: center;
    flex-shrink: 0;
  }

  .course-chip__code,
  .course-chip--spanning .course-chip__code {
    font-size: 1em;
    color: #111827;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .course-chip__name,
  .course-chip--spanning .course-chip__name {
    font-size: 0.9em;
    text-align: left;
    color: #374151;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  /* =========================
     MOBILE ROTATED MATRIX
     ========================= */
  .mobileMatrix {
    --lane-col-width: 48px;
    --label-col-width: 42px;
    --row-height: 148px;

    display: grid;
    grid-template-columns: var(--label-col-width)
      repeat(var(--lane-count-safe), var(--lane-col-width));
    grid-auto-rows: var(--row-height);

    row-gap: 10px;
    column-gap: 4px;

    overflow-x: auto;
    padding: 6px;
    border: 1px solid #eee;
    border-radius: 10px;
    background: #fff;

    -webkit-overflow-scrolling: touch;
  }

  .mobilePeriodLabel {
    grid-column: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e6e6e6;
    border-radius: 8px;
    background: #fafafa;
  }

  .mobilePeriodLabel__rotate {
    transform: rotate(-90deg);
    transform-origin: center;
    white-space: nowrap;
    font-size: 0.9rem;
    color: var(--primary);
    line-height: 1.1;
  }

  .mobilePeriodLabel__cr {
    color: #666;
    font-weight: 500;
  }

  .mobileChip {
    grid-column: calc(var(--lane) + 1);
    grid-row: var(--p-start) / var(--p-end);

    border: 1px solid #b1b1b1;
    background: #ffffff;
    border-radius: 10px;

    position: relative;
    overflow: hidden;

    display: grid;
    place-items: center;

    padding: 0;
    cursor: pointer;

    --row-span: calc(var(--p-end) - var(--p-start));
    --chip-h: calc(
      (var(--row-span) * var(--row-height)) +
      ((var(--row-span) - 1) * 10px)
    );
  }

  .mobileChip::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 8px;
    background: rgb(var(--chip-rgb));
    opacity: 0.6;
  }

  .mobileChip__rotate {
    position: absolute;
    left: 23px !important;  /* prove alignment */
    top: calc(100%) !important;

    margin: 0 !important;
    padding: 0 !important;
    padding-left: 15px !important;

    display: block;      /* avoid inline formatting quirks */
    box-sizing: border-box;

    transform-origin: 0 50%; /* left center */
    transform: translateY(-50%) rotate(-90deg) !important;

    white-space: nowrap;
    width: calc(var(--chip-h) - 10px);
    max-width: calc(var(--chip-h) - 10px);
  }

  .mobileChip__rotate .course-chip__name {
    display: block;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  /* Hide mobile matrix on desktop / hide desktop grid on mobile */
  @media (max-width: 923px) {
    .timelineGrid {
      display: none;
    }
  }

  @media (min-width: 924px) {
    .mobileMatrix {
      display: none;
    }
  }
</style>
