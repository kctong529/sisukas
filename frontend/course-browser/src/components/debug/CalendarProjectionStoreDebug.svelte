<script lang="ts">
  import { calendarProjectionStore } from "../../lib/stores/calendarProjectionStore.svelte";
  import { courseIndexStore } from "../../lib/stores/courseIndexStore.svelte";
  import { studyGroupStore } from "../../lib/stores/studyGroupStore.svelte";
  import { selectExclusiveGroupOfType, type ExplicitStudyGroupChoice } from "../../domain/services/calendar/CalendarProjection";
  import { plansStore } from "../../lib/stores/plansStore.svelte";

  let isOpen = $state(false);
  let showEntries = $state(false);
  let previewOffering = $state("");
  let previewMode = $state<"candidate" | ExplicitStudyGroupChoice>("candidate");
  let previewGroupId = $state("");
  let showDiagnostics = $state(true);

  const eligibleOfferings = $derived((plansStore.read.getActive()?.instanceIds ?? []).flatMap((id) => {
    const course = courseIndexStore.read.resolveByInstanceId(id);
    if (!course) return [];
    const groups = studyGroupStore.read.getCached(course.unitId, id);
    if (groups === null || groups.length === 0) return [];
    return [{ id, label: `${course.code?.value ?? id} (${id})`, groups }];
  }));
  const currentOffering = $derived(eligibleOfferings.find(item => item.id === previewOffering) ?? eligibleOfferings[0]);
  const availableGroups = $derived(currentOffering?.groups ?? []);
  const preview = $derived(calendarProjectionStore.selectionPreview);
  const offeringChoices = $derived(preview?.choicesByOffering[currentOffering?.id ?? ""] ?? {});
  const selectedGroupId = $derived(
    availableGroups.some(group => group.groupId === previewGroupId)
      ? previewGroupId : availableGroups[0]?.groupId ?? "",
  );
  const previewOfferingCount = $derived(Object.keys(preview?.choicesByOffering ?? {}).length);

  // Restore the saved choice for the selected group when browsing offerings.
  $effect(() => {
    const choice = offeringChoices[selectedGroupId];
    previewMode = choice ?? "candidate";
  });

  function applyPreview(exclusive = false) {
    if (!plan || !currentOffering || !selectedGroupId) return;
    const choices = { ...offeringChoices };
    if (previewMode === "candidate") delete choices[selectedGroupId];
    else choices[selectedGroupId] = previewMode;
    const nextChoices = exclusive && previewMode === "selected"
      ? selectExclusiveGroupOfType({ choices }, availableGroups, selectedGroupId).choices
      : choices;
    const choicesByOffering = { ...(preview?.choicesByOffering ?? {}) };
    if (Object.keys(nextChoices).length > 0) choicesByOffering[currentOffering.id] = nextChoices;
    else delete choicesByOffering[currentOffering.id];
    calendarProjectionStore.setSelectionPreview(
      Object.keys(choicesByOffering).length > 0 ? { planId: plan.id, choicesByOffering } : null,
    );
  }
  function clearPreview() {
    calendarProjectionStore.setSelectionPreview(null);
    previewMode = "candidate";
  }

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
      <div class="section selection-preview">
        <h4>Selection-state preview (development only)</h4>
        <p class="preview-note">Temporarily applies independent choices across offerings in the active plan. Unspecified groups remain candidates; other teaching types are unaffected. No saved plan, registration or cache is modified.</p>
        {#if eligibleOfferings.length === 0}
          <p class="empty">Load an active plan with at least one offering with full study-group data to preview selection states.</p>
        {:else}
          <label for="preview-offering">Offering</label>
          <select id="preview-offering" value={currentOffering?.id ?? ''} onchange={event => { previewOffering = event.currentTarget.value; previewGroupId = ''; }}>
            {#each eligibleOfferings as offering (offering.id)}
              <option value={offering.id}>{offering.label}</option>
            {/each}
          </select>
          <label for="preview-group">Study group</label>
          <select id="preview-group" value={selectedGroupId} onchange={event => previewGroupId = event.currentTarget.value}>
            {#each availableGroups as group (group.groupId)}
              <option value={group.groupId}>{group.name} ({group.type}) — {group.groupId}</option>
            {/each}
          </select>
          <label for="preview-mode">Choice</label>
          <select id="preview-mode" bind:value={previewMode}>
            <option value="candidate">Candidate (clear explicit choice)</option>
            <option value="selected">Selected</option>
            <option value="excluded">Excluded</option>
          </select>
          <div class="preview-actions">
            <button onclick={() => applyPreview()}>Apply group choice</button>
            <button onclick={() => applyPreview(true)} disabled={previewMode !== 'selected'}>Select exclusively within type</button>
            <button onclick={clearPreview} disabled={!preview}>Reset all</button>
          </div>
          {#if preview}
            <p role="status" class="preview-note">Active choices across {previewOfferingCount} {previewOfferingCount === 1 ? 'offering' : 'offerings'}.</p>
            <p class="preview-note">Choices for {currentOffering.id}:</p>
            <ul class="details">
              {#each Object.entries(offeringChoices) as [groupId, choice] (groupId)}
                <li class="mono">{groupId}: {choice}</li>
              {:else}
                <li>No explicit choices for this offering.</li>
              {/each}
            </ul>
          {:else}
            <p class="preview-note">No preview active; all groups are candidates.</p>
          {/if}
        {/if}
      </div>

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
      <p class="empty">Debug overrides are temporary and never saved. This panel does not fetch study groups.</p>
    </div>
  {/if}
</div>

<style>
  /* The shared toggle is width:100%; size its parent to its label while collapsed. */
  .calendar-projection-debug { --dbg-max-width: 440px; width: max-content; }
  .calendar-projection-debug:has(.debug-content) { width: min(440px, calc(100vw - 2rem)); }
  .calendar-projection-debug .debug-toggle { white-space: nowrap; }
  .selection-preview select { display: block; width: 100%; padding: .35rem; margin: .25rem 0 .65rem; color: inherit; background: var(--dbg-muted-bg); border: 1px solid var(--dbg-muted-border); border-radius: 4px; }
  .selection-preview label { display: block; font-size: .8rem; }
  .preview-actions { display: flex; gap: .5rem; margin: .5rem 0; }
  .preview-actions button { padding: .35rem .6rem; border: 1px solid var(--dbg-muted-border); border-radius: 4px; cursor: pointer; }
  .preview-actions button:disabled { opacity: .5; cursor: default; }
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
