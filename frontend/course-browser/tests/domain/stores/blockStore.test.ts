// tests/domain/stores/blockStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { 
  blockStore, 
  blocksForInstance, 
  isModifyingBlock, 
  isLoadingInstance 
} from '../../../src/lib/stores/blockStore';
import { mockBlocksService } from '../../../src/infrastructure/services/BlockService.mock';

describe('blockStore Domain Logic', () => {
  const courseA = 'CS-101';
  const courseB = 'MATH-202';

  beforeEach(() => {
    mockBlocksService.reset();
    // Default to instant success for setup
    mockBlocksService.configure({ errorRate: 0, fetchDelayMs: 0, mutationDelayMs: 0 });
    blockStore.clear();
  });

  // --- 1. DATA INTEGRITY & SORTING ---
  describe('Data Management', () => {
    it('should maintain blocks sorted by the "order" property', async () => {
      // We create them out of order
      await blockStore.createBlock(courseA, 'Last', [], 10);
      await blockStore.createBlock(courseA, 'First', [], 1);
      await blockStore.createBlock(courseA, 'Middle', [], 5);

      const blocks = get(blocksForInstance(courseA));
      
      expect(blocks[0].label).toBe('First');
      expect(blocks[1].label).toBe('Middle');
      expect(blocks[2].label).toBe('Last');
    });

    it('should isolate blocks between different course instances', async () => {
      await blockStore.createBlock(courseA, 'Block A', [], 0);
      await blockStore.createBlock(courseB, 'Block B', [], 0);

      const blocksA = get(blocksForInstance(courseA));
      const blocksB = get(blocksForInstance(courseB));

      expect(blocksA).toHaveLength(1);
      expect(blocksB).toHaveLength(1);
      expect(blocksA[0].courseInstanceId).toBe(courseA);
      expect(blocksB[0].courseInstanceId).toBe(courseB);
    });

    it('should remove a block from cache when deleted', async () => {
      const b = await blockStore.createBlock(courseA, 'Delete Me', [], 0);
      await blockStore.deleteBlock(b.id);

      const cached = get(blocksForInstance(courseA));
      expect(cached).toHaveLength(0);
    });
  });

  // --- 2. PERFORMANCE & CACHING ---
  describe('Caching Strategy', () => {
    it('should use cache and skip loading state on subsequent fetches', async () => {
      // 1. Initial fetch to populate cache
      await blockStore.fetchForInstance(courseA);

      // 2. Slow down service to prove it's being skipped
      mockBlocksService.configure({ fetchDelayMs: 500 });
      
      const loading = isLoadingInstance(courseA);
      const promise = blockStore.fetchForInstance(courseA);
      
      // Should be false immediately because data is in cache
      expect(get(loading)).toBe(false); 
      await promise;
    });

    it('should re-fetch after cache invalidation', async () => {
      await blockStore.fetchForInstance(courseA);
      blockStore.invalidateInstance(courseA);

      mockBlocksService.configure({ fetchDelayMs: 20 });
      const promise = blockStore.fetchForInstance(courseA);
      
      // Now it should show loading because cache was cleared
      expect(get(isLoadingInstance(courseA))).toBe(true);
      await promise;
    });
  });

  // --- 3. REACTIVE UI STATES ---
  describe('UI Feedback States', () => {
    it('should track modification state for specific blocks', async () => {
      const b = await blockStore.createBlock(courseA, 'Old', [], 0);
      
      mockBlocksService.configure({ mutationDelayMs: 50 });
      const modifying = isModifyingBlock(b.id);

      const promise = blockStore.updateBlockLabel(b.id, 'New');
      expect(get(modifying)).toBe(true);
      
      await promise;
      expect(get(modifying)).toBe(false);
    });
  });

  // --- 4. ERROR RECOVERY ---
  describe('Error Flow', () => {
    it('should capture error and then clear it on next success', async () => {
      // 1. Trigger failure
      mockBlocksService.configure({ errorRate: 1.0 });
      try { await blockStore.createBlock(courseA, 'Fail', [], 0); } catch (e) {
        console.log(e);
      }
      
      expect(get(blockStore).error).toBe('Mock Service Error');

      // 2. Trigger success
      mockBlocksService.configure({ errorRate: 0 });
      await blockStore.fetchForInstance(courseA);
      
      expect(get(blockStore).error).toBeNull();
    });
  });
});