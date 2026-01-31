<!-- src/components/PeriodTimelineStoreDebug.svelte -->
<script lang="ts">
  import { periodTimelineStore } from '../lib/stores/periodTimelineStore.svelte';
  import { plansStore } from '../lib/stores/plansStore.svelte';
  import { academicPeriodStore } from '../lib/stores/academicPeriodStore';
  import { courseIndexStore } from '../lib/stores/courseIndexStore.svelte';

  import type { Plan } from '../domain/models/Plan';
  import type { AcademicPeriod } from '../domain/models/AcademicPeriod';
  import type { PeriodTimelineModel } from '../domain/viewModels/PeriodTimelineModel';
  import type { Course } from '../domain/models/Course';

  interface PlansStoreState {
    plans: Plan[];
    activePlan: Plan | null;
    loading: boolean;
    error: string | null;
  }

  let timeline = $state<PeriodTimelineModel | null>(null);
  let plansState = $state<PlansStoreState | null>(null);
  let periods = $state<AcademicPeriod[] | null>(null);

  const courseIndexState = $derived.by(() => courseIndexStore.state);

  let isOpen = $state(false);
  let showMissing = $state(true);
  let expandedCols = $state(new Set<string>());

  type Unsubscriber = () => void;
  type Subscribable<T> = { subscribe(run: (value: T) => void): Unsubscriber };

  type PeriodTimelineStoreValue = PeriodTimelineModel | null;
  type AcademicPeriodStoreValue = AcademicPeriod[] | null;

  function isSubscribable<T>(x: unknown): x is Subscribable<T> {
    return !!x && typeof (x as { subscribe?: unknown }).subscribe === "function";
  }

  $effect(() => {
    const unsubs: Unsubscriber[] = [];

    if (isSubscribable<PeriodTimelineStoreValue>(periodTimelineStore)) {
      unsubs.push(periodTimelineStore.subscribe((m) => (timeline = m)));
    }

    if (isSubscribable<PlansStoreState>(plansStore)) {
      unsubs.push(plansStore.subscribe((s) => (plansState = s)));
    }

    if (isSubscribable<AcademicPeriodStoreValue>(academicPeriodStore)) {
      unsubs.push(academicPeriodStore.subscribe((p) => (periods = p)));
    }

    return () => unsubs.forEach((u) => u());
  });

  function togglePanel() {
    isOpen = !isOpen;
  }

  function toggleCol(id: string) {
    if (expandedCols.has(id)) expandedCols.delete(id);
    else expandedCols.add(id);

    // reassign so the template updates
    expandedCols = new Set(expandedCols);
  }

  function activeInstanceIds(): string[] {
    return plansState?.activePlan?.instanceIds ?? [];
  }

  function resolveCourseFromIndex(instanceId: string): Course | undefined {
    const s = courseIndexState;
    return (
      s.byInstanceId.get(instanceId) ??
      s.historicalByInstanceId.get(instanceId) ??
      undefined
    );
  }

  function courseIndexHas(id: string): boolean {
    return !!resolveCourseFromIndex(id);
  }

  function missingInstanceIds(): string[] {
    const ids = activeInstanceIds();
    return ids.filter((id) => !courseIndexHas(id));
  }

  function resolvedInstanceCount(): number {
    const ids = activeInstanceIds();
    return ids.length - missingInstanceIds().length;
  }

  function totalChipsInTimeline(): number {
    if (!timeline) return 0;
    return timeline.columns.reduce((sum, c) => sum + (c.items?.length ?? 0), 0);
  }

  function uniqueInstanceIdsInTimeline(): Set<string> {
    const set = new Set<string>();
    if (!timeline) return set;
    for (const col of timeline.columns) for (const it of col.items) set.add(it.instanceId);
    return set;
  }

  // NOTE: This flags cross-period repeats too; that's expected for spanning courses.
  function duplicateInstanceIdsInTimeline(): string[] {
    if (!timeline) return [];
    const seen = new Set<string>();
    const dup = new Set<string>();

    for (const col of timeline.columns) {
      for (const it of col.items) {
        if (seen.has(it.instanceId)) dup.add(it.instanceId);
        else seen.add(it.instanceId);
      }
    }

    return Array.from(dup);
  }

  function periodSummaryLabel(period: AcademicPeriod): string {
    const n = period.name ? `Period ${period.name}` : period.id;
    const dr = period.dateRange;
    if (!dr?.start || !dr?.end) return n;
    return `${n} (${dr.start.toLocaleDateString()}–${dr.end.toLocaleDateString()})`;
  }

  function courseLabelFromIndex(instanceId: string): string {
    const c = resolveCourseFromIndex(instanceId);
    if (!c) return instanceId;

    const code = c.code?.value ?? 'UNKNOWN';
    const nameObj = c.name;
    const name =
      typeof nameObj === 'string'
        ? nameObj
        : nameObj?.en ?? nameObj?.fi ?? nameObj?.sv ?? 'Untitled';

    return `${code} — ${name}`;
  }

  // -------------------
  // Runes-mode deriveds
  // -------------------
  const planIds = $derived.by(() => activeInstanceIds());
  const missingIds = $derived.by(() => missingInstanceIds());
  const resolvedCount = $derived.by(() => resolvedInstanceCount());
  const chipsTotal = $derived.by(() => totalChipsInTimeline());
  const uniqueInTimeline = $derived.by(() => uniqueInstanceIdsInTimeline());
  const dups = $derived.by(() => duplicateInstanceIdsInTimeline());
</script>

<div class="debug-panel" data-index="3">
  <button class="debug-toggle" onclick={togglePanel}>
    🗓️ Period Timeline {isOpen ? '▼' : '▶'}
  </button>

  {#if isOpen}
    <div class="debug-content">
      <!-- Overview -->
      <div class="section">
        <h4>Overview</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="label">Timeline:</span>
            <span class="value" class:warn={!timeline}>{timeline ? '✓ built' : '— null'}</span>
          </div>

          <div class="stat-item">
            <span class="label">Active plan:</span>
            <span class="value" class:warn={!plansState?.activePlan}>
              {plansState?.activePlan ? '✓ yes' : '— none'}
            </span>
          </div>

          <div class="stat-item">
            <span class="label">Plan instances:</span>
            <span class="value">{planIds.length}</span>
          </div>

          <div class="stat-item">
            <span class="label">Resolved:</span>
            <span class="value" class:warn={missingIds.length > 0}>
              {resolvedCount}
            </span>
          </div>

          <div class="stat-item">
            <span class="label">Missing:</span>
            <span class="value" class:warn={missingIds.length > 0}>
              {missingIds.length}
            </span>
          </div>

          <div class="stat-item">
            <span class="label">Periods loaded:</span>
            <span class="value" class:warn={!periods || periods.length === 0}>
              {periods?.length ?? 0}
            </span>
          </div>

          <div class="stat-item">
            <span class="label">Timeline chips:</span>
            <span class="value">{chipsTotal}</span>
          </div>

          <div class="stat-item">
            <span class="label">Unique instances:</span>
            <span class="value">{uniqueInTimeline.size}</span>
          </div>
        </div>

        {#if timeline}
          <div class="meta-line">
            <span class="pill">academicYear: {timeline.academicYear}</span>
            <span class="pill">columns: {timeline.columns.length}</span>
          </div>
        {/if}
      </div>

      <!-- Potential issues -->
      <div class="section">
        <h4>Checks</h4>

        <div class="check-row">
          <span class="check-label">Duplicate instanceIds in timeline:</span>
          <span class="check-value" class:warn={dups.length > 0}>{dups.length}</span>
        </div>

        <div class="check-row">
          <span class="check-label">Plan → index missing:</span>
          <span class="check-value" class:warn={missingIds.length > 0}>
            {missingIds.length}
          </span>
        </div>

        {#if dups.length > 0}
          <div class="warn-box">
            <div class="warn-title">⚠️ Duplicates</div>
            <div class="tags">
              {#each dups as id (id)}
                <span class="tag warn">{id}</span>
              {/each}
            </div>
            <div class="hint">
              Note: duplicates are expected if an instance spans multiple periods, because it appears in each touched column.
            </div>
          </div>
        {/if}
      </div>

      <!-- Missing instance ids -->
      {#if showMissing && missingIds.length > 0}
        <div class="section">
          <h4>Missing in courseIndex ({missingIds.length})</h4>
          <div class="list">
            {#each missingIds as id (id)}
              <div class="item mono">❌ {id}</div>
            {/each}
          </div>
          <div class="hint">
            These instanceIds exist in the active plan but aren’t present in courseIndexStore.byInstanceId.
            If you just signed in / switched accounts, ensure courseIndexStore.setCourses() ran after loading courses.
          </div>
        </div>
      {/if}

      <!-- Timeline columns -->
      <div class="section">
        <h4>Columns</h4>

        {#if !timeline}
          <div class="empty">Timeline is null (no active plan, no periods, or all instances failed to resolve).</div>
        {:else}
          <div class="cols">
            {#each timeline.columns as col (col.period.id)}
              <div class="col">
                <button
                  class="col-header"
                  onclick={() => toggleCol(col.period.id)}
                  class:expanded={expandedCols.has(col.period.id)}
                >
                  <span class="expand-icon">{expandedCols.has(col.period.id) ? '▼' : '▶'}</span>
                  <span class="col-title">{periodSummaryLabel(col.period)}</span>
                  <span class="col-count">{col.items.length} chips</span>
                </button>

                {#if expandedCols.has(col.period.id)}
                  {#if col.items.length === 0}
                    <div class="empty-chip">No items</div>
                  {:else}
                    <div class="chip-list">
                      {#each col.items as it (it.instanceId + ':' + col.period.id)}
                        <div class="chip">
                          <div class="chip-top">
                            <span class="chip-code">{it.courseCode}</span>
                            <span class="chip-span">{it.spanLabel}</span>
                          </div>
                          <div class="chip-name" title={it.name}>{it.name}</div>
                          <div class="chip-meta mono" title={it.instanceId}>
                            {it.instanceId}
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Active plan instance resolution list -->
      <div class="section">
        <h4>Active plan → resolved lookup</h4>

        {#if !plansState?.activePlan}
          <div class="empty">No active plan</div>
        {:else if planIds.length === 0}
          <div class="empty">Active plan has no instanceIds</div>
        {:else}
          <div class="list">
            {#each planIds as id (id)}
              <div class="item">
                <span class="mono">{id}</span>
                <span class="right" class:ok={courseIndexHas(id)} class:warn={!courseIndexHas(id)}>
                  {courseIndexHas(id) ? '✓ resolved' : '❌ missing'}
                </span>
              </div>
              {#if courseIndexHas(id)}
                <div class="subitem" title={courseLabelFromIndex(id)}>
                  {courseLabelFromIndex(id)}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>

      <!-- Simple toggles -->
      <div class="section">
        <h4>UI</h4>
        <label class="toggle">
          <input type="checkbox" bind:checked={showMissing} />
          <span>Show missing instanceIds section</span>
        </label>
      </div>

      <!-- Upstream errors (if present) -->
      {#if plansState?.error}
        <div class="section error">
          <h4>⚠️ Plans error</h4>
          <div class="error-message">{plansState.error}</div>
        </div>
      {/if}
      {#if courseIndexState?.error}
        <div class="section error">
          <h4>⚠️ Course index error</h4>
          <div class="error-message">{courseIndexState.error}</div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: monospace;
    font-size: 0.75rem;
    max-width: 520px;
    max-height: 680px;
  }

  .debug-toggle {
    width: 100%;
    padding: 0.75rem;
    background: #2c3e50;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
  }
  .debug-toggle:hover {
    background: #1a252f;
  }

  .debug-content {
    padding: 1rem;
    max-height: 630px;
    overflow-y: auto;
    border-top: 1px solid #ddd;
  }

  .section {
    margin-bottom: 1rem;
  }
  .section:last-of-type {
    margin-bottom: 0.75rem;
  }

  .section.error {
    background: #fee;
    padding: 0.5rem;
    border-radius: 4px;
  }

  h4 {
    margin: 0 0 0.5rem;
    color: #2c3e50;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mono {
    font-family: 'Courier New', monospace;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    background: #f8f9fa;
    padding: 0.4rem 0.5rem;
    border-radius: 3px;
    border: 1px solid #e9ecef;
  }

  .label {
    color: #495057;
    font-weight: 600;
  }

  .value {
    color: #0d6efd;
    font-weight: 600;
  }

  .value.warn {
    color: #d9534f;
  }

  .meta-line {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }

  .pill {
    background: #e9ecef;
    color: #495057;
    padding: 0.12rem 0.35rem;
    border-radius: 999px;
    font-size: 0.65rem;
    line-height: 1.2;
  }

  .check-row {
    display: flex;
    justify-content: space-between;
    background: #f8f9fa;
    padding: 0.35rem 0.5rem;
    border: 1px solid #e9ecef;
    border-radius: 3px;
    margin-bottom: 0.4rem;
    gap: 0.5rem;
  }
  .check-label { color: #495057; font-weight: 600; }
  .check-value { color: #0d6efd; font-weight: 700; }
  .check-value.warn { color: #d9534f; }

  .warn-box {
    margin-top: 0.4rem;
    padding: 0.5rem;
    background: #fff3cd;
    border: 1px solid #ffe69c;
    border-radius: 4px;
  }
  .warn-title {
    font-weight: 700;
    margin-bottom: 0.35rem;
    color: #664d03;
    font-size: 0.7rem;
  }
  .hint {
    margin-top: 0.4rem;
    font-size: 0.65rem;
    color: #6c757d;
    line-height: 1.25;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .tag {
    background: #dbeafe;
    color: #1e40af;
    padding: 0.15rem 0.3rem;
    border-radius: 2px;
    font-size: 0.65rem;
    font-weight: 600;
  }
  .tag.warn {
    background: #f8d7da;
    color: #842029;
  }

  .list {
    background: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    overflow-y: auto;
    max-height: 180px;
  }
  .item {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: center;
  }
  .item:last-child { border-bottom: none; }

  .subitem {
    padding: 0.25rem 0.5rem 0.45rem;
    border-bottom: 1px solid #e9ecef;
    color: #198754;
    background: white;
    font-size: 0.68rem;
    word-break: break-word;
  }

  .right { font-weight: 700; }
  .right.ok { color: #198754; }
  .right.warn { color: #d9534f; }

  .empty {
    color: #adb5bd;
    font-style: italic;
    padding: 0.5rem;
    text-align: center;
    background: #f8f9fa;
    border: 1px dashed #e9ecef;
    border-radius: 4px;
  }

  .cols {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .col {
    border: 1px solid #e9ecef;
    border-radius: 4px;
    background: white;
    overflow: hidden;
  }

  .col-header {
    width: 100%;
    padding: 0.5rem;
    background: #f8f9fa;
    border: none;
    border-bottom: 1px solid #e9ecef;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    text-align: left;
    font-family: monospace;
    font-size: 0.75rem;
  }
  .col-header:hover { background: #e9ecef; }
  .col-header.expanded { background: #dbeafe; border-bottom-color: #93c5fd; }

  .expand-icon { font-size: 0.65rem; width: 0.8rem; flex-shrink: 0; }
  .col-title { flex: 1; font-weight: 600; color: #2c3e50; }
  .col-count { white-space: nowrap; font-size: 0.7rem; color: #198754; }

  .chip-list {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: white;
  }

  .chip {
    padding: 0.5rem;
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 3px;
  }

  .chip-top {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: baseline;
    margin-bottom: 0.25rem;
  }

  .chip-code { font-weight: 800; color: #0d6efd; }
  .chip-span { font-size: 0.65rem; color: #6c757d; background: #e9ecef; padding: 0.12rem 0.35rem; border-radius: 999px; }

  .chip-name { color: #2c3e50; font-weight: 600; font-size: 0.7rem; }
  .chip-meta { margin-top: 0.25rem; color: #6c757d; font-size: 0.65rem; word-break: break-all; }

  .empty-chip {
    padding: 0.5rem;
    color: #adb5bd;
    font-style: italic;
    background: white;
  }

  .toggle {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.72rem;
    color: #495057;
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 0.4rem 0.5rem;
  }

  .error-message {
    color: #d9534f;
    padding: 0.5rem;
    word-break: break-word;
    background: white;
    border-radius: 3px;
  }
</style>
