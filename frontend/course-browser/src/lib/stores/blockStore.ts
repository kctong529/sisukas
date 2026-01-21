// src/lib/stores/blockStore.ts

import { writable, get, derived } from 'svelte/store';
import { blockService } from '../../infrastructure/services/BlockService';
import type { Block } from '../../domain/models/Block';
import type { StudyGroup } from '../../domain/models/StudyGroup';
  import { colorAllocator, colorAllocatorVersion } from './colorAllocator';

// ========== Store State Types ==========

interface BlockStoreState {
  // Map of courseInstanceId -> Block[]
  blocksByCourseInstance: Record<string, Block[]>;

  // Set of courseInstanceId's currently loading
  loadingInstances: Set<string>;

  // Set of blockId's currently being modified
  modifyingBlocks: Set<string>;

  error: string | null;
}

// ========== Initial State Factory ==========

function createInitialState(): BlockStoreState {
  return {
    blocksByCourseInstance: {},
    loadingInstances: new Set(),
    modifyingBlocks: new Set(),
    error: null,
  };
}

// ========== Store Creation ==========

function createBlockStore() {
  const store = writable<BlockStoreState>(createInitialState());
  const { subscribe, update, set } = store;

  // ---------- Helpers (private) ----------

  function findBlockContainingStudyGroup(blocks: Block[], studyGroupId: string): Block | null {
    for (const b of blocks) {
      if (b.studyGroupIds.includes(studyGroupId)) return b;
    }
    return null;
  }

  function findCourseInstanceIdForBlock(blockId: string): string | null {
    const state = get(store);
    for (const [courseInstanceId, blocks] of Object.entries(state.blocksByCourseInstance)) {
      if (blocks.some(b => b.id === blockId)) return courseInstanceId;
    }
    return null;
  }

  function findBlocksIntersectingStudyGroups(blocks: Block[], studyGroupIds: string[]): Block[] {
    const selected = new Set(studyGroupIds);
    return blocks.filter(b => b.studyGroupIds.some(gid => selected.has(gid)));
  }

  async function ensureStudyGroupsUnassigned(courseInstanceId: string, studyGroupIds: string[]) {
    const state = get(store);
    const blocks = state.blocksByCourseInstance[courseInstanceId] || [];
    const intersecting = findBlocksIntersectingStudyGroups(blocks, studyGroupIds);

    if (intersecting.length === 0) return;

    // Delete each overlapping block once
    const ids = Array.from(new Set(intersecting.map(b => b.id)));
    for (const id of ids) {
      await api.deleteBlock(id);
    }
  }

  function removeLoading(courseInstanceId: string) {
    return (state: BlockStoreState): BlockStoreState => {
      const nextLoading = new Set(state.loadingInstances);
      nextLoading.delete(courseInstanceId);
      return { ...state, loadingInstances: nextLoading };
    };
  }

  function removeModifying(blockId: string) {
    return (state: BlockStoreState): BlockStoreState => {
      const next = new Set(state.modifyingBlocks);
      next.delete(blockId);
      return { ...state, modifyingBlocks: next };
    };
  }

  // ---------- Public API ----------

  const api = {
    subscribe,

    // ===== Drag-select entrypoint (invariant + preview color) =====

    /**
     * Start a drag-select gesture.
     * Enforces invariant: a study group may belong to at most one block.
     * If the touched group is already in a block, that block is deleted first.
     *
     * Returns a reserved preview color index for the upcoming selection.
     */
    async beginDragSelect(courseInstanceId: string): Promise<{ previewColorIndex: number }> {
      // Always clear any stale reservation first
      colorAllocator.clearReservation(courseInstanceId);

      // Ensure we have blocks
      if (!get(store).blocksByCourseInstance[courseInstanceId]) {
        await api.fetchForInstance(courseInstanceId);
      }

      const blocksNow = get(store).blocksByCourseInstance[courseInstanceId] || [];
      const previewColorIndex = colorAllocator.reserve(courseInstanceId, blocksNow);
      return { previewColorIndex };
    },

    // ===== Fetch Operations =====

    async fetchForInstance(courseInstanceId: string): Promise<Block[]> {
      const state = get(store);

      // Cached
      if (state.blocksByCourseInstance[courseInstanceId]) {
        return state.blocksByCourseInstance[courseInstanceId];
      }

      // Mark as loading
      update(s => ({
        ...s,
        loadingInstances: new Set([...s.loadingInstances, courseInstanceId]),
        error: null,
      }));

      try {
        const blocks = await blockService.getBlocksForInstance(courseInstanceId);

        // Cache the blocks
        update(state => {
          const nextLoading = new Set(state.loadingInstances);
          nextLoading.delete(courseInstanceId);

          return {
            ...state,
            blocksByCourseInstance: {
              ...state.blocksByCourseInstance,
              [courseInstanceId]: blocks,
            },
            loadingInstances: nextLoading,
            error: null,
          };
        });

        return blocks;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch blocks';

        update(state => ({
          ...removeLoading(courseInstanceId)(state),
          error: errorMessage,
        }));

        return [];
      }
    },

    isLoadingInstance(courseInstanceId: string): boolean {
      return get(store).loadingInstances.has(courseInstanceId);
    },

    getCachedForInstance(courseInstanceId: string): Block[] | null {
      return get(store).blocksByCourseInstance[courseInstanceId] || null;
    },

    // ===== Create Operations =====

    /**
     * Create a new block for a course instance.
     * NOTE: colorIndex must be provided (stable block color).
     */
    async createBlock(
      courseInstanceId: string,
      label: string,
      studyGroupIds: string[],
      order: number,
      colorIndex: number
    ): Promise<Block> {
      update(s => ({ ...s, error: null }));

      try {
        await ensureStudyGroupsUnassigned(courseInstanceId, studyGroupIds);
        const newBlock = await blockService.createBlock(
          courseInstanceId,
          label,
          studyGroupIds,
          order,
          colorIndex
        );

        update(state => {
          const existing = state.blocksByCourseInstance[courseInstanceId] || [];
          return {
            ...state,
            blocksByCourseInstance: {
              ...state.blocksByCourseInstance,
              [courseInstanceId]: [...existing, newBlock].sort((a, b) => a.order - b.order),
            },
          };
        });

        return newBlock;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to create block';
        update(s => ({ ...s, error: errorMsg }));
        throw error;
      } finally {
        colorAllocator.clearReservation(courseInstanceId);
      }
    },

    async autoPartitionByType(courseInstanceId: string, studyGroups: StudyGroup[]): Promise<Block[]> {
      update(s => ({
        ...s,
        loadingInstances: new Set([...s.loadingInstances, courseInstanceId]),
        error: null,
      }));

      try {
        const blocks = await blockService.autoPartitionByType(courseInstanceId, studyGroups);

        update(state => ({
          ...removeLoading(courseInstanceId)(state),
          blocksByCourseInstance: {
            ...state.blocksByCourseInstance,
            [courseInstanceId]: blocks,
          },
          error: null,
        }));

        return blocks;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to auto-partition';

        update(state => ({
          ...removeLoading(courseInstanceId)(state),
          error: errorMsg,
        }));

        throw error;
      } finally {
        colorAllocator.clearReservation(courseInstanceId);
      }
    },

    // ===== Update Operations =====

    async updateBlock(
      blockId: string,
      updates: { label?: string; studyGroupIds?: string[]; order?: number }
    ): Promise<Block> {
      update(state => ({
        ...state,
        modifyingBlocks: new Set([...state.modifyingBlocks, blockId]),
        error: null,
      }));

      try {
        const updated = await blockService.updateBlock(blockId, updates);

        update(state => {
          let nextBlocksByInstance = state.blocksByCourseInstance;

          for (const [courseInstanceId, blocks] of Object.entries(state.blocksByCourseInstance)) {
            const idx = blocks.findIndex(b => b.id === blockId);
            if (idx !== -1) {
              const newBlocks = [...blocks];
              newBlocks[idx] = updated;
              newBlocks.sort((a, b) => a.order - b.order);

              nextBlocksByInstance = {
                ...nextBlocksByInstance,
                [courseInstanceId]: newBlocks,
              };
              break;
            }
          }

          return {
            ...removeModifying(blockId)(state),
            blocksByCourseInstance: nextBlocksByInstance,
          };
        });

        return updated;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to update block';

        update(state => ({
          ...removeModifying(blockId)(state),
          error: errorMsg,
        }));

        throw error;
      }
    },

    updateBlockLabel(blockId: string, label: string): Promise<Block> {
      return api.updateBlock(blockId, { label });
    },

    updateBlockStudyGroups(blockId: string, studyGroupIds: string[]): Promise<Block> {
      return api.updateBlock(blockId, { studyGroupIds });
    },

    updateBlockOrder(blockId: string, order: number): Promise<Block> {
      return api.updateBlock(blockId, { order });
    },

    async reorderBlocks(updatesArr: Array<{ blockId: string; order: number }>): Promise<Block[]> {
      const ids = updatesArr.map(u => u.blockId);

      update(state => ({
        ...state,
        modifyingBlocks: new Set([...state.modifyingBlocks, ...ids]),
        error: null,
      }));

      try {
        const updatedBlocks = await blockService.reorderBlocks(updatesArr);

        update(state => {
          const updatedMap = new Map(updatedBlocks.map(b => [b.id, b]));
          const idSet = new Set(ids);

          let nextBlocksByInstance = state.blocksByCourseInstance;

          for (const [courseInstanceId, blocks] of Object.entries(state.blocksByCourseInstance)) {
            if (!blocks.some(b => idSet.has(b.id))) continue;

            const next = blocks
              .map(b => updatedMap.get(b.id) ?? b)
              .sort((a, b) => a.order - b.order);

            nextBlocksByInstance = {
              ...nextBlocksByInstance,
              [courseInstanceId]: next,
            };
          }

          const nextModifying = new Set(state.modifyingBlocks);
          for (const id of ids) nextModifying.delete(id);

          return {
            ...state,
            blocksByCourseInstance: nextBlocksByInstance,
            modifyingBlocks: nextModifying,
          };
        });

        return updatedBlocks;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to reorder blocks';

        update(state => {
          const nextModifying = new Set(state.modifyingBlocks);
          for (const id of ids) nextModifying.delete(id);

          return {
            ...state,
            modifyingBlocks: nextModifying,
            error: errorMsg,
          };
        });

        throw error;
      }
    },

    isModifying(blockId: string): boolean {
      return get(store).modifyingBlocks.has(blockId);
    },

    // ===== Delete Operations =====

    async deleteBlock(blockId: string): Promise<void> {
      const instanceId = findCourseInstanceIdForBlock(blockId);

      update(state => ({
        ...state,
        modifyingBlocks: new Set([...state.modifyingBlocks, blockId]),
        error: null,
      }));

      try {
        await blockService.deleteBlock(blockId);

        update(state => {
          let nextBlocksByInstance = state.blocksByCourseInstance;

          for (const [courseInstanceId, blocks] of Object.entries(state.blocksByCourseInstance)) {
            const filtered = blocks.filter(b => b.id !== blockId);
            if (filtered.length !== blocks.length) {
              nextBlocksByInstance = {
                ...nextBlocksByInstance,
                [courseInstanceId]: filtered,
              };
            }
          }

          return {
            ...removeModifying(blockId)(state),
            blocksByCourseInstance: nextBlocksByInstance,
          };
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to delete block';

        update(state => ({
          ...removeModifying(blockId)(state),
          error: errorMsg,
        }));

        throw error;
      } finally {
        if (instanceId) colorAllocator.clearReservation(instanceId);
      }
    },

    async removeBlockIfGroupIsAssigned(courseInstanceId: string, studyGroupId: string): Promise<boolean> {
      // Ensure blocks loaded
      if (!get(store).blocksByCourseInstance[courseInstanceId]) {
        await api.fetchForInstance(courseInstanceId);
      }

      const state = get(store);
      const blocks = state.blocksByCourseInstance[courseInstanceId] || [];
      const existing = findBlockContainingStudyGroup(blocks, studyGroupId);
      if (!existing) return false;

      await api.deleteBlock(existing.id);
      return true;
    },

    // ===== Cache Management =====

    invalidateInstance(courseInstanceId: string): void {
      update(state => {
        const next = { ...state.blocksByCourseInstance };
        delete next[courseInstanceId];
        return { ...state, blocksByCourseInstance: next };
      });
    },

    clear(): void {
      set(createInitialState());
    },
  };

  return api;
}

export const blockStore = createBlockStore();

// ========== Derived Stores ==========

export function blocksForInstance(courseInstanceId: string) {
  return derived(blockStore, state => state.blocksByCourseInstance[courseInstanceId] || []);
}

export function isLoadingInstance(courseInstanceId: string) {
  return derived(blockStore, state => state.loadingInstances.has(courseInstanceId));
}

export function isModifyingBlock(blockId: string) {
  return derived(blockStore, state => state.modifyingBlocks.has(blockId));
}

export function previewColorForInstance(courseInstanceId: string) {
  return derived([blockStore, colorAllocatorVersion], ([state]) => {
    const blocks = state.blocksByCourseInstance[courseInstanceId] || [];
    return colorAllocator.peek(courseInstanceId, blocks);
  });
}