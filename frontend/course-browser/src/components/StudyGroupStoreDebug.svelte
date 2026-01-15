<!-- src/components/StudyGroupStoreDebug.svelte -->
<script lang="ts">
  import { studyGroupStore } from '../lib/stores/studyGroupStore';
  import type { StudyGroup } from '../domain/models/StudyGroup';

  interface StudyGroupStoreState {
    cache: { [key: string]: StudyGroup[] };
    loadingKeys: string[];
    error: string | null;
  }

  let storeState: StudyGroupStoreState | null = $state(null);
  let isOpen = $state(false);

  // Subscribe to store
  const unsubscribe = studyGroupStore.subscribe((state: StudyGroupStoreState) => {
    storeState = state;
  });

  // Cleanup on destroy
  $effect(() => {
    return () => unsubscribe();
  });

  function togglePanel() {
    isOpen = !isOpen;
  }

  function clearCache() {
    studyGroupStore.clear();
  }
</script>

<div class="debug-panel" data-index="0">
  <button class="debug-toggle" onclick={togglePanel}>
    🔍 Study Groups Store {isOpen ? '▼' : '▶'}
  </button>

  {#if isOpen && storeState}
    <div class="debug-content">
      <div class="section">
        <h4>Loading ({storeState.loadingKeys.length})</h4>
        <div class="list">
          {#each storeState.loadingKeys as key (key)}
            <div class="item">{key}</div>
          {/each}
          {#if storeState.loadingKeys.length === 0}
            <div class="empty">None</div>
          {/if}
        </div>
      </div>

      <div class="section">
        <h4>Cache ({Object.keys(storeState.cache).length})</h4>
        <div class="list">
          {#each Object.entries(storeState.cache) as [key, groups] (key)}
            <div class="cache-item">
              <div class="cache-key">{key}</div>
              <div class="cache-value">{groups.length} groups</div>
            </div>
          {/each}
          {#if Object.keys(storeState.cache).length === 0}
            <div class="empty">Empty</div>
          {/if}
        </div>
      </div>

      {#if storeState.error}
        <div class="section error">
          <h4>Error</h4>
          <div class="error-message">{storeState.error}</div>
        </div>
      {/if}

      <button class="clear-btn" onclick={clearCache}>Clear Cache</button>
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: monospace;
    font-size: 0.75rem;
    z-index: 9999;
    max-width: 400px;
    max-height: 350px;
    --panel-index: 0;
    transform: translateY(calc(var(--panel-index) * -360px));
  }

  :global(.debug-panel[data-index="0"]) {
    --panel-index: 0;
  }

  :global(.debug-panel[data-index="1"]) {
    --panel-index: 1;
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
    max-height: 400px;
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

  .list {
    background: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    max-height: 120px;
    overflow-y: auto;
  }

  .item,
  .cache-item {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid #e9ecef;
  }

  .item:last-child,
  .cache-item:last-child {
    border-bottom: none;
  }

  .empty {
    color: #adb5bd;
    font-style: italic;
    padding: 0.5rem;
  }

  .cache-item {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .cache-key {
    color: #0d6efd;
    font-weight: 600;
    word-break: break-all;
    flex: 1;
  }

  .cache-value {
    color: #198754;
    white-space: nowrap;
  }

  .error-message {
    color: #dc3545;
    padding: 0.5rem;
    word-break: break-word;
  }

  .clear-btn {
    width: 100%;
    padding: 0.5rem;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
  }

  .clear-btn:hover {
    background: #c82333;
  }
</style>