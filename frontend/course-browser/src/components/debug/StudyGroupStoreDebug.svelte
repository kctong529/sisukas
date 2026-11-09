<script lang="ts">
  import { getStudyGroupDataRuntime } from "@modules/study-groups";

  import { courseIndexStore } from "../../lib/stores/courseIndexStore.svelte";
  import { plansStore } from "../../lib/stores/plansStore.svelte";
  import { debugStudyGroupEntry } from "./debugStudyGroupEntry.svelte";

  let isOpen = $state(false);

  // This panel observes only offerings in the active plan; the runtime does not
  // expose or permit enumeration of its entire authoritative cache.
  const entries = $derived.by(() => {
    const ids = [...new Set(plansStore.read.getActive()?.instanceIds ?? [])];
    return ids.map(id => {
      const course = courseIndexStore.read.resolveByInstanceId(id);
      return {
        id,
        label: course?.code.value ?? id,
        entry: course ? debugStudyGroupEntry(course.unitId, id) : null,
      };
    });
  });
</script>

<div class="debug-panel" data-index="0">
  <button class="debug-toggle" onclick={() => (isOpen = !isOpen)}>
    🔍 Study Group Runtime {isOpen ? "▼" : "▶"}
  </button>

  {#if isOpen}
    <div class="debug-content">
      <div class="section">
        <h4>Active-plan offerings ({entries.length})</h4>
        <p class="empty">Observes authoritative entries; does not trigger retrieval. Other cached offerings are not enumerated.</p>
        {#each entries as item (item.id)}
          <div class="detail-row">
            <div class="cache-key">{item.label} ({item.id})</div>
            <div class="cache-value">
              {#if !item.entry}
                unresolved course
              {:else}
                {item.entry.status}{item.entry.refreshing ? ' (refreshing)' : ''} —
                {item.entry.groups === null ? 'unavailable' : `${item.entry.groups.length} groups`}
                {#if item.entry.error} ({item.entry.error}){/if}
              {/if}
            </div>
          </div>
        {:else}
          <div class="empty">No offerings in the active plan.</div>
        {/each}
      </div>
      <button class="action-btn danger clear-btn" onclick={() => getStudyGroupDataRuntime().clear()}>
        Clear Runtime Cache
      </button>
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    --dbg-max-width: 400px;
    --dbg-max-height: 350px;
    --dbg-content-max-height: 400px;
  }
  .cache-key {
    color: var(--dbg-blue);
    font-weight: 600;
    word-break: break-all;
    flex: 1;
  }
  .cache-value {
    color: var(--dbg-green);
    overflow-wrap: anywhere;
  }
  .clear-btn { width: 100%; }
</style>
