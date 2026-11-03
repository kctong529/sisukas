<script lang="ts">
  import { calendarProjectionStore } from "../../lib/stores/calendarProjectionStore.svelte";
  import { plansStore } from "../../lib/stores/plansStore.svelte";

  let isOpen = $state(false);
  let showEntries = $state(false);
  let showDiagnostics = $state(true);

  const plan = $derived(plansStore.read.getActive());
  const projection = $derived(calendarProjectionStore.projection);
  const completeness = $derived(projection?.completeness);
  const entries = $derived(projection?.entries ?? []);
  const previewEntries = $derived(entries.slice(0, 12));
  const diagnostics = $derived(projection?.diagnostics ?? []);
  const errors = $derived(diagnostics.filter((item) => item.severity === "error").length);
  const warnings = $derived(diagnostics.filter((item) => item.severity === "warning").length);
</script>

<div class="debug-panel calendar-projection-debug">
  <button class="debug-toggle" onclick={() => (isOpen = !isOpen)}>
    🗓️ Calendar Projection {isOpen ? "▼" : "▶"}
  </button>

  {#if isOpen}
    <div class="debug-content">
      <div class="section">
        <h4>Projection</h4>
        <div class="stats-grid">
          <div class="stat-item"><span class="label">Active plan:</span><span class="value" class:warn={!plan}>{plan ? "✓ yes" : "— none"}</span></div>
          <div class="stat-item"><span class="label">Completeness:</span><span class="value" class:warn={completeness?.status === "partial"}>{completeness?.status ?? "— unavailable"}</span></div>
          <div class="stat-item"><span class="label">Entries:</span><span class="value">{entries.length}</span></div>
          <div class="stat-item"><span class="label">Diagnostics:</span><span class="value" class:warn={errors > 0}>{diagnostics.length} ({errors} errors, {warnings} warnings)</span></div>
        </div>
      </div>

      {#if completeness}
        <div class="section">
          <h4>Offering availability</h4>
          <div class="stats-grid">
            <div class="stat-item"><span class="label">Total:</span><span class="value">{completeness.totalCourses}</span></div>
            <div class="stat-item"><span class="label">Available:</span><span class="value">{completeness.availableCourses}</span></div>
            <div class="stat-item"><span class="label">Stale:</span><span class="value" class:warn={completeness.staleCourses > 0}>{completeness.staleCourses}</span></div>
            <div class="stat-item"><span class="label">Missing:</span><span class="value" class:warn={completeness.missingCourses > 0}>{completeness.missingCourses}</span></div>
            <div class="stat-item"><span class="label">Loading:</span><span class="value">{completeness.loadingCourses}</span></div>
            <div class="stat-item"><span class="label">Failed:</span><span class="value" class:warn={completeness.failedCourses > 0}>{completeness.failedCourses}</span></div>
          </div>
        </div>
      {/if}

      <div class="section">
        <button class="detail-toggle" onclick={() => (showDiagnostics = !showDiagnostics)}>
          Diagnostics ({diagnostics.length}) {showDiagnostics ? "▼" : "▶"}
        </button>
        {#if showDiagnostics}
          {#if diagnostics.length === 0}
            <p class="empty">No diagnostics.</p>
          {:else}
            <ul class="details">
              {#each diagnostics as item, i (i)}
                <li>
                  <strong>{item.severity}: {item.code}</strong>
                  <div>{item.message}</div>
                  {#if item.source?.courseOfferingId}<div class="mono">Offering: {item.source.courseOfferingId}</div>{/if}
                  {#if item.source?.studyGroupId}<div class="mono">Group: {item.source.studyGroupId}</div>{/if}
                  {#if item.source?.seriesId}<div class="mono">Series: {item.source.seriesId}</div>{/if}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>

      <div class="section">
        <button class="detail-toggle" onclick={() => (showEntries = !showEntries)}>
          Projected entries ({entries.length}) {showEntries ? "▼" : "▶"}
        </button>
        {#if showEntries}
          {#if entries.length === 0}
            <p class="empty">No projected entries.</p>
          {:else}
            <p class="preview-note">Showing the first {previewEntries.length} of {entries.length} entries in projection order.</p>
            <ul class="entry-preview">
              {#each previewEntries as entry, index (index)}
                <li>
                  <div class="entry-heading"><strong>{entry.source.courseOfferingId}</strong><span>{entry.kind}</span></div>
                  <div class="mono">{new Date(entry.interval.startMs).toLocaleString('en-GB', { timeZone: 'Europe/Helsinki' })} – {new Date(entry.interval.endMs).toLocaleString('en-GB', { timeZone: 'Europe/Helsinki' })}</div>
                  <div class="mono">Group: {entry.source.studyGroupId}</div>
                  {#if entry.occurrenceKey === null}<div class="collision">Unresolved occurrence identity</div>{/if}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>
      <p class="empty">Read-only. This panel does not fetch study groups or change calendar selections.</p>
    </div>
  {/if}
</div>

<style>
  /* The shared toggle is width:100%; size its parent to its label while collapsed. */
  .calendar-projection-debug { --dbg-max-width: 440px; width: max-content; }
  .calendar-projection-debug:has(.debug-content) { width: min(440px, calc(100vw - 2rem)); }
  .calendar-projection-debug .debug-toggle { white-space: nowrap; }
  .entry-preview { list-style: none; padding: 0; margin: 0.5rem 0 0; max-height: 280px; overflow: auto; }
  .entry-preview li { padding: 0.5rem; border-bottom: 1px solid var(--dbg-muted-border); overflow-wrap: anywhere; }
  .entry-heading { display: flex; justify-content: space-between; gap: 0.5rem; }
  .preview-note { font-size: 0.75rem; opacity: 0.75; }
  .collision { color: var(--dbg-red); }
  .detail-toggle { background: var(--dbg-muted-bg); border: 1px solid var(--dbg-muted-border); border-radius: 4px; padding: 0.4rem; width: 100%; text-align: left; cursor: pointer; }
  .details { padding-left: 1.2rem; max-height: 260px; overflow: auto; overflow-wrap: anywhere; }
  .details li { margin-bottom: 0.65rem; }
  .empty { opacity: 0.75; font-size: 0.75rem; }
</style>
