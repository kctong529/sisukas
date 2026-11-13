import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';

import { mockBlocksService } from '@infrastructure/services/BlockService.mock';
import { BLOCK_PALETTE_SIZE } from '@lib/stores/blockPalette';
import { blockStore, previewColorForInstance } from '@lib/stores/blockStore';

const instanceId = 'palette-consistency-test';

describe('LEGO persisted and preview colors', () => {
  beforeEach(() => {
    mockBlocksService.reset();
    mockBlocksService.configure({ errorRate: 0, fetchDelayMs: 0, mutationDelayMs: 0 });
    blockStore.clear();
  });

  it('persists the seventh preview color without wrapping to the first', async () => {
    for (let index = 0; index < 6; index++) {
      await blockStore.createBlock(instanceId, `Block ${index}`, [`group-${index}`], index, index);
    }

    const { previewColorIndex } = await blockStore.beginDragSelect(instanceId);
    expect(previewColorIndex).toBe(6);
    expect(get(previewColorForInstance(instanceId))).toBe(6);

    const saved = await blockStore.createBlock(instanceId, 'Seventh', ['group-6'], 6, previewColorIndex);
    expect(saved.colorIndex).toBe(previewColorIndex);
    expect(saved.colorIndex).toBe(6);
  });

  it('supports all twelve palette slots before reusing a color', async () => {
    for (let index = 0; index < BLOCK_PALETTE_SIZE; index++) {
      const saved = await blockStore.createBlock(instanceId, `Block ${index}`, [`group-${index}`], index, index);
      expect(saved.colorIndex).toBe(index);
    }
    expect(get(previewColorForInstance(instanceId))).toBe(0);
  });
});
