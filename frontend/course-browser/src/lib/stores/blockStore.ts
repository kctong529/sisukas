// src/lib/stores/blockStore.ts
//
// Fixes applied:
// 1) invalidateInstance(): delete cache entry (or set undefined), not []
//    because [] is truthy and would short-circuit fetch.
// 2) clear(): use update/set to replace state (don’t mutate inside subscribe).
// 3) fetchForInstance(): cache check must treat "not cached" vs "cached empty" properly.
//    (We use `hasOwnProperty` to distinguish.)
// 4) Small helper: getStateSnapshot() to avoid subscribe/unsubscribe boilerplate.

import { writable, get, derived } from 'svelte/store';
import { blockService } from '../../infrastructure/services/BlockService';
import type { Block } from '../../domain/models/Block';

interface BlockStoreState {
  // Map of courseInstanceId -> Block[]
  blocksByCourseInstance: Record<string, Block[]>;
  loadingInstances: Set<string>;
  modifyingBlocks: Set<string>;
  error: string | null;
}

function createInitialState(): BlockStoreState {
  return {
    blocksByCourseInstance: {},
    loadingInstances: new Set(),
    modifyingBlocks: new Set(),
    error: null,
  };
}

function hasCachedEntry(state: BlockStoreState, courseInstanceId: string): boolean {
  // Distinguish "not cached" (missing key) from "cached empty list" (key exists but [])
  return Object.prototype.hasOwnProperty.call(state.blocksByCourseInstance, courseInstanceId);
}

function createBlockStore() {
  const store = writable<BlockStoreState>(createInitialState());
  const { subscribe, update, set } = store;

  const getStateSnapshot = () => get(store);

  return {
    subscribe,

    // ========== Fetch Operations ==========

    async fetchForInstance(courseInstanceId: string): Promise<Block[]> {
      const state0 = getStateSnapshot();

      // If we have a cached entry (even if it is empty), return it.
      // (If you *want* empty to mean "no data / should refetch", then don't cache empty.)
      if (hasCachedEntry(state0, courseInstanceId)) {
        return state0.blocksByCourseInstance[courseInstanceId];
      }

      // Mark as loading
      update(state => ({
        ...state,
        loadingInstances: new Set([...state.loadingInstances, courseInstanceId]),
        error: null,
      }));

      try {
        const blocks = await blockService.getBlocksForInstance(courseInstanceId);

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

    isLoadingInstance(courseInstanceId: string): boolean {
      return getStateSnapshot().loadingInstances.has(courseInstanceId);
    },

    getCachedForInstance(courseInstanceId: string): Block[] | null {
      const state = getStateSnapshot();
      return hasCachedEntry(state, courseInstanceId)
        ? state.blocksByCourseInstance[courseInstanceId]
        : null;
    },

    // ========== Create Operations ==========

    async createBlock(
      courseInstanceId: string,
      label: string,
      studyGroupIds: string[],
      order: number
    ): Promise<Block> {
      update(s => ({ ...s, error: null }));

      try {
        const newBlock = await blockService.createBlock(courseInstanceId, label, studyGroupIds, order);

        update(state => {
          const existing = hasCachedEntry(state, courseInstanceId)
            ? state.blocksByCourseInstance[courseInstanceId]
            : [];

          const next = [...existing, newBlock].sort((a, b) => a.order - b.order);

          return {
            ...state,
            blocksByCourseInstance: {
              ...state.blocksByCourseInstance,
              [courseInstanceId]: next,
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

    async autoPartitionByType(courseInstanceId: string): Promise<Block[]> {
      update(s => ({
        ...s,
        loadingInstances: new Set([...s.loadingInstances, courseInstanceId]),
        error: null,
      }));

      try {
        const blocks = await blockService.autoPartitionByType(courseInstanceId);

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
        const errorMsg = error instanceof Error ? error.message : 'Failed to auto-partition';

        update(state => {
          const nextLoading = new Set(state.loadingInstances);
          nextLoading.delete(courseInstanceId);

          return {
            ...state,
            loadingInstances: nextLoading,
            error: errorMsg,
          };
        });

        throw error;
      }
    },

    // ========== Update Operations ==========

    async updateBlock(
      blockId: string,
      updatesObj: { label?: string; studyGroupIds?: string[]; order?: number }
    ): Promise<Block> {
      update(state => ({
        ...state,
        modifyingBlocks: new Set([...state.modifyingBlocks, blockId]),
        error: null,
      }));

      try {
        const updated = await blockService.updateBlock(blockId, updatesObj);

        update(state => {
          // update cached instance list if present
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

    async updateBlockLabel(blockId: string, label: string): Promise<Block> {
      return this.updateBlock(blockId, { label });
    },

    async updateBlockStudyGroups(blockId: string, studyGroupIds: string[]): Promise<Block> {
      return this.updateBlock(blockId, { studyGroupIds });
    },

    async updateBlockOrder(blockId: string, order: number): Promise<Block> {
      return this.updateBlock(blockId, { order });
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
      return getStateSnapshot().modifyingBlocks.has(blockId);
    },

    // ========== Delete Operations ==========

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

    invalidateInstance(courseInstanceId: string): void {
      // Fix: delete entry rather than setting it to []
      // so a subsequent fetch will actually refetch.
      update(state => {
        const next = { ...state.blocksByCourseInstance };
        delete next[courseInstanceId];

        return {
          ...state,
          blocksByCourseInstance: next,
        };
      });
    },

    clear(): void {
      // Fix: replace store state via set(), don't mutate via subscribe()
      set(createInitialState());
    },
  };
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
