<!-- src/components/StudyGroupStoreDebug.svelte - REFACTORED -->
<script lang="ts">
  import type { StudyGroup } from "../domain/models/StudyGroup";
  import { studyGroupStore } from "../lib/stores/studyGroupStore.svelte";

  let isOpen = $state(false);

  const loadingKeys = $derived.by(() => studyGroupStore.state.loadingKeys);
  const staleKeys = $derived.by(() => Array.from(studyGroupStore.state.staleKeys));
  const error = $derived.by(() => studyGroupStore.state.error);

  // Only count "real" cached entries (ignore keys with undefined)
  const cacheEntries = $derived.by(() =>
    Object.entries(studyGroupStore.state.cache).filter(
      (entry): entry is [string, StudyGroup[]] => entry[1] !== undefined
    )
  );

  const summaryEntries = $derived.by(() => Object.entries(studyGroupStore.state.summaryCache));
  const fallbackEntries = $derived.by(() => Object.entries(studyGroupStore.state.fallbackSummaries));

  function togglePanel() {
    isOpen = !isOpen;
  }

  function clearCache() {
    studyGroupStore.actions.clear();
  }
</script>

<div class="debug-panel" data-index="0">
  <button class="debug-toggle" onclick={togglePanel}>
    🔍 Study Groups Store {isOpen ? "▼" : "▶"}
  </button>

  {#if isOpen}
    <div class="debug-content">
      <div class="section">
        <h4>Loading ({loadingKeys.length})</h4>
        <div class="list">
          {#each loadingKeys as key (key)}
            <div class="item">{key}</div>
          {/each}
          {#if loadingKeys.length === 0}
            <div class="empty">None</div>
          {/if}
        </div>
      </div>

      <div class="section">
        <h4>Stale ({staleKeys.length})</h4>
        <div class="list">
          {#each staleKeys as key (key)}
            <div class="item">{key}</div>
          {/each}
          {#if staleKeys.length === 0}
            <div class="empty">None</div>
          {/if}
        </div>
      </div>

      <div class="section">
        <h4>Full Cache ({cacheEntries.length})</h4>
        <div class="list">
          {#each cacheEntries as [key, groups] (key)}
            <div class="detail-row">
              <div class="cache-key">{key}</div>
              <div class="cache-value">{groups.length} groups</div>
            </div>
          {/each}
          {#if cacheEntries.length === 0}
            <div class="empty">Empty</div>
          {/if}
        </div>
      </div>

      <div class="section">
        <h4>Summary Cache ({summaryEntries.length})</h4>
        <div class="list">
          {#each summaryEntries as [key, summaries] (key)}
            <div class="detail-row">
              <div class="cache-key">{key}</div>
              <div class="cache-value">{summaries.length} summaries</div>
            </div>
          {/each}
          {#if summaryEntries.length === 0}
            <div class="empty">Empty</div>
          {/if}
        </div>
      </div>

      <div class="section">
        <h4>Fallback Summaries ({fallbackEntries.length})</h4>
        <div class="list">
          {#each fallbackEntries as [key, summaries] (key)}
            <div class="detail-row">
              <div class="cache-key">{key}</div>
              <div class="cache-value">{summaries.length} summaries</div>
            </div>
          {/each}
          {#if fallbackEntries.length === 0}
            <div class="empty">Empty</div>
          {/if}
        </div>
      </div>

      {#if error}
        <div class="section error">
          <h4>Error</h4>
          <div class="error-message">{error}</div>
        </div>
      {/if}

      <button class="action-btn danger clear-btn" onclick={clearCache}>Clear Cache</button>
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    --dbg-max-width: 400px;
    --dbg-max-height: 350px;
    --dbg-content-max-height: 400px;
    --dbg-list-max-height: 120px;
  }

  /* Component-specific text styling only */
  .cache-key {
    color: var(--dbg-blue);
    font-weight: 600;
    word-break: break-all;
    flex: 1;
  }

  .cache-value {
    color: var(--dbg-green);
    white-space: nowrap;
  }

  .clear-btn {
    width: 100%;
  }
</style>
