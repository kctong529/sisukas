// tests/domain/stores/blockStore.test.ts
//
// Updated tests to match the fixed store semantics:
//
// Store fixes reflected here:
// - invalidateInstance() now deletes cache entry, so next fetch refetches
// - clear() now resets store properly (reactive)
// - fetchForInstance() now treats "cached entry exists" via hasOwnProperty
//
// Notes:
// - fetchForInstance() *catches* errors and returns [] (does not throw)
// - create/update/delete/reorder *rethrow* errors (store sets state.error then throws)
//   so tests assert rejection for those mutation paths.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  blockStore,
  blocksForInstance,
  isLoadingInstance,
  isModifyingBlock,
} from '../../../src/lib/stores/blockStore';
import { mockBlocksService } from '../../../src/infrastructure/services/BlockService.mock';
import type { Block } from '../../../src/domain/models/Block';

describe('blockStore', () => {
  beforeEach(() => {
    mockBlocksService.reset();
    mockBlocksService.configure({ errorRate: 0, fetchDelayMs: 50, mutationDelayMs: 100 });
    blockStore.clear();
  });

  afterEach(() => {
    mockBlocksService.reset();
  });

  // ========== Fetch Operations ==========

  describe('fetchForInstance', () => {
    it('should fetch blocks for a course instance', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      const blocks = await blockStore.fetchForInstance(instanceId);

      expect(blocks).toBeDefined();
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0].courseInstanceId).toBe(instanceId);
    });

    it('should cache blocks after fetching', async () => {
      const instanceId = 'CS-A1110:2025-autumn';

      const blocks1 = await blockStore.fetchForInstance(instanceId);
      const blocks2 = await blockStore.fetchForInstance(instanceId);

      expect(blocks1).toEqual(blocks2);
      expect(blockStore.getCachedForInstance(instanceId)).not.toBeNull();
    });

    it('should return cached blocks immediately on second fetch', async () => {
      const instanceId = 'CS-A1110:2025-autumn';

      mockBlocksService.configure({ fetchDelayMs: 200 });
      const t0 = Date.now();
      await blockStore.fetchForInstance(instanceId);
      const firstMs = Date.now() - t0;

      // Make service even slower; cached fetch should ignore it
      mockBlocksService.configure({ fetchDelayMs: 1000 });
      const t1 = Date.now();
      await blockStore.fetchForInstance(instanceId);
      const cachedMs = Date.now() - t1;

      expect(cachedMs).toBeLessThan(firstMs);
    });

    it('should set loading state while fetching', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      mockBlocksService.configure({ fetchDelayMs: 200 });

      const loadingStore = isLoadingInstance(instanceId);
      const seen: boolean[] = [];
      const unsub = loadingStore.subscribe(v => seen.push(v));

      const p = blockStore.fetchForInstance(instanceId);

      expect(get(loadingStore)).toBe(true);

      await p;

      expect(get(loadingStore)).toBe(false);
      unsub();

      expect(seen).toContain(true);
      expect(seen[seen.length - 1]).toBe(false);
    });

    it('should handle fetch errors gracefully (returns [] and sets state.error)', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      mockBlocksService.configure({ errorRate: 1.0 });

      const blocks = await blockStore.fetchForInstance(instanceId);

      expect(blocks).toEqual([]);
      const state = get(blockStore);
      expect(state.error).toBeTruthy();
      expect(state.loadingInstances.has(instanceId)).toBe(false);

      mockBlocksService.configure({ errorRate: 0 });
    });

    it('should clear loading state on error', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      mockBlocksService.configure({ errorRate: 1.0, fetchDelayMs: 200 });

      const loadingStore = isLoadingInstance(instanceId);
      const p = blockStore.fetchForInstance(instanceId);

      expect(get(loadingStore)).toBe(true);

      await p;

      expect(get(loadingStore)).toBe(false);
      mockBlocksService.configure({ errorRate: 0 });
    });
  });

  describe('getCachedForInstance', () => {
    it('should return null for uncached instance', () => {
      expect(blockStore.getCachedForInstance('non-existent:instance')).toBeNull();
    });

    it('should return cached blocks after fetch', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      await blockStore.fetchForInstance(instanceId);

      const cached = blockStore.getCachedForInstance(instanceId);
      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(3); // Lecture, Exercise, Exam in mock
    });
  });

  // ========== Create Operations ==========

  describe('createBlock', () => {
    it('should create a new block', async () => {
      const instanceId = 'CS-A1110:2025-autumn';

      const newBlock = await blockStore.createBlock(
        instanceId,
        'Custom Session',
        ['group-1', 'group-2'],
        0
      );

      expect(newBlock.label).toBe('Custom Session');
      expect(newBlock.studyGroupIds).toEqual(['group-1', 'group-2']);
      expect(newBlock.courseInstanceId).toBe(instanceId);
    });

    it('should add created block to cache', async () => {
      const instanceId = 'CS-A1110:2025-autumn';

      await blockStore.fetchForInstance(instanceId);
      const before = get(blocksForInstance(instanceId)).length; // 3

      await blockStore.createBlock(instanceId, 'New Block', ['group-1'], before);

      const after = get(blocksForInstance(instanceId));
      expect(after.length).toBe(before + 1);
      expect(after.some(b => b.label === 'New Block')).toBe(true);
    });

    it('should throw on creation error and store error message', async () => {
      mockBlocksService.configure({ errorRate: 1.0 });

      await expect(
        blockStore.createBlock('CS-A1110:2025-autumn', 'Test Block', [], 0)
      ).rejects.toBeTruthy();

      const state = get(blockStore);
      expect(state.error).toBeTruthy();

      mockBlocksService.configure({ errorRate: 0 });
    });
  });

  describe('autoPartitionByType', () => {
    it('should auto-partition study groups by type', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      const blocks = await blockStore.autoPartitionByType(instanceId);

      expect(blocks.some(b => b.label === 'Lecture')).toBe(true);
      expect(blocks.some(b => b.label === 'Exercise')).toBe(true);
      expect(blocks.some(b => b.label === 'Exam')).toBe(true);
    });

    it('should update cache with auto-partitioned blocks', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      const blocks = await blockStore.autoPartitionByType(instanceId);

      const cached = get(blocksForInstance(instanceId));
      expect(cached).toEqual(blocks);
    });
  });

  // ========== Update Operations ==========

  describe('updateBlock', () => {
    it('should update a block label and cache', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      await blockStore.fetchForInstance(instanceId);

      const blocks = get(blocksForInstance(instanceId));
      const blockId = blocks[0].id;

      const updated = await blockStore.updateBlockLabel(blockId, 'New Label');
      expect(updated.label).toBe('New Label');

      const cachedAfter = get(blocksForInstance(instanceId));
      expect(cachedAfter.find(b => b.id === blockId)?.label).toBe('New Label');
    });

    it('should set and clear modifying state during update', async () => {
      mockBlocksService.configure({ mutationDelayMs: 200 });

      const instanceId = 'CS-A1110:2025-autumn';
      const blocks = await blockStore.fetchForInstance(instanceId);
      const blockId = blocks[0].id;

      const modifyingStore = isModifyingBlock(blockId);

      const p = blockStore.updateBlockLabel(blockId, 'New');
      expect(get(modifyingStore)).toBe(true);

      await p;
      expect(get(modifyingStore)).toBe(false);
    });

    it('should throw on update error and clear modifying state', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      const blocks = await blockStore.fetchForInstance(instanceId);
      const blockId = blocks[0].id;

      mockBlocksService.configure({ errorRate: 1.0 });

      await expect(blockStore.updateBlockLabel(blockId, 'Nope')).rejects.toBeTruthy();

      expect(blockStore.isModifying(blockId)).toBe(false);
      expect(get(blockStore).error).toBeTruthy();

      mockBlocksService.configure({ errorRate: 0 });
    });
  });

  describe('reorderBlocks', () => {
    it('should reorder multiple blocks and update cache', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      const blocks = await blockStore.fetchForInstance(instanceId);

      const updates = [
        { blockId: blocks[0].id, order: 2 },
        { blockId: blocks[1].id, order: 0 },
        { blockId: blocks[2].id, order: 1 },
      ];

      await blockStore.reorderBlocks(updates);

      const cached = get(blocksForInstance(instanceId));
      expect(cached[0].order).toBe(0);
      expect(cached[1].order).toBe(1);
      expect(cached[2].order).toBe(2);
    });

    it('should throw on reorder error and clear modifying state', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      const blocks = await blockStore.fetchForInstance(instanceId);

      mockBlocksService.configure({ errorRate: 1.0 });

      await expect(
        blockStore.reorderBlocks(blocks.map((b, i) => ({ blockId: b.id, order: i })))
      ).rejects.toBeTruthy();

      // none of the ids should remain modifying
      for (const b of blocks) expect(blockStore.isModifying(b.id)).toBe(false);
      expect(get(blockStore).error).toBeTruthy();

      mockBlocksService.configure({ errorRate: 0 });
    });
  });

  // ========== Delete Operations ==========

  describe('deleteBlock', () => {
    it('should delete a block and remove from cache', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      const blocks = await blockStore.fetchForInstance(instanceId);
      const blockId = blocks[0].id;

      await blockStore.deleteBlock(blockId);

      const cached = get(blocksForInstance(instanceId));
      expect(cached.find(b => b.id === blockId)).toBeUndefined();
      expect(cached.length).toBe(blocks.length - 1);
    });

    it('should set and clear modifying state during deletion', async () => {
      mockBlocksService.configure({ mutationDelayMs: 200 });

      const instanceId = 'CS-A1110:2025-autumn';
      const blocks = await blockStore.fetchForInstance(instanceId);
      const blockId = blocks[0].id;

      const modifyingStore = isModifyingBlock(blockId);

      const p = blockStore.deleteBlock(blockId);
      expect(get(modifyingStore)).toBe(true);

      await p;
      expect(get(modifyingStore)).toBe(false);
    });

    it('should throw on deletion error and clear modifying state', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      const blocks = await blockStore.fetchForInstance(instanceId);
      const blockId = blocks[0].id;

      mockBlocksService.configure({ errorRate: 1.0 });

      await expect(blockStore.deleteBlock(blockId)).rejects.toBeTruthy();

      expect(blockStore.isModifying(blockId)).toBe(false);
      expect(get(blockStore).error).toBeTruthy();

      mockBlocksService.configure({ errorRate: 0 });
    });
  });

  // ========== Derived Stores ==========

  describe('blocksForInstance (derived)', () => {
    it('should provide reactive blocks for instance', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      const store = blocksForInstance(instanceId);

      const snapshots: Block[][] = [];
      const unsub = store.subscribe(v => snapshots.push([...v]));

      await blockStore.fetchForInstance(instanceId);

      unsub();

      expect(snapshots.length).toBeGreaterThanOrEqual(1);
      expect(snapshots[snapshots.length - 1].length).toBeGreaterThan(0);
    });

    it('should update when blocks are modified', async () => {
      const instanceId = 'CS-A1110:2025-autumn';
      const store = blocksForInstance(instanceId);

      const snapshots: Block[][] = [];
      const unsub = store.subscribe(v => snapshots.push([...v]));

      await blockStore.fetchForInstance(instanceId);
      const initial = snapshots[snapshots.length - 1];
      expect(initial).toHaveLength(3);

      await blockStore.createBlock(instanceId, 'New', [], 10);

      unsub();

      const final = snapshots[snapshots.length - 1];
      expect(final.length).toBeGreaterThan(initial.length);
    });
  });

  // ========== Cache Management ==========

  describe('invalidateInstance', () => {
    it('should delete cache entry so next fetch refetches', async () => {
      const instanceId = 'CS-A1110:2025-autumn';

      // First fetch populates cache
      await blockStore.fetchForInstance(instanceId);
      expect(blockStore.getCachedForInstance(instanceId)).not.toBeNull();

      // Invalidate removes cache entry
      blockStore.invalidateInstance(instanceId);
      expect(blockStore.getCachedForInstance(instanceId)).toBeNull();

      // Next fetch should refetch (i.e. store will cache again)
      await blockStore.fetchForInstance(instanceId);
      expect(blockStore.getCachedForInstance(instanceId)).not.toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all cached blocks (reactively)', async () => {
      await blockStore.fetchForInstance('CS-A1110:2025-autumn');
      await blockStore.fetchForInstance('MATH-A1020:2025-autumn');

      blockStore.clear();

      const state = get(blockStore);
      expect(Object.keys(state.blocksByCourseInstance)).toHaveLength(0);
      expect(state.loadingInstances.size).toBe(0);
      expect(state.modifyingBlocks.size).toBe(0);
      expect(state.error).toBeNull();
    });
  });

  // ========== Error Clearing ==========

  describe('error handling', () => {
    it('should clear error on successful operation', async () => {
      // Make fetch error
      mockBlocksService.configure({ errorRate: 1.0 });
      await blockStore.fetchForInstance('CS-A1110:2025-autumn');

      expect(get(blockStore).error).toBeTruthy();

      // Successful operation clears error
      mockBlocksService.configure({ errorRate: 0 });
      await blockStore.fetchForInstance('MATH-A1020:2025-autumn');

      expect(get(blockStore).error).toBeNull();
    });
  });
});
