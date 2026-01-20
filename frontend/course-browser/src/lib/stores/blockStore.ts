// src/lib/stores/blockStore.ts

import { writable, get, derived } from 'svelte/store';
import { blockService } from '../../infrastructure/services/BlockService';
import type { Block } from '../../domain/models/Block';
import type { StudyGroup } from '../../domain/models/StudyGroup';

// ========== Store State Types ==========

interface BlockStoreState {
  // Map of courseInstanceId -> Block[]
  blocksByCourseInstance: { [courseInstanceId: string]: Block[] };
  
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

  return {
    subscribe,

    // ========== Fetch Operations ==========

    /**
     * Fetch blocks for a course instance.
     * Results are cached.
     * 
     * @param courseInstanceId - The course instance to fetch blocks for
     * @returns Array of blocks for the instance
     */
    async fetchForInstance(courseInstanceId: string): Promise<Block[]> {
      // Check if already cached
      const state = get(store);
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

        update(state => {
          const nextLoading = new Set(state.loadingInstances);
          nextLoading.delete(courseInstanceId);

          return {
            ...state,
            loadingInstances: nextLoading,
            error: errorMessage,
          };
        });

        return [];
      }
    },

    /**
     * Check if a course instance is currently loading.
     */
    isLoadingInstance(courseInstanceId: string): boolean {
      return get(store).loadingInstances.has(courseInstanceId);
    },

    /**
     * Get cached blocks for an instance without fetching.
     * Returns null if not cached.
     */
    getCachedForInstance(courseInstanceId: string): Block[] | null {
      const blocks = get(store).blocksByCourseInstance[courseInstanceId];
      return blocks || null;
    },

    // ========== Create Operations ==========

    /**
     * Create a new block for a course instance.
     * Automatically updates the cache.
     * 
     * @param courseInstanceId - The course instance this block belongs to
     * @param label - User-friendly label
     * @param studyGroupIds - The study groups this block contains
     * @param order - Position in the ordering
     * @returns The created block
     */
    async createBlock(
      courseInstanceId: string,
      label: string,
      studyGroupIds: string[],
      order: number
    ): Promise<Block> {
      update(s => ({ ...s, error: null }));

      try {
        const newBlock = await blockService.createBlock(
          courseInstanceId,
          label,
          studyGroupIds,
          order
        );

        // Add to cache
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
      }
    },

    /**
     * Auto-partition study groups for a course instance by their type.
     * This generates the default Lecture / Exercise / Exam blocks.
     * 
     * @param courseInstanceId - The course instance to partition
     * @param studyGroups - The study groups to partition
     * @returns Array of auto-generated blocks
     */
    async autoPartitionByType(courseInstanceId: string, studyGroups: StudyGroup[]): Promise<Block[]> {
      update(s => ({
        ...s,
        loadingInstances: new Set([...s.loadingInstances, courseInstanceId]),
        error: null,
      }));

      try {
        const blocks = await blockService.autoPartitionByType(courseInstanceId, studyGroups);

        // Update cache with the new blocks
        update(state => ({
          ...state,
          blocksByCourseInstance: {
            ...state.blocksByCourseInstance,
            [courseInstanceId]: blocks,
          },
          loadingInstances: new Set(
            [...state.loadingInstances].filter(id => id !== courseInstanceId)
          ),
          error: null,
        }));

        return blocks;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to auto-partition';

        update(state => ({
          ...state,
          loadingInstances: new Set(
            [...state.loadingInstances].filter(id => id !== courseInstanceId)
          ),
          error: errorMsg,
        }));

        throw error;
      }
    },

    // ========== Update Operations ==========

    /**
     * Update a block's properties (label, study groups, or order).
     * 
     * @param blockId - The block to update
     * @param updates - Partial update object
     * @returns The updated block
     */
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

        // Find and update the block in cache
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

          const nextModifying = new Set(state.modifyingBlocks);
          nextModifying.delete(blockId);

          return {
            ...state,
            blocksByCourseInstance: nextBlocksByInstance,
            modifyingBlocks: nextModifying,
          };
        });

        return updated;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to update block';

        update(state => {
          const nextModifying = new Set(state.modifyingBlocks);
          nextModifying.delete(blockId);

          return {
            ...state,
            modifyingBlocks: nextModifying,
            error: errorMsg,
          };
        });

        throw error;
      }
    },

    /**
     * Update only a block's label.
     */
    async updateBlockLabel(blockId: string, label: string): Promise<Block> {
      return this.updateBlock(blockId, { label });
    },

    /**
     * Update only a block's study groups.
     */
    async updateBlockStudyGroups(blockId: string, studyGroupIds: string[]): Promise<Block> {
      return this.updateBlock(blockId, { studyGroupIds });
    },

    /**
     * Update only a block's order.
     */
    async updateBlockOrder(blockId: string, order: number): Promise<Block> {
      return this.updateBlock(blockId, { order });
    },

    /**
     * Reorder multiple blocks at once.
     * 
     * @param updates - Array of {blockId, order} updates
     * @returns Array of updated blocks
     */
    async reorderBlocks(updates: Array<{ blockId: string; order: number }>): Promise<Block[]> {
      const ids = updates.map(u => u.blockId);

      update(state => ({
        ...state,
        modifyingBlocks: new Set([...state.modifyingBlocks, ...ids]),
        error: null,
      }));

      try {
        const updatedBlocks = await blockService.reorderBlocks(updates);

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

    /**
     * Check if a block is currently being modified.
     */
    isModifying(blockId: string): boolean {
      return get(store).modifyingBlocks.has(blockId);
    },

    // ========== Delete Operations ==========

    /**
     * Delete a block by ID.
     * Automatically updates the cache.
     * 
     * @param blockId - The block to delete
     */
    async deleteBlock(blockId: string): Promise<void> {
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

          const nextModifying = new Set(state.modifyingBlocks);
          nextModifying.delete(blockId);

          return {
            ...state,
            blocksByCourseInstance: nextBlocksByInstance,
            modifyingBlocks: nextModifying,
          };
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to delete block';

        update(state => {
          const nextModifying = new Set(state.modifyingBlocks);
          nextModifying.delete(blockId);

          return {
            ...state,
            modifyingBlocks: nextModifying,
            error: errorMsg,
          };
        });

        throw error;
      }
    },

    // ========== Cache Management ==========

    /**
     * Invalidate the cache for a course instance.
     * The next fetch will reload from the service.
     */
    invalidateInstance(courseInstanceId: string): void {
      update(state => {
        const next = { ...state.blocksByCourseInstance };
        delete next[courseInstanceId];

        return {
          ...state,
          blocksByCourseInstance: next,
        };
      });
    },

    /**
     * Clear all cached data and reset to initial state.
     */
    clear(): void {
      set(createInitialState());
    },
  };
}

export const blockStore = createBlockStore();

// ========== Derived Stores ==========

/**
 * Derived store: get blocks for a specific course instance.
 * Returns empty array if not cached/loaded.
 */
export function blocksForInstance(courseInstanceId: string) {
  return derived(blockStore, state => state.blocksByCourseInstance[courseInstanceId] || []);
}

/**
 * Derived store: check if a course instance is loading.
 */
export function isLoadingInstance(courseInstanceId: string) {
  return derived(blockStore, state => state.loadingInstances.has(courseInstanceId));
}

/**
 * Derived store: check if a block is being modified.
 */
export function isModifyingBlock(blockId: string) {
  return derived(blockStore, state => state.modifyingBlocks.has(blockId));
}