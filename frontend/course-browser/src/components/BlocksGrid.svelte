<script lang="ts">
  import { blockStore, previewColorForInstance } from '../lib/stores/blockStore';
  import { studyGroupStore } from '../lib/stores/studyGroupStore';
  import type { Block } from '../domain/models/Block';
  import type { Course } from '../domain/models/Course';
  import type { StudyGroup } from '../domain/models/StudyGroup';
  import { onDestroy } from 'svelte';

  export let course: Course;
  export let isExpanded: boolean;

  // Reactive load trigger: fetch when expanded
  $: if (isExpanded && course) {
    studyGroupStore.fetch(course.unitId, course.id);
    blockStore.fetchForInstance(course.id);
  }

  // Subscribe to stores
  let studyGroups: StudyGroup[] = [];
  let blocks: Block[] = [];
  let isLoading = false;

  let nextColorIndex = 0;
  let groupColorIndexById: Record<string, number> = {};

  let unsubscribeGroups: (() => void) | null = null;
  let unsubscribeBlocks: (() => void) | null = null;
  let unsubscribeBlocksLoading: (() => void) | null = null;
  let unsubscribePreview: (() => void) | null = null;

  let hasDragged = false;
  let downIndex = -1;

  $: if (course) {
    // reset subscriptions on course change
    if (unsubscribeGroups) unsubscribeGroups();
    if (unsubscribeBlocks) unsubscribeBlocks();
    if (unsubscribeBlocksLoading) unsubscribeBlocksLoading();
    if (unsubscribePreview) unsubscribePreview();

    unsubscribeGroups = studyGroupStore.subscribe(state => {
      const key = `${course.unitId}:${course.id}`;
      studyGroups = state.cache[key] || [];
    });

    unsubscribeBlocks = blockStore.subscribe(state => {
      blocks = state.blocksByCourseInstance[course.id] || [];
    });

    unsubscribeBlocksLoading = blockStore.subscribe(state => {
      isLoading = state.loadingInstances.has(course.id);
    });

    unsubscribePreview = previewColorForInstance(course.id).subscribe(v => {
      nextColorIndex = v;
    });
  }

  onDestroy(() => {
    if (unsubscribeGroups) unsubscribeGroups();
    if (unsubscribeBlocks) unsubscribeBlocks();
    if (unsubscribeBlocksLoading) unsubscribeBlocksLoading();
    if (unsubscribePreview) unsubscribePreview();
    detachGlobalMouseUp();
  });

  // Drag-select state
  let isSelecting = false;
  let firstSelectedIndex = -1;
  let selectedGroupIds: string[] = [];
  let committingIds: string[] = [];

  function computeGroupColorIndexMap(blocks: Block[]) {
    const map: Record<string, number> = {};
    for (const block of blocks) {
      for (const gid of block.studyGroupIds) map[gid] = block.colorIndex;
    }
    return map;
  }

  $: groupColorIndexById = computeGroupColorIndexMap(blocks);

  function updateSelectionRange(index: number) {
    if (!isSelecting || firstSelectedIndex === -1) return;
    const start = Math.min(firstSelectedIndex, index);
    const end = Math.max(firstSelectedIndex, index);
    selectedGroupIds = studyGroups.slice(start, end + 1).map(g => g.groupId);
  }

  function endSelection(clear = false) {
    isSelecting = false;
    firstSelectedIndex = -1;
    if (clear) selectedGroupIds = [];
  }

  async function createBlockFromSelection(ids: string[]) {
    if (ids.length === 0) return;
    const label = ids.length === 1 ? 'Block (1 group)' : `Block (${ids.length} groups)`;
    await blockStore.createBlock(course.id, label, ids, blocks.length, nextColorIndex);
  }

  function attachGlobalMouseUp() {
    window.addEventListener('mouseup', handleGlobalMouseUp, true);
  }

  function detachGlobalMouseUp() {
    window.removeEventListener('mouseup', handleGlobalMouseUp, true);
  }

  async function handleMouseDown(index: number, groupId: string, e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    hasDragged = false;
    downIndex = index;

    // Enter dragging state immediately (your current behavior)
    isSelecting = true;
    firstSelectedIndex = index;
    selectedGroupIds = [groupId];
    attachGlobalMouseUp();

    // Reserve color (no deletion)
    await blockStore.beginDragSelect(course.id);
  }

  function handleMouseOver(index: number) {
    // if we moved off the starting square, it's a drag
    if (index !== downIndex) hasDragged = true;
    updateSelectionRange(index);
  }

  async function finalizeSelection() {
    if (!isSelecting) return;
    detachGlobalMouseUp();

    const ids = [...selectedGroupIds];
    const firstId = ids[0];

    // CLICK (no drag)
    if (!hasDragged) {
      // If it was in a block: remove that block and stop.
      const removed = await blockStore.removeBlockIfGroupIsAssigned(course.id, firstId);
      endSelection(true);
      committingIds = [];

      // If it was NOT in a block: create a 1-group block.
      if (!removed) {
        committingIds = [firstId]; // "no blink" bridge
        try {
          await createBlockFromSelection([firstId]);
        } catch (err) {
          console.error('Failed to create block:', err);
        } finally {
          setTimeout(() => (committingIds = []), 1);
        }
      }

      return;
    }

    // DRAG
    committingIds = ids;
    endSelection(true);

    try {
      await createBlockFromSelection(ids);
    } catch (err) {
      console.error('Failed to create block:', err);
    } finally {
      setTimeout(() => {
        committingIds = [];
      }, 1);
    }
  }


  async function handleGlobalMouseUp() {
    await finalizeSelection();
  }

  // ===== Touch =====

  async function handleTouchStart(index: number, groupId: string, e: TouchEvent) {
    e.preventDefault();

    hasDragged = false;
    downIndex = index;

    isSelecting = true;
    firstSelectedIndex = index;
    selectedGroupIds = [groupId];

    await blockStore.beginDragSelect(course.id);
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
    if (idx !== -1) {
      if (idx !== downIndex) hasDragged = true;
      updateSelectionRange(idx);
    }
  }

  async function handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    await finalizeSelection();
  }

  async function handleTouchCancel(e: TouchEvent) {
    e.preventDefault();
    // Cancel without creating/removing
    endSelection(true);
    committingIds = [];
    hasDragged = false;
    downIndex = -1;
  }

</script>

<div class="blocks-grid">
  {#if isLoading}
    <div class="loading">Loading study groups...</div>
  {:else if studyGroups.length === 0}
    <div class="empty">No study groups available</div>
  {:else}
    <div class="section">
      <div
        class="squares-container"
        class:dragging={isSelecting}
        style="--next-rgb: var(--c{nextColorIndex});"
      >
        {#each studyGroups as group, idx (group.groupId)}
          <div
            class="study-group-square"
            class:selected={selectedGroupIds.includes(group.groupId) || committingIds.includes(group.groupId)}
            class:in-block={groupColorIndexById[group.groupId] !== undefined}
            data-color={groupColorIndexById[group.groupId] ?? ''}
            data-index={idx}
            on:mousedown={(e) => handleMouseDown(idx, group.groupId, e)}
            on:mouseenter={() => handleMouseOver(idx)}
            on:focus={() => handleMouseOver(idx)}

            on:touchstart={(e) => handleTouchStart(idx, group.groupId, e)}
            on:touchmove={handleTouchMove}
            on:touchend={handleTouchEnd}
            on:touchcancel={handleTouchCancel}

            role="button"
            tabindex="0"
          >
            <div class="square-name">{group.name}</div>
            <div class="square-type">{group.type}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  :root {
    --primary: #4a90e2;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
  }

  .blocks-grid {
    --c0: 234, 88, 12;   /* Burnt Orange */
    --c1: 21, 128, 61;   /* Forest Green */
    --c2: 124, 58, 237;  /* Deep Violet */
    --c3: 2, 132, 199;   /* Sky Blue */
    --c4: 245, 158, 11;  /* Amber */
    --c5: 219, 39, 119;  /* Deep Pink */

    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Core Variable Mapping */
  .study-group-square[data-color="0"] { --rgb: var(--c0); }
  .study-group-square[data-color="1"] { --rgb: var(--c1); }
  .study-group-square[data-color="2"] { --rgb: var(--c2); }
  .study-group-square[data-color="3"] { --rgb: var(--c3); }
  .study-group-square[data-color="4"] { --rgb: var(--c4); }
  .study-group-square[data-color="5"] { --rgb: var(--c5); }

  /* 1. Base Square (No Transitions to avoid blink) */
  .study-group-square {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1 1 42px;
    max-width: 80px;
    padding: 0.4rem;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-main);
    cursor: pointer;
    user-select: none;
    transition: none;
  }

  /* 2. Permanent Block Style */
  .study-group-square.in-block {
    background: color-mix(in srgb, rgb(var(--rgb)), white 88%) !important;
    border-color: rgb(var(--rgb)) !important;
    color: rgb(var(--rgb)) !important;
  }

  /* 3. Selection/Hover Preview (Using next block color) */
  .study-group-square:hover,
  .study-group-square.selected {
    outline: none;
    background-color: color-mix(in srgb, rgb(var(--next-rgb)), white 85%) !important;
    border-color: rgb(var(--next-rgb)) !important;
    color: rgb(var(--next-rgb)) !important;
  }

  /* 4. Priority: Block beats hover ONLY when not dragging */
  .squares-container:not(.dragging) .study-group-square.in-block:hover {
    background: color-mix(in srgb, rgb(var(--rgb)), white 88%) !important;
    border-color: rgb(var(--rgb)) !important;
    color: rgb(var(--rgb)) !important;
  }

  /* During drag, preview must win (even over in-block) */
  .squares-container.dragging .study-group-square.selected,
  .squares-container.dragging .study-group-square:hover {
    background-color: color-mix(in srgb, rgb(var(--next-rgb)), white 85%) !important;
    border-color: rgb(var(--next-rgb)) !important;
    color: rgb(var(--next-rgb)) !important;
  }

  /* Darken Amber text for legibility */
  .study-group-square.in-block[data-color="4"],
  .squares-container[style*="--c4"].dragging .study-group-square:hover {
    color: #b45309 !important;
  }

  .squares-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem;
    touch-action: none;
  }

  .square-name {
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.1;
    word-break: break-word;
    color: var(--primary);
  }

  .square-type {
    font-size: 0.6rem;
    background: rgba(0, 0, 0, 0.03);
    padding: 0.1rem 0.25rem;
    border-radius: 2px;
    width: fit-content;
  }
</style>
