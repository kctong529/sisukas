<!-- src/components/BlocksGrid.svelte -->
<script lang="ts">
  import { tick, onDestroy } from "svelte";
  import { blockStore, previewColorForInstance } from "../lib/stores/blockStore";
  import { studyGroupStore } from "../lib/stores/studyGroupStore.svelte";
  import type { Block } from "../domain/models/Block";
  import type { Course } from "../domain/models/Course";

  const { course } = $props<{ course: Course }>();

  // ---- Minimal derived: template needs groups to render ----
  const studyGroups = $derived.by(() =>
    course ? studyGroupStore.read.getGroups(course.unitId, course.id) : []
  );

  let unsubscribeBlocks: (() => void) | null = null;
  let unsubscribePreview: (() => void) | null = null;

  const fetchedFor = new Set<string>();
  const autoPartitionDoneFor = new Set<string>();

  // Fetch once per instance (store decides if it actually fetches)
  $effect(() => {
    if (!course) return;
    if (fetchedFor.has(course.id)) return;

    fetchedFor.add(course.id);

    studyGroupStore.actions.ensureFetched(course.unitId, course.id);
    blockStore.fetchForInstance(course.id);
  });

  // Auto-partition once when groups exist
  $effect(() => {
    if (!course) return;
    if (autoPartitionDoneFor.has(course.id)) return;
    if (studyGroups.length === 0) return;

    autoPartitionDoneFor.add(course.id);
    blockStore.autoPartitionForInstance(course.id, () => studyGroups);
  });

  // Subscribe to block store + preview color (legacy stores)
  $effect(() => {
    if (!course) return;

    unsubscribeBlocks?.();
    unsubscribePreview?.();

    unsubscribeBlocks = blockStore.subscribe((state) => {
      blocks = state.blocksByCourseInstance[course.id] || [];
    });

    unsubscribePreview = previewColorForInstance(course.id).subscribe((v) => {
      nextColorIndex = v;
    });

    return () => {
      unsubscribeBlocks?.();
      unsubscribePreview?.();
      unsubscribeBlocks = null;
      unsubscribePreview = null;
    };
  });

  onDestroy(() => {
    unsubscribeBlocks?.();
    unsubscribePreview?.();
    detachGlobalMouseUp();
  });

  // ---- Local state (mutated) ----
  let blocks = $state<Block[]>([]);
  let nextColorIndex = $state(0);

  // ---- Drag-select state (mutated + used by template) ----
  let hasDragged = $state(false);
  let downIndex = $state(-1);

  // Hold "dragging" styling during async delete+create to avoid 1-frame fallback
  let isCommitPreviewActive = $state(false);

  let isSelecting = $state(false);
  let firstSelectedIndex = $state(-1);
  let selectedGroupIds = $state<string[]>([]);
  let committingIds = $state<string[]>([]);

  function computeGroupColorIndexMap(bs: Block[]) {
    const map: Record<string, number> = {};
    for (const block of bs) {
      for (const gid of block.studyGroupIds) map[gid] = block.colorIndex;
    }
    return map;
  }

  const groupColorIndexById = $derived.by(() => computeGroupColorIndexMap(blocks));

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
    if (!course) return;
    if (ids.length === 0) return;
    const label = ids.length === 1 ? "Block (1 group)" : `Block (${ids.length} groups)`;
    await blockStore.createBlock(course.id, label, ids, blocks.length, nextColorIndex);
  }

  function attachGlobalMouseUp() {
    window.addEventListener("mouseup", handleGlobalMouseUp, true);
  }

  function detachGlobalMouseUp() {
    window.removeEventListener("mouseup", handleGlobalMouseUp, true);
  }

  async function handleMouseDown(index: number, groupId: string, e: MouseEvent) {
    if (!course) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    hasDragged = false;
    downIndex = index;

    isSelecting = true;
    firstSelectedIndex = index;
    selectedGroupIds = [groupId];
    attachGlobalMouseUp();

    await blockStore.beginDragSelect(course.id);
  }

  function handleMouseOver(index: number) {
    if (index !== downIndex) hasDragged = true;
    updateSelectionRange(index);
  }

  async function clearCommitBridgeAfterPaint() {
    await tick();
    setTimeout(() => {
      committingIds = [];
      isCommitPreviewActive = false;
    }, 0);
  }

  async function finalizeSelection() {
    if (!course) return;
    if (!isSelecting) return;
    detachGlobalMouseUp();

    const ids = [...selectedGroupIds];
    const firstId = ids[0];

    // CLICK (no drag)
    if (!hasDragged) {
      const removed = await blockStore.removeBlockIfGroupIsAssigned(course.id, firstId);
      endSelection(true);
      committingIds = [];

      if (!removed) {
        committingIds = [firstId];
        try {
          await createBlockFromSelection([firstId]);
        } catch (err) {
          console.error("Failed to create block:", err);
        } finally {
          await clearCommitBridgeAfterPaint();
        }
      }
      return;
    }

    // DRAG
    committingIds = ids;
    isCommitPreviewActive = true;
    endSelection(true);

    try {
      await createBlockFromSelection(ids);
    } catch (err) {
      console.error("Failed to create block:", err);
    } finally {
      await clearCommitBridgeAfterPaint();
    }
  }

  async function handleGlobalMouseUp() {
    await finalizeSelection();
  }

  // ===== Touch =====

  async function handleTouchStart(index: number, groupId: string, e: TouchEvent) {
    if (!course) return;
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
    const row = (element as HTMLElement | null)?.closest?.("[data-index]") as HTMLElement | null;
    if (!row) return;

    const raw = row.getAttribute("data-index");
    const idx = raw ? parseInt(raw, 10) : -1;
    if (idx !== -1) {
      if (idx !== downIndex) hasDragged = true;
      updateSelectionRange(idx);
    }
  }

  async function handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    await finalizeSelection();
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  function handleTouchCancel(e: TouchEvent) {
    e.preventDefault();
    endSelection(true);
    committingIds = [];
    isCommitPreviewActive = false;
    hasDragged = false;
    downIndex = -1;
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
</script>

<div class="blocks-grid">
  {#if studyGroups.length === 0}
    {#if course && studyGroupStore.read.isLoading(course.unitId, course.id)}
      <div class="loading">Loading study groups...</div>
    {:else}
      <div class="empty">No study groups available</div>
    {/if}
  {:else}
    <div class="section">
      <div
        class="squares-container"
        class:dragging={(isSelecting && hasDragged) || isCommitPreviewActive}
        style="--next-rgb: var(--c{nextColorIndex});"
      >
        {#each studyGroups as group, idx (group.groupId)}
          <div
            class="study-group-square"
            class:selected={selectedGroupIds.includes(group.groupId) || committingIds.includes(group.groupId)}
            class:commit-preview={committingIds.includes(group.groupId)}
            class:in-block={groupColorIndexById[group.groupId] !== undefined}
            data-color={groupColorIndexById[group.groupId] ?? ""}
            data-index={idx}
            onmousedown={(e) => handleMouseDown(idx, group.groupId, e)}
            onmouseenter={() => handleMouseOver(idx)}
            onfocus={() => handleMouseOver(idx)}
            ontouchstart={(e) => handleTouchStart(idx, group.groupId, e)}
            ontouchmove={handleTouchMove}
            ontouchend={handleTouchEnd}
            ontouchcancel={handleTouchCancel}
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
    --primary: #2f7fd6;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
  }

  .blocks-grid {
    --c0: 234, 88, 12;
    --c1: 21, 128, 61;
    --c2: 124, 58, 237;
    --c3: 2, 132, 199;
    --c4: 245, 158, 11;
    --c5: 219, 39, 119;

    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .study-group-square[data-color="0"] { --rgb: var(--c0); }
  .study-group-square[data-color="1"] { --rgb: var(--c1); }
  .study-group-square[data-color="2"] { --rgb: var(--c2); }
  .study-group-square[data-color="3"] { --rgb: var(--c3); }
  .study-group-square[data-color="4"] { --rgb: var(--c4); }
  .study-group-square[data-color="5"] { --rgb: var(--c5); }

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

  .study-group-square.in-block {
    background: color-mix(in srgb, rgb(var(--rgb)), white 88%) !important;
    border-color: rgb(var(--rgb)) !important;
    color: rgb(var(--rgb)) !important;
  }

  .study-group-square.selected:not(.in-block) {
    outline: none;
    background-color: color-mix(in srgb, rgb(var(--next-rgb)), white 85%) !important;
    border-color: rgb(var(--next-rgb)) !important;
    color: rgb(var(--next-rgb)) !important;
  }

  .study-group-square.commit-preview {
    outline: none;
    background-color: color-mix(in srgb, rgb(var(--next-rgb)), white 85%) !important;
    border-color: rgb(var(--next-rgb)) !important;
    color: rgb(var(--next-rgb)) !important;
  }

  @media (hover: hover) and (pointer: fine) {
    .study-group-square:hover {
      outline: none;
      background-color: color-mix(in srgb, rgb(var(--next-rgb)), white 85%) !important;
      border-color: rgb(var(--next-rgb)) !important;
      color: rgb(var(--next-rgb)) !important;
    }

    .squares-container:not(.dragging) .study-group-square.in-block:hover {
      background: color-mix(in srgb, rgb(var(--rgb)), white 85%) !important;
      border-color: rgb(var(--rgb)) !important;
      color: rgb(var(--rgb)) !important;
    }

    .squares-container.dragging .study-group-square:hover {
      background-color: color-mix(in srgb, rgb(var(--next-rgb)), white 85%) !important;
      border-color: rgb(var(--next-rgb)) !important;
      color: rgb(var(--next-rgb)) !important;
    }
  }

  .squares-container.dragging .study-group-square.selected {
    background-color: color-mix(in srgb, rgb(var(--next-rgb)), white 85%) !important;
    border-color: rgb(var(--next-rgb)) !important;
    color: rgb(var(--next-rgb)) !important;
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

  .empty {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
    padding: 0.25rem 0;
  }
</style>
