<!-- src/components/BlockStoreDebug.svelte -->
<script lang="ts">
  import { blockStore } from '../../lib/stores/blockStore';
  import { studyGroupStore } from '../../lib/stores/studyGroupStore.svelte';
  import type { Block } from '../../domain/models/Block';
  import type { StudyGroup } from '../../domain/models/StudyGroup';
  
  interface BlockStoreState {
    blocksByCourseInstance: Record<string, Block[]>;
    loadingInstances: Set<string>;
    modifyingBlocks: Set<string>;
    error: string | null;
  }

  let storeState = $state<BlockStoreState | null>(null);
  let isOpen = $state(false);
  let expandedInstances = $state<Set<string>>(new Set());

  const unsubscribeBlocks = blockStore.subscribe((state: BlockStoreState) => {
    storeState = state;
  });

  $effect(() => () => unsubscribeBlocks());

  function togglePanel() {
    isOpen = !isOpen;
  }

  function toggleInstanceExpanded(instanceId: string) {
    const next = new Set(expandedInstances);
    if (next.has(instanceId)) next.delete(instanceId);
    else next.add(instanceId);
    expandedInstances = next;
  }

  function clearStore() {
    blockStore.clear();
  }

  function clearStudyGroups() {
    studyGroupStore.actions.clear();
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
    return Object.values(storeState.blocksByCourseInstance).reduce(
      (sum, blocks) => sum + (blocks?.length ?? 0),
      0
    );
  }

  function formatBlockId(blockId: string): string {
    const parts = blockId.split(":");
    if (parts.length >= 3) return parts.slice(2).join(":");
    return blockId;
  }

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
      if (typeof ci !== "number") continue;
      counts[ci] = (counts[ci] ?? 0) + 1;
    }
    return counts;
  }

  // ---------- StudyGroup cache helpers (UI-only) ----------
  const studyGroupKeyByInstanceId = $derived.by(() => {
    const map = new Map<string, string>();
    const instanceIds = Object.keys(storeState?.blocksByCourseInstance ?? {});
    for (const instanceId of instanceIds) {
      void instanceId;
    }
    return map;
  });

  function findStudyGroupCacheKeyForInstance(instanceId: string): string | null {
    return studyGroupKeyByInstanceId.get(instanceId) ?? null;
  }

  function getStudyGroupsForInstance(instanceId: string): StudyGroup[] {
    const key = findStudyGroupCacheKeyForInstance(instanceId);
    if (!key) return [];
    const [unitId, offeringId] = key.split(":");
    if (!unitId || !offeringId) return [];
    return studyGroupStore.read.getGroups(unitId, offeringId);
  }

  async function autoPartition(instanceId: string) {
    await blockStore.autoPartitionForInstance(instanceId, () =>
      getStudyGroupsForInstance(instanceId)
    );
  }
</script>

<div class="debug-panel" data-index="2">
  <button class="debug-toggle" onclick={togglePanel}>
    🧩 Block Store {isOpen ? "▼" : "▶"}
  </button>

  {#if isOpen && storeState}
    <div class="debug-content">
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

      {#if storeState.loadingInstances.size > 0}
        <div class="section">
          <h4>Loading ({storeState.loadingInstances.size})</h4>
          <div class="list" style="--dbg-list-max-height: 100px;">
            {#each Array.from(storeState.loadingInstances) as instanceId (instanceId)}
              <div class="item">⏳ {instanceId}</div>
            {/each}
          </div>
        </div>
      {/if}

      {#if storeState.modifyingBlocks.size > 0}
        <div class="section">
          <h4>Modifying ({storeState.modifyingBlocks.size})</h4>
          <div class="list" style="--dbg-list-max-height: 120px;">
            {#each Array.from(storeState.modifyingBlocks) as blockId (blockId)}
              <div class="item mono">{formatBlockId(blockId)}</div>
            {/each}
          </div>
        </div>
      {/if}

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
                <!-- REFACTORED: Use .header-toggle instead of .instance-header -->
                <button
                  class="header-toggle"
                  class:expanded={expandedInstances.has(instanceId)}
                  onclick={() => toggleInstanceExpanded(instanceId)}
                >
                  <span class="expand-icon">{expandedInstances.has(instanceId) ? "▼" : "▶"}</span>
                  <span class="instance-name">{instanceId}</span>
                  <span class="block-count">{blocks?.length ?? 0} blocks</span>
                </button>

                <div class="instance-summary">
                  <span class="pill">groups: {totalGroups}</span>
                  <span class="pill">unique: {uniq.size}</span>

                  <span class="pill" class:warn={!hasSG} class:ok={hasSG}>
                    studyGroups cached: {cachedStudyGroups.length}
                  </span>

                  <span class="pill">
                    colors: {Object.entries(colorCounts).map(([k, v]) => `${k}:${v}`).join(" ") || "-"}
                  </span>

                  <span class="pill warn" class:active={dups.length > 0}>dups: {dups.length}</span>
                </div>

                {#if expandedInstances.has(instanceId) && blocks && blocks.length > 0}
                  {#if dups.length > 0}
                    <div class="warn-box">
                      <div class="warn-title">⚠️ Invariant violations (same group in multiple blocks)</div>
                      <div class="tags">
                        {#each dups as gid (gid)}
                          <span class="tag warn">{gid}</span>
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
                          <span class="meta-item">color: {(block as Block).colorIndex ?? "?"}</span>
                          <span class="meta-item mono" title={block.id}>{formatBlockId(block.id)}</span>
                        </div>

                        {#if block.studyGroupIds.length > 0}
                          <div class="tags">
                            {#each block.studyGroupIds as groupId (groupId)}
                              <span class="tag">{groupId}</span>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {:else if expandedInstances.has(instanceId)}
                  <div class="empty-blocks">No blocks</div>
                {/if}

                <!-- REFACTORED: Use .btn-row instead of .instance-actions -->
                <div class="btn-row instance-actions">
                  <button
                    class="action-btn primary"
                    onclick={() => autoPartition(instanceId)}
                    title="Auto-partition this instance (requires study groups cached)"
                    disabled={!hasSG}
                  >
                    Auto Partition
                  </button>

                  <button
                    class="action-btn warn"
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

      {#if storeState.error}
        <div class="section error">
          <h4>⚠️ Error</h4>
          <div class="error-message">{storeState.error}</div>
        </div>
      {/if}

      <div class="actions">
        <button class="action-btn danger" onclick={clearStore}>Clear Block Store</button>
        <button class="action-btn danger" onclick={clearStudyGroups}>Clear Study Groups</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    --dbg-max-width: 520px;
    --dbg-max-height: 680px;
    --dbg-content-max-height: 630px;
  }

  /* Layout containers - component-specific */
  .instances-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .instance-item {
    border: 1px solid var(--dbg-muted-border);
    border-radius: 4px;
    overflow: hidden;
    background: white;
  }

  /* REMOVED: .instance-header, .expand-icon, .instance-actions CSS
     They are now defined globally in debug-panels.css */

  /* Component-specific text styling */
  .instance-name {
    color: var(--dbg-blue);
    font-weight: 600;
    flex: 1;
    word-break: break-all;
  }

  .block-count {
    color: var(--dbg-green);
    white-space: nowrap;
    font-size: 0.7rem;
  }

  .instance-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.45rem 0.5rem;
    background: #ffffff;
    border-bottom: 1px solid var(--dbg-muted-border);
  }

  .warn-title {
    font-weight: 700;
    margin-bottom: 0.35rem;
    color: #664d03;
    font-size: 0.7rem;
  }

  .blocks-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    background: white;
    border-top: 1px solid var(--dbg-muted-border);
  }

  .block-item {
    padding: 0.5rem;
    background: var(--dbg-muted-bg);
    border-radius: 3px;
    border: 1px solid var(--dbg-muted-border);
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

  .empty-blocks {
    padding: 0.5rem;
    color: #adb5bd;
    font-style: italic;
    background: var(--dbg-muted-bg);
    border-radius: 3px;
  }

  /* Keep only layout-specific padding for actions row */
  .instance-actions {
    padding: 0.4rem 0.5rem;
    border-top: 1px solid var(--dbg-muted-border);
    background: var(--dbg-muted-bg);
  }

  .actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }

  .actions .action-btn {
    flex: 1;
  }
</style>
