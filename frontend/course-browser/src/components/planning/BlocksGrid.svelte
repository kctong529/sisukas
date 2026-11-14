<!-- src/components/planning/BlocksGrid.svelte -->
<script lang="ts">
  import { onDestroy, tick } from "svelte";

  import { getStudyGroupDataRuntime } from "@modules/study-groups";

  import { blockStore, previewColorForInstance } from "../../lib/stores/blockStore";

  import type { Block } from "@domain/models/Block";
  import type { Course } from "@domain/models/Course";
  import type { StudyGroupEntry, StudyGroupRequest } from "@modules/study-groups";

  type Props = {
    course: Course;
  };

  let { course }: Props = $props();

  const runtime = getStudyGroupDataRuntime();
  const missingEntry: StudyGroupEntry = {
    groups: null,
    status: "missing",
    fetchedAt: null,
    error: null,
    refreshing: false,
  };
  const offeringKey = $derived(JSON.stringify([course.unitId, course.id]));
  let studyGroupEntry = $state<StudyGroupEntry>(missingEntry);
  const studyGroups = $derived(studyGroupEntry.groups ?? []);

  // Observe the authoritative entry without triggering retrieval.
  $effect(() => {
    const [courseUnitId, courseOfferingId] = JSON.parse(offeringKey) as [string, string];
    const request: StudyGroupRequest = { courseUnitId, courseOfferingId };
    studyGroupEntry = missingEntry;
    return runtime.entry(request).subscribe((value) => {
      studyGroupEntry = value;
    });
  });

  let unsubscribeBlocks: (() => void) | null = null;
  let unsubscribePreview: (() => void) | null = null;

  const autoPartitionDoneFor = new Set<string>();

  // LEGO explicitly needs full study groups (including historical offerings).
  // The runtime owns request deduplication; block retrieval is independent.
  $effect(() => {
    const [courseUnitId, courseOfferingId] = JSON.parse(offeringKey) as [string, string];
    const request: StudyGroupRequest = { courseUnitId, courseOfferingId };
    void runtime.ensure([request]).catch(() => {
      // The entry publishes the failure for the UI and retry action.
    });
    void blockStore.fetchForInstance(courseOfferingId);
  });

  function retryStudyGroups(): void {
    const [courseUnitId, courseOfferingId] = JSON.parse(offeringKey) as [string, string];
    void runtime.ensure([{ courseUnitId, courseOfferingId }]).catch(() => {
      // Failure remains observable through the entry.
    });
  }

  // Auto-partition once when groups exist
  $effect(() => {
    if (!course) return;
    if (autoPartitionDoneFor.has(course.id)) return;
    if (studyGroupEntry.groups === null || studyGroups.length === 0) return;

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
  const keyboardPending = new Set<string>();

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

    // CLICK (no drag): share the persisted toggle with keyboard activation.
    if (!hasDragged) {
      endSelection(true);
      await toggleSingleGroup(firstId);
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

  async function toggleSingleGroup(groupId: string) {
    if (!course) return;
    const removed = await blockStore.removeBlockIfGroupIsAssigned(course.id, groupId);
    committingIds = [];
    if (removed) return;

    committingIds = [groupId];
    try {
      await createBlockFromSelection([groupId]);
    } catch (err) {
      console.error("Failed to create block:", err);
    } finally {
      await clearCommitBridgeAfterPaint();
    }
  }

  async function handleGroupKeyDown(groupId: string, event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); // Space must not scroll the page.
    if (!course || isSelecting || keyboardPending.has(groupId)) return;

    keyboardPending.add(groupId);
    try {
      await blockStore.beginDragSelect(course.id);
      await toggleSingleGroup(groupId);
    } catch (err) {
      console.error("Failed to toggle study group:", err);
    } finally {
      keyboardPending.delete(groupId);
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
    {#if studyGroupEntry.groups !== null}
      <div class="empty">No study groups available</div>
    {:else if studyGroupEntry.status === "failed"}
      <div class="empty" role="alert">Unable to load study groups.</div>
      <button type="button" class="ui-button ui-button--secondary retry-button" onclick={retryStudyGroups}>Retry</button>
    {:else if studyGroupEntry.status === "loading" || studyGroupEntry.status === "queued"}
      <div class="loading" role="status">Loading study groups...</div>
    {:else}
      <div class="loading">Study groups not loaded yet.</div>
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
            onkeydown={(e) => handleGroupKeyDown(group.groupId, e)}
            ontouchstart={(e) => handleTouchStart(idx, group.groupId, e)}
            ontouchmove={handleTouchMove}
            ontouchend={handleTouchEnd}
            ontouchcancel={handleTouchCancel}
            role="button"
            aria-pressed={groupColorIndexById[group.groupId] !== undefined}
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
    --c6: 13, 148, 136;
    --c7: 79, 70, 229;
    --c8: 190, 24, 93;
    --c9: 101, 163, 13;
    --c10: 180, 83, 9;
    --c11: 8, 145, 178;

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
  .study-group-square[data-color="6"] { --rgb: var(--c6); }
  .study-group-square[data-color="7"] { --rgb: var(--c7); }
  .study-group-square[data-color="8"] { --rgb: var(--c8); }
  .study-group-square[data-color="9"] { --rgb: var(--c9); }
  .study-group-square[data-color="10"] { --rgb: var(--c10); }
  .study-group-square[data-color="11"] { --rgb: var(--c11); }

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

  .study-group-square:focus-visible {
    outline: 2px solid var(--ui-focus, #2f7fd6);
    outline-offset: 2px;
  }

  .study-group-square.in-block {
    background: color-mix(in srgb, rgb(var(--rgb)) 14%, white) !important;
    border-color: rgb(var(--rgb)) !important;
    color: color-mix(in srgb, rgb(var(--rgb)) 60%, black) !important;
  }

  /* Temporary selection previews use the same treatment as persisted blocks. */
  .study-group-square.selected:not(.in-block),
  .study-group-square.commit-preview {
    background: color-mix(in srgb, rgb(var(--next-rgb)) 14%, white) !important;
    border-color: rgb(var(--next-rgb)) !important;
    color: color-mix(in srgb, rgb(var(--next-rgb)) 60%, black) !important;
  }

  @media (hover: hover) and (pointer: fine) {
    .study-group-square:hover,
    .squares-container.dragging .study-group-square:hover {
      background: color-mix(in srgb, rgb(var(--next-rgb)) 14%, white) !important;
      border-color: rgb(var(--next-rgb)) !important;
      color: color-mix(in srgb, rgb(var(--next-rgb)) 60%, black) !important;
    }

    .squares-container:not(.dragging) .study-group-square.in-block:hover {
      background: color-mix(in srgb, rgb(var(--rgb)) 14%, white) !important;
      border-color: rgb(var(--rgb)) !important;
      color: color-mix(in srgb, rgb(var(--rgb)) 60%, black) !important;
    }
  }

  .squares-container.dragging .study-group-square.selected {
    background: color-mix(in srgb, rgb(var(--next-rgb)) 14%, white) !important;
    border-color: rgb(var(--next-rgb)) !important;
    color: color-mix(in srgb, rgb(var(--next-rgb)) 60%, black) !important;
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

  .retry-button {
    align-self: center;
  }

  .empty,
  .loading {
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.25rem 0;
    text-align: center;
  }

  .empty {
    font-style: italic;
  }
</style>
