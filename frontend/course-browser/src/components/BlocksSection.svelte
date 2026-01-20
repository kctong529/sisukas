<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { blockStore, blocksForInstance, isLoadingInstance } from '../lib/stores/blockStore';
  import { studyGroupStore } from '../lib/stores/studyGroupStore';
  import type { Block } from '../domain/models/Block';
  import type { StudyGroup } from '../domain/models/StudyGroup';

  export let courseInstanceId: string;
  export let courseInstanceName: string;

  // Prefer passing explicitly, but we will still try to parse.
  export let courseUnitId: string | null = null;
  export let courseOfferingId: string | null = null;

  const blocksStore = blocksForInstance(courseInstanceId);
  const loadingStore = isLoadingInstance(courseInstanceId);

  let blocks: Block[] = [];
  let isLoading = false;
  let error = '';
  let modifyingBlocks = new Set<string>();

  // Always-visible list
  let studyGroups: StudyGroup[] = [];

  // PeriodSelector-style selection
  let isSelecting = false;
  let firstSelectedIndex = -1;
  let selectedGroupIds: string[] = [];

  // rename
  let editingBlockId: string | null = null;
  let editingLabel = '';

  // groupId -> colorIndex
  let groupColorIndexById: Record<string, number> = {};

  const unsubs: Array<() => void> = [];

  onMount(() => {
    // IMPORTANT: clone array so reactive statements rerun reliably
    unsubs.push(
      blocksStore.subscribe((v) => {
        blocks = v ? [...v] : [];
      })
    );

    unsubs.push(loadingStore.subscribe((v) => (isLoading = v)));

    unsubs.push(
      blockStore.subscribe((state: any) => {
        error = state.error || '';
        modifyingBlocks = new Set(state.modifyingBlocks);
      })
    );

    void load();
  });

  onDestroy(() => {
    for (const u of unsubs) u();
    detachGlobalMouseUp();
  });

  $: {
    // Recalculate colors whenever blocks change
    const map: Record<string, number> = {};
    for (let i = 0; i < blocks.length; i++) {
      const colorIndex = i % 12;
      for (const gid of blocks[i].studyGroupIds) map[gid] = colorIndex;
    }
    groupColorIndexById = map;
  }

  function groupColorIndex(groupId: string): number | null {
    const v = groupColorIndexById[groupId];
    return typeof v === 'number' ? v : null;
  }

  // ---- id parsing ----
  function parseIds() {
    if (courseUnitId && courseOfferingId) return { unit: courseUnitId, offering: courseOfferingId };
    const parts = courseInstanceId.split(':');
    if (parts.length >= 2) return { unit: parts[0], offering: parts.slice(1).join(':') };
    return { unit: null, offering: null };
  }

  // ---- fallback groups from blocks ----
  function inferStudyGroupTypeFromId(groupId: string): StudyGroup['type'] {
    const suffix = (groupId.split(':').pop() ?? '').toUpperCase();
    if (suffix.startsWith('EX')) return 'Exam';
    if (suffix.startsWith('L')) return 'Lecture';
    if (suffix.startsWith('E')) return 'Exercise';
    return 'Other' as any;
  }

  function fallbackGroupsFromBlocks(bs: Block[]): StudyGroup[] {
    const ids = new Set<string>();
    for (const b of bs) for (const id of b.studyGroupIds) ids.add(id);

    return Array.from(ids)
      .sort((a, b) => a.localeCompare(b))
      .map((groupId) => ({
        groupId,
        name: groupId,
        type: inferStudyGroupTypeFromId(groupId),
        studyEvents: []
      }));
  }

  // define visual order = the list order
  function sortGroups(gs: StudyGroup[]): StudyGroup[] {
    const rank = (t: string) => (t === 'Lecture' ? 0 : t === 'Exercise' ? 1 : t === 'Exam' ? 2 : 3);
    return [...gs].sort((a, b) => {
      const r = rank(a.type) - rank(b.type);
      if (r !== 0) return r;
      return (a.name || a.groupId).localeCompare(b.name || b.groupId);
    });
  }

  // ---- load ----
  async function load() {
    try {
      error = '';

      // 1) fetch blocks first (so fallback has content)
      await blockStore.fetchForInstance(courseInstanceId);

      // Wait a tick so the blocks subscription has updated `blocks`
      await tick();

      // 2) try fetch study groups from service
      const { unit, offering } = parseIds();
      if (unit && offering) {
        const fetched = await studyGroupStore.fetch(unit, offering);
        if (fetched && fetched.length > 0) {
          studyGroups = sortGroups(fetched);
          return;
        }
      }

      // 3) fallback from blocks
      const bsNow = get(blocksStore) ?? blocks;
      const fallback = fallbackGroupsFromBlocks(bsNow);
      studyGroups = sortGroups(fallback);
    } catch (err) {
      // Still show fallback rather than blank UI
      const bsNow = get(blocksStore) ?? blocks;
      studyGroups = sortGroups(fallbackGroupsFromBlocks(bsNow));
      error = err instanceof Error ? err.message : 'Failed to load data';
    }
  }

  // ======================
  // Selection + block creation (release creates block)
  // ======================
  function updateSelectionRange(index: number) {
    if (!isSelecting || firstSelectedIndex === -1) return;

    const start = Math.min(firstSelectedIndex, index);
    const end = Math.max(firstSelectedIndex, index);
    selectedGroupIds = studyGroups.slice(start, end + 1).map((g) => g.groupId);
  }

  function endSelection(clear = false) {
    isSelecting = false;
    firstSelectedIndex = -1;
    if (clear) selectedGroupIds = [];
  }

  async function createBlockFromSelection(ids: string[]) {
    if (ids.length === 0) return;
    const label = ids.length === 1 ? 'Block (1 group)' : `Block (${ids.length} groups)`;
    await blockStore.createBlock(courseInstanceId, label, ids, blocks.length);
  }

  // global mouseup so release outside still works
  function attachGlobalMouseUp() {
    window.addEventListener('mouseup', handleGlobalMouseUp, true);
  }
  function detachGlobalMouseUp() {
    window.removeEventListener('mouseup', handleGlobalMouseUp, true);
  }

  function handleMouseDown(index: number, groupId: string, e: MouseEvent) {
    if (isLoading) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    isSelecting = true;
    firstSelectedIndex = index;
    selectedGroupIds = [groupId];

    attachGlobalMouseUp();
  }

  function handleMouseOver(index: number) {
    updateSelectionRange(index);
  }

  async function finalizeSelection() {
    if (!isSelecting) return;

    detachGlobalMouseUp();

    const ids = [...selectedGroupIds];
    endSelection(true);

    try {
      error = '';
      await createBlockFromSelection(ids);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create block';
    }
  }

  async function handleMouseUp() {
    await finalizeSelection();
  }

  async function handleGlobalMouseUp() {
    await finalizeSelection();
  }

  // touch (PeriodSelector hit-test)
  function handleTouchStart(index: number, groupId: string, e: TouchEvent) {
    if (isLoading) return;
    e.preventDefault();
    isSelecting = true;
    firstSelectedIndex = index;
    selectedGroupIds = [groupId];
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isSelecting) return;

    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = (element as HTMLElement | null)?.closest?.('[data-index]') as HTMLElement | null;
    if (!row) return;

    const raw = row.getAttribute('data-index');
    const idx = raw ? parseInt(raw, 10) : -1;
    if (idx !== -1) updateSelectionRange(idx);
  }

  async function handleTouchEnd() {
    await finalizeSelection();
  }

  // ======================
  // Block actions
  // ======================
  const isModifying = (id: string) => modifyingBlocks.has(id);

  function startEdit(b: Block) {
    editingBlockId = b.id;
    editingLabel = b.label;
  }

  async function saveEdit(b: Block) {
    const next = editingLabel.trim();
    if (!next || next === b.label) {
      editingBlockId = null;
      return;
    }
    try {
      error = '';
      await blockStore.updateBlockLabel(b.id, next);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to rename block';
    } finally {
      editingBlockId = null;
    }
  }

  async function deleteBlock(id: string) {
    if (!confirm('Delete this block?')) return;
    try {
      error = '';
      await blockStore.deleteBlock(id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete block';
    }
  }
</script>

<div class="wrap">
  <header class="header">
    <div class="title">
      <h2>{courseInstanceName}</h2>
      <div class="subtitle">{courseInstanceId}</div>
    </div>
  </header>

  {#if error}
    <div class="alert">
      <span>⚠️</span>
      <span>{error}</span>
    </div>
  {/if}

  <div class="grid">
    <!-- LEFT: Study groups -->
    <section class="panel">
      <div class="panel-head">
        <h3>Study groups</h3>
        <div class="hint">Drag to select a range. Release creates a block.</div>
      </div>

      {#if isLoading}
        <div class="muted">Loading…</div>
      {:else if studyGroups.length === 0}
        <div class="muted">
          No study groups found for this instance.
          <div class="small">
            If this instance should have groups, make sure you pass <code>courseUnitId</code> and <code>courseOfferingId</code>.
          </div>
        </div>
      {:else}
        <div class="list" class:dragging={isSelecting}>
          {#each studyGroups as g, idx (g.groupId)}
            <div
              class="row"
              class:selected={selectedGroupIds.includes(g.groupId)}
              class:in-block={groupColorIndex(g.groupId) !== null}
              data-index={idx}
              data-color={groupColorIndex(g.groupId) ?? ''}
              role="button"
              tabindex="0"
              on:mousedown={(e) => handleMouseDown(idx, g.groupId, e)}
              on:mouseover={() => handleMouseOver(idx)}
              on:mouseup={handleMouseUp}
              on:touchstart={(e) => handleTouchStart(idx, g.groupId, e)}
              on:touchmove={handleTouchMove}
              on:touchend={handleTouchEnd}
            >
              <div class="row-name">{g.name || g.groupId}</div>
              <div class="row-meta">
                <span class="pill">{g.type}</span>
                <span class="mono">{g.groupId}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- RIGHT: Blocks -->
    <section class="panel">
      <div class="panel-head">
        <h3>Blocks</h3>
        <div class="hint">Different colors = different blocks</div>
      </div>

      {#if blocks.length === 0}
        <div class="muted">No blocks yet. Drag-select study groups to create one.</div>
      {:else}
        <div class="blocks">
          {#each blocks as b, i (b.id)}
            <div class="block" data-color={i % 12}>
              <div class="block-top">
                <div class="legend"><span class="dot" aria-hidden="true"></span></div>

                {#if editingBlockId === b.id}
                  <input
                    class="input"
                    bind:value={editingLabel}
                    on:keydown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter') saveEdit(b);
                      if (e.key === 'Escape') editingBlockId = null;
                    }}
                    on:blur={() => saveEdit(b)}
                    autofocus
                  />
                {:else}
                  <button class="link" on:click={() => startEdit(b)} disabled={isModifying(b.id)} title="Rename">
                    {b.label}
                  </button>
                {/if}

                <div class="block-meta">
                  <span class="pill neutral">{b.studyGroupIds.length} groups</span>
                </div>
              </div>

              <div class="block-actions">
                <button class="btn btn-secondary btn-sm" on:click={() => startEdit(b)} disabled={isModifying(b.id)}>
                  Rename
                </button>
                <button class="btn btn-danger btn-sm" on:click={() => deleteBlock(b.id)} disabled={isModifying(b.id)}>
                  Delete
                </button>
              </div>

              <div class="block-ids mono">
                {#if b.studyGroupIds.length === 0}
                  <span class="muted">Empty block</span>
                {:else}
                  {b.studyGroupIds.join(', ')}
                {/if}
              </div>

              {#if isModifying(b.id)}
                <div class="saving">Saving…</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  /* 12 distinct block colors (RGB triples) */
  .wrap {
    --c0:  30, 64, 175;
    --c1:  2, 132, 199;
    --c2:  8, 145, 178;
    --c3:  13, 148, 136;
    --c4:  22, 163, 74;
    --c5:  101, 163, 13;
    --c6:  202, 138, 4;
    --c7:  234, 88, 12;
    --c8:  220, 38, 38;
    --c9:  190, 24, 93;
    --c10: 124, 58, 237;
    --c11: 79, 70, 229;
  }

  /* row color binding */
  .in-block[data-color="0"]  { --rgb: var(--c0); }
  .in-block[data-color="1"]  { --rgb: var(--c1); }
  .in-block[data-color="2"]  { --rgb: var(--c2); }
  .in-block[data-color="3"]  { --rgb: var(--c3); }
  .in-block[data-color="4"]  { --rgb: var(--c4); }
  .in-block[data-color="5"]  { --rgb: var(--c5); }
  .in-block[data-color="6"]  { --rgb: var(--c6); }
  .in-block[data-color="7"]  { --rgb: var(--c7); }
  .in-block[data-color="8"]  { --rgb: var(--c8); }
  .in-block[data-color="9"]  { --rgb: var(--c9); }
  .in-block[data-color="10"] { --rgb: var(--c10); }
  .in-block[data-color="11"] { --rgb: var(--c11); }

  /* block card color binding */
  .block[data-color="0"]  { --rgb: var(--c0); }
  .block[data-color="1"]  { --rgb: var(--c1); }
  .block[data-color="2"]  { --rgb: var(--c2); }
  .block[data-color="3"]  { --rgb: var(--c3); }
  .block[data-color="4"]  { --rgb: var(--c4); }
  .block[data-color="5"]  { --rgb: var(--c5); }
  .block[data-color="6"]  { --rgb: var(--c6); }
  .block[data-color="7"]  { --rgb: var(--c7); }
  .block[data-color="8"]  { --rgb: var(--c8); }
  .block[data-color="9"]  { --rgb: var(--c9); }
  .block[data-color="10"] { --rgb: var(--c10); }
  .block[data-color="11"] { --rgb: var(--c11); }

  .wrap {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .header {
    padding: 16px;
    border-bottom: 1px solid #e5e7eb;
    background: #fafafa;
  }

  .title h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #111827;
  }

  .subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: #6b7280;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .alert {
    margin: 12px 16px 0 16px;
    padding: 10px 12px;
    border-radius: 10px;
    display: flex;
    gap: 10px;
    align-items: center;
    border: 1px solid #fecaca;
    background: #fee2e2;
    color: #991b1b;
    font-size: 14px;
  }

  .grid {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 16px;
    padding: 16px;
  }

  .panel {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    background: white;
    min-height: 240px;
  }

  .panel-head {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
    background: #fbfbfb;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: baseline;
  }

  .panel-head h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .hint {
    font-size: 12px;
    color: #6b7280;
  }

  .muted {
    padding: 12px;
    color: #6b7280;
    font-size: 14px;
  }

  .small {
    margin-top: 6px;
    font-size: 12px;
    color: #6b7280;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  /* LEFT LIST */
  .list {
    padding: 10px;
    max-height: 560px;
    overflow: auto;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }

  .row {
    padding: 10px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: white;
    cursor: pointer;
    user-select: none;
    margin-bottom: 6px;
    transition: background 100ms ease, border-color 100ms ease, box-shadow 100ms ease;
  }

  .row:hover {
    background: #f3f4f6;
  }

  /* in-block tint */
  .row.in-block {
    background: rgba(var(--rgb), 0.14);
    border-color: rgba(var(--rgb), 0.45);
  }

  /* drag selection overlay (outline only, so it doesn't fight block colors) */
  .row.selected {
    outline: 2px solid rgba(0, 0, 0, 0.65);
    outline-offset: 1px;
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.14) inset;
  }

  .list.dragging .row:hover {
    background: inherit;
  }

  .row-name {
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .row-meta {
    margin-top: 6px;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .pill {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.8);
    color: #111827;
    white-space: nowrap;
  }

  .pill.neutral {
    background: #f3f4f6;
    border-color: #e5e7eb;
    color: #374151;
  }

  /* RIGHT BLOCKS */
  .blocks {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 560px;
    overflow: auto;
  }

  .block {
    border: 1px solid rgba(var(--rgb), 0.45);
    border-radius: 12px;
    padding: 10px;
    background: rgba(var(--rgb), 0.08);
  }

  .block-top {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  }

  .legend {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: rgb(var(--rgb));
    border: 1px solid rgba(0, 0, 0, 0.12);
  }

  .block-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
  }

  .block-actions {
    margin-top: 8px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .block-ids {
    margin-top: 8px;
    font-size: 12px;
    color: #374151;
    line-height: 1.35;
    word-break: break-word;
  }

  .saving {
    margin-top: 8px;
    font-size: 12px;
    color: #6b7280;
    font-style: italic;
  }

  .btn {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }

  .btn:hover:not(:disabled) {
    background: #f3f4f6;
  }

  .btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .btn-sm {
    padding: 6px 8px;
    font-size: 12px;
    border-radius: 9px;
  }

  .btn-secondary {
    background: #f3f4f6;
  }

  .btn-danger {
    background: #fee2e2;
    border-color: #fecaca;
    color: #991b1b;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fecaca;
  }

  .link {
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    color: #111827;
    cursor: pointer;
    text-align: left;
  }

  .link:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .input {
    width: 100%;
    padding: 8px 10px;
    border-radius: 10px;
    border: 2px solid #2563eb;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
    outline: none;
    background: white;
  }

  @media (max-width: 960px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
