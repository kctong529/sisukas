<!-- src/components/BlockStoreDebug.svelte -->
<script lang="ts">
  import { blockStore } from '../lib/stores/blockStore';
  import { studyGroupStore } from '../lib/stores/studyGroupStore';
  import type { Block } from '../domain/models/Block';
  import type { StudyGroup } from '../domain/models/StudyGroup';
  
  interface BlockStoreState {
    blocksByCourseInstance: Record<string, Block[]>;
    loadingInstances: Set<string>;
    modifyingBlocks: Set<string>;
    error: string | null;
  }

  interface StudyGroupStoreState {
    cache: Record<string, StudyGroup[]>;
  }

  let storeState: BlockStoreState | null = $state(null);
  let sgState: StudyGroupStoreState | null = $state(null);

  let isOpen = $state(false);
  let expandedInstances: Set<string> = $state(new Set());

  // Subscribe to stores
  const unsubscribeBlocks = blockStore.subscribe((state: BlockStoreState) => {
    storeState = state;
  });

  const unsubscribeStudyGroups = studyGroupStore.subscribe((state: StudyGroupStoreState) => {
    sgState = state;
  });

  // Cleanup on destroy
  $effect(() => {
    return () => {
      unsubscribeBlocks();
      unsubscribeStudyGroups();
    };
  });

  function togglePanel() {
    isOpen = !isOpen;
  }

  function toggleInstanceExpanded(instanceId: string) {
    if (expandedInstances.has(instanceId)) expandedInstances.delete(instanceId);
    else expandedInstances.add(instanceId);
    expandedInstances = new Set(expandedInstances);
  }

  function clearStore() {
    blockStore.clear();
  }

  function invalidateInstance(instanceId: string) {
    blockStore.invalidateInstance(instanceId);
  }

  function getLoadingCount(): number {
    return storeState?.loadingInstances.size ?? 0;
  }

  function getModifyingCount(): number {
    return storeState?.modifyingBlocks.size ?? 0;
  }

  function getCacheSize(): number {
    return Object.keys(storeState?.blocksByCourseInstance ?? {}).length;
  }

  function getTotalBlocks(): number {
    if (!storeState) return 0;
    return Object.values(storeState.blocksByCourseInstance).reduce((sum, blocks) => sum + (blocks?.length ?? 0), 0);
  }

  function formatBlockId(blockId: string): string {
    // block:COURSE:LABEL -> just the label part for readability
    const parts = blockId.split(':');
    if (parts.length >= 3) return parts.slice(2).join(':');
    return blockId;
  }

  // ---------- Extra debug calculations ----------

  function countGroupsInInstance(blocks: Block[]): number {
    return blocks.reduce((sum, b) => sum + (b.studyGroupIds?.length ?? 0), 0);
  }

  function uniqueGroupsInInstance(blocks: Block[]): Set<string> {
    const set = new Set<string>();
    for (const b of blocks) for (const gid of b.studyGroupIds) set.add(gid);
    return set;
  }

  function findDuplicateGroupIds(blocks: Block[]): string[] {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const b of blocks) {
      for (const gid of b.studyGroupIds) {
        if (seen.has(gid)) dup.add(gid);
        else seen.add(gid);
      }
    }
    return Array.from(dup);
  }

  function blockColorSummary(blocks: Block[]): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const b of blocks) {
      const ci = (b as Block).colorIndex;
      if (typeof ci !== 'number') continue;
      counts[ci] = (counts[ci] ?? 0) + 1;
    }
    return counts;
  }

  // ---------- StudyGroup cache helpers (UI-only) ----------

  function findStudyGroupCacheKeyForInstance(instanceId: string): string | null {
    const cache = sgState?.cache ?? {};
    const keys = Object.keys(cache);
    // your cache keys look like `${unitId}:${instanceId}`
    return keys.find(k => k.endsWith(`:${instanceId}`)) ?? null;
  }

  function getStudyGroupsForInstance(instanceId: string): StudyGroup[] {
    const cache = sgState?.cache ?? {};
    const key = findStudyGroupCacheKeyForInstance(instanceId);
    if (!key) return [];
    return cache[key] ?? [];
  }

  // Uses the NEW blockStore wrapper (so DebugPanel shows the intended usage pattern)
  async function autoPartition(instanceId: string) {
    await blockStore.autoPartitionForInstance(instanceId, () => getStudyGroupsForInstance(instanceId));
  }
</script>

<div class="debug-panel" data-index="2">
  <button class="debug-toggle" onclick={togglePanel}>
    🧩 Block Store {isOpen ? '▼' : '▶'}
  </button>

  {#if isOpen && storeState}
    <div class="debug-content">
      <!-- Summary Stats -->
      <div class="section">
        <h4>Overview</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="label">Instances:</span>
            <span class="value">{getCacheSize()}</span>
          </div>
          <div class="stat-item">
            <span class="label">Total Blocks:</span>
            <span class="value">{getTotalBlocks()}</span>
          </div>
          <div class="stat-item">
            <span class="label">Loading:</span>
            <span class="value" class:active={getLoadingCount() > 0}>{getLoadingCount()}</span>
          </div>
          <div class="stat-item">
            <span class="label">Modifying:</span>
            <span class="value" class:active={getModifyingCount() > 0}>{getModifyingCount()}</span>
          </div>
        </div>
      </div>

      <!-- Loading Instances -->
      {#if storeState.loadingInstances.size > 0}
        <div class="section">
          <h4>Loading ({storeState.loadingInstances.size})</h4>
          <div class="list">
            {#each Array.from(storeState.loadingInstances) as instanceId (instanceId)}
              <div class="item">⏳ {instanceId}</div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Modifying Blocks -->
      {#if storeState.modifyingBlocks.size > 0}
        <div class="section">
          <h4>Modifying ({storeState.modifyingBlocks.size})</h4>
          <div class="list">
            {#each Array.from(storeState.modifyingBlocks) as blockId (blockId)}
              <div class="item mono">{formatBlockId(blockId)}</div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Course Instances -->
      <div class="section">
        <h4>Course Instances ({getCacheSize()})</h4>
        {#if getCacheSize() === 0}
          <div class="empty">No cached instances</div>
        {:else}
          <div class="instances-list">
            {#each Object.entries(storeState.blocksByCourseInstance) as [instanceId, blocks] (instanceId)}
              {@const totalGroups = countGroupsInInstance(blocks ?? [])}
              {@const uniq = uniqueGroupsInInstance(blocks ?? [])}
              {@const dups = findDuplicateGroupIds(blocks ?? [])}
              {@const colorCounts = blockColorSummary(blocks ?? [])}
              {@const cachedStudyGroups = getStudyGroupsForInstance(instanceId)}
              {@const hasSG = cachedStudyGroups.length > 0}

              <div class="instance-item">
                <button
                  class="instance-header"
                  onclick={() => toggleInstanceExpanded(instanceId)}
                  class:expanded={expandedInstances.has(instanceId)}
                >
                  <span class="expand-icon">{expandedInstances.has(instanceId) ? '▼' : '▶'}</span>
                  <span class="instance-name">{instanceId}</span>
                  <span class="block-count">{blocks?.length ?? 0} blocks</span>
                </button>

                <!-- Instance summary row -->
                <div class="instance-summary">
                  <span class="pill">groups: {totalGroups}</span>
                  <span class="pill">unique: {uniq.size}</span>

                  <span class="pill" class:warn={!hasSG} class:ok={hasSG}>
                    studyGroups cached: {cachedStudyGroups.length}
                  </span>

                  <span class="pill">
                    colors: {Object.entries(colorCounts).map(([k, v]) => `${k}:${v}`).join(' ') || '-'}
                  </span>

                  <span class="pill warn" class:active={dups.length > 0}>dups: {dups.length}</span>
                </div>

                {#if expandedInstances.has(instanceId) && blocks && blocks.length > 0}
                  {#if dups.length > 0}
                    <div class="dups-box">
                      <div class="dups-title">⚠️ Invariant violations (same group in multiple blocks)</div>
                      <div class="dups-tags">
                        {#each dups as gid (gid)}
                          <span class="group-tag warn">{gid}</span>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <div class="blocks-list">
                    {#each blocks as block (block.id)}
                      <div class="block-item">
                        <div class="block-header">
                          <span class="block-label">{block.label}</span>
                          <span class="block-order">#{block.order}</span>
                        </div>

                        <div class="block-meta">
                          <span class="meta-item">{block.studyGroupIds.length} groups</span>
                          <span class="meta-item">color: {(block as Block).colorIndex ?? '?'}</span>
                          <span class="meta-item mono" title={block.id}>{formatBlockId(block.id)}</span>
                        </div>

                        {#if block.studyGroupIds.length > 0}
                          <div class="group-ids">
                            {#each block.studyGroupIds as groupId (groupId)}
                              <span class="group-tag">{groupId}</span>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {:else if expandedInstances.has(instanceId)}
                  <div class="empty-blocks">No blocks</div>
                {/if}

                <div class="instance-actions">
                  <button
                    class="action-btn primary"
                    onclick={() => autoPartition(instanceId)}
                    title="Auto-partition this instance (requires study groups cached)"
                    disabled={!hasSG}
                  >
                    Auto Partition
                  </button>

                  <button
                    class="action-btn invalidate"
                    onclick={() => invalidateInstance(instanceId)}
                    title="Invalidate cache for this instance"
                  >
                    Invalidate
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Error State -->
      {#if storeState.error}
        <div class="section error">
          <h4>⚠️ Error</h4>
          <div class="error-message">{storeState.error}</div>
        </div>
      {/if}

      <!-- Action Buttons -->
      <div class="actions">
        <button class="action-btn danger" onclick={clearStore}>Clear Store</button>
      </div>
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

  /* Stats Grid */
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

  .stat-item .label {
    color: #495057;
    font-weight: 600;
  }

  .stat-item .value {
    color: #0d6efd;
    font-weight: 600;
  }

  .stat-item .value.active {
    color: #ffc107;
  }

  .list {
    background: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    max-height: 100px;
    overflow-y: auto;
  }

  .item {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid #e9ecef;
    color: #0d6efd;
  }
  .item:last-child {
    border-bottom: none;
  }

  .empty {
    color: #adb5bd;
    font-style: italic;
    padding: 0.5rem;
    text-align: center;
  }

  .empty-blocks {
    padding: 0.5rem;
    color: #adb5bd;
    font-style: italic;
    background: #f8f9fa;
    border-radius: 3px;
  }

  /* Instances List */
  .instances-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .instance-item {
    border: 1px solid #e9ecef;
    border-radius: 4px;
    overflow: hidden;
    background: white;
  }

  .instance-header {
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
    transition: background 0.2s;
  }

  .instance-header:hover {
    background: #e9ecef;
  }

  .instance-header.expanded {
    background: #dbeafe;
    border-bottom-color: #93c5fd;
  }

  .expand-icon {
    font-size: 0.65rem;
    width: 0.8rem;
    flex-shrink: 0;
  }

  .instance-name {
    color: #0d6efd;
    font-weight: 600;
    flex: 1;
    word-break: break-all;
  }

  .block-count {
    color: #198754;
    white-space: nowrap;
    font-size: 0.7rem;
  }

  .instance-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.45rem 0.5rem;
    background: #ffffff;
    border-bottom: 1px solid #e9ecef;
  }

  .pill {
    background: #e9ecef;
    color: #495057;
    padding: 0.12rem 0.35rem;
    border-radius: 999px;
    font-size: 0.65rem;
    line-height: 1.2;
  }
  .pill.warn {
    background: #fff3cd;
    color: #664d03;
  }
  .pill.ok {
    background: #d1e7dd;
    color: #0f5132;
  }
  .pill.warn.active {
    background: #f8d7da;
    color: #842029;
  }

  /* Duplicates box */
  .dups-box {
    margin: 0.5rem;
    padding: 0.5rem;
    background: #fff3cd;
    border: 1px solid #ffe69c;
    border-radius: 4px;
  }

  .dups-title {
    font-weight: 700;
    margin-bottom: 0.35rem;
    color: #664d03;
    font-size: 0.7rem;
  }

  .dups-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  /* Blocks List */
  .blocks-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    background: white;
    border-top: 1px solid #e9ecef;
  }

  .block-item {
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 3px;
    border: 1px solid #e9ecef;
  }

  .block-header {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
    align-items: baseline;
  }

  .block-label {
    color: #2c3e50;
    font-weight: 600;
    flex: 1;
    word-break: break-word;
  }

  .block-order {
    color: #6c757d;
    font-size: 0.65rem;
    white-space: nowrap;
  }

  .block-meta {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.3rem;
    font-size: 0.65rem;
  }

  .meta-item {
    background: #e9ecef;
    color: #495057;
    padding: 0.15rem 0.3rem;
    border-radius: 2px;
  }

  .group-ids {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .group-tag {
    background: #dbeafe;
    color: #1e40af;
    padding: 0.15rem 0.3rem;
    border-radius: 2px;
    font-size: 0.65rem;
    font-weight: 600;
  }

  .group-tag.warn {
    background: #f8d7da;
    color: #842029;
  }

  /* Instance Actions */
  .instance-actions {
    display: flex;
    gap: 0.3rem;
    padding: 0.4rem 0.5rem;
    border-top: 1px solid #e9ecef;
    background: #f8f9fa;
  }

  .action-btn {
    padding: 0.3rem 0.4rem;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.65rem;
    font-weight: 600;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    flex: 1;
  }

  .action-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .action-btn.primary {
    background: #0d6efd;
    color: white;
  }
  .action-btn.primary:hover {
    background: #0b5ed7;
  }
  .action-btn.primary:disabled:hover {
    background: #0d6efd;
  }

  .action-btn.invalidate {
    background: #fff3cd;
    color: #664d03;
  }
  .action-btn.invalidate:hover {
    background: #ffe69c;
  }

  /* Global Actions */
  .actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }

  .action-btn.danger {
    background: #dc3545;
    color: white;
    flex: 1;
    padding: 0.4rem 0.5rem;
    font-size: 0.7rem;
  }
  .action-btn.danger:hover {
    background: #c82333;
  }

  .error-message {
    color: #dc3545;
    padding: 0.5rem;
    word-break: break-word;
    background: white;
    border-radius: 3px;
  }
</style>
