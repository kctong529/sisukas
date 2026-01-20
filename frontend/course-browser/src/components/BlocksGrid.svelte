<script lang="ts">
  import { blockStore } from '../lib/stores/blockStore';
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
  let unsubscribeGroups: (() => void) | null = null;
  let unsubscribeBlocks: (() => void) | null = null;
  let unsubscribeBlocksLoading: (() => void) | null = null;

  $: if (course) {
    if (unsubscribeGroups) unsubscribeGroups();
    if (unsubscribeBlocks) unsubscribeBlocks();
    if (unsubscribeBlocksLoading) unsubscribeBlocksLoading();

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
  }

  onDestroy(() => {
    if (unsubscribeGroups) unsubscribeGroups();
    if (unsubscribeBlocks) unsubscribeBlocks();
    if (unsubscribeBlocksLoading) unsubscribeBlocksLoading();
    detachGlobalMouseUp();
  });

  // Drag-select state
  let isSelecting = false;
  let firstSelectedIndex = -1;
  let selectedGroupIds: string[] = [];
  let committingIds: string[] = [];

  let groupColorIndexById: Record<string, number> = {};

  $: {
    const map: Record<string, number> = {};
    blocks.forEach((block, i) => {
      const colorIndex = i % 6;
      block.studyGroupIds.forEach(gid => {
        map[gid] = colorIndex;
      });
    });
    groupColorIndexById = map;
  }

  // Preview logic for the "next" color in the cycle
  $: nextColorIndex = blocks.length % 6;

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
    await blockStore.createBlock(course.id, label, ids, blocks.length);
  }

  function attachGlobalMouseUp() {
    window.addEventListener('mouseup', handleGlobalMouseUp, true);
  }

  function detachGlobalMouseUp() {
    window.removeEventListener('mouseup', handleGlobalMouseUp, true);
  }

  function handleMouseDown(index: number, groupId: string, e: MouseEvent) {
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
    committingIds = ids; // Bridging state to prevent "blink"
    
    endSelection(true);

    try {
      await createBlockFromSelection(ids);
    } catch (err) {
      console.error('Failed to create block:', err);
    } finally {
      // Small timeout ensures the store update propagates before we clear the bridge
      setTimeout(() => {
        committingIds = [];
      }, 1);
    }
  }

  async function handleMouseUp() {
    await finalizeSelection();
  }

  async function handleGlobalMouseUp() {
    await finalizeSelection();
  }

  function handleTouchStart(index: number, groupId: string, e: TouchEvent) {
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
            
            on:mouseup={handleMouseUp}
            on:touchstart={(e) => handleTouchStart(idx, group.groupId, e)}
            on:touchmove={handleTouchMove}
            on:touchend={handleTouchEnd}
            
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
    flex: 1 1 42px; /* grow to fill, shrink if needed, 80px is the "ideal" width */
    max-width: 80px; /* Optional: prevents one single square from being too wide */
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

  /* 4. Priority: Block color beats selection color */
  .study-group-square.in-block:hover {
    background: color-mix(in srgb, rgb(var(--rgb)), white 88%) !important;
    border-color: rgb(var(--rgb)) !important;
    color: rgb(var(--rgb)) !important;
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