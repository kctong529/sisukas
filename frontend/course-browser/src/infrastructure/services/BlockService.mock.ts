// src/infrastructure/services/BlockService.mock.ts

import type { Block } from '../../domain/models/Block';
import type { StudyGroup } from '../../domain/models/StudyGroup';

interface UpdateBlockRequest {
  label?: string;
  studyGroupIds?: string[];
  order?: number;
}

interface MockConfig {
  fetchDelayMs?: number;
  mutationDelayMs?: number;
  errorRate?: number; // 0 to 1
}

/**
 * Auto-partition study groups by their type.
 * Returns blocks grouped as: Lecture | Exercise | Exam
 */
function autoPartitionByType(
  courseInstanceId: string,
  studyGroups: StudyGroup[]
): Block[] {
  const blocksByType = new Map<string, StudyGroup[]>();

  // Group study groups by type
  for (const group of studyGroups) {
    if (!blocksByType.has(group.type)) {
      blocksByType.set(group.type, []);
    }
    blocksByType.get(group.type)!.push(group);
  }

  // Create blocks in a logical order
  const typeOrder = ['Lecture', 'Exercise', 'Exam'];
  const blocks: Block[] = [];

  typeOrder.forEach((type, index) => {
    const groups = blocksByType.get(type);
    if (groups && groups.length > 0) {
      blocks.push({
        id: `block:${courseInstanceId}:${type}`,
        courseInstanceId,
        label: type,
        studyGroupIds: groups.map(g => g.groupId),
        order: index,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  });

  return blocks;
}

// ========== In-Memory Storage ==========

interface StoredBlock extends Block {
  courseInstanceId: string;
}

class MockBlockStorage {
  // courseInstanceId -> Block[]
  private blocksByInstance = new Map<string, StoredBlock[]>();

  // blockId -> Block (for quick lookup)
  private blockById = new Map<string, StoredBlock>();

  private nextBlockNumber = 1;

  /**
   * Get all blocks for an instance.
   */
  getBlocksForInstance(courseInstanceId: string): Block[] {
    return this.blocksByInstance.get(courseInstanceId) || [];
  }

  /**
   * Get a single block by ID.
   */
  getBlock(blockId: string): Block | null {
    return this.blockById.get(blockId) || null;
  }

  /**
   * Create a new block.
   */
  createBlock(
    courseInstanceId: string,
    label: string,
    studyGroupIds: string[],
    order: number
  ): Block {
    const id = `block:${courseInstanceId}:custom-${this.nextBlockNumber++}`;
    const now = new Date();

    const block: StoredBlock = {
      id,
      courseInstanceId,
      label,
      studyGroupIds,
      order,
      createdAt: now,
      updatedAt: now,
    };

    const blocks = this.blocksByInstance.get(courseInstanceId) || [];
    blocks.push(block);
    this.blocksByInstance.set(courseInstanceId, blocks);
    this.blockById.set(id, block);

    return block;
  }

  /**
   * Update a block.
   */
  updateBlock(blockId: string, updates: UpdateBlockRequest): Block | null {
    const block = this.blockById.get(blockId);
    if (!block) return null;

    const updated: StoredBlock = {
      ...block,
      ...updates,
      updatedAt: new Date(),
    };

    this.blockById.set(blockId, updated);

    // Update in instance blocks array
    const blocks = this.blocksByInstance.get(block.courseInstanceId);
    if (blocks) {
      const index = blocks.findIndex(b => b.id === blockId);
      if (index !== -1) {
        blocks[index] = updated;
      }
    }

    return updated;
  }

  /**
   * Delete a block.
   */
  deleteBlock(blockId: string): boolean {
    const block = this.blockById.get(blockId);
    if (!block) return false;

    this.blockById.delete(blockId);

    const blocks = this.blocksByInstance.get(block.courseInstanceId);
    if (blocks) {
      const index = blocks.findIndex(b => b.id === blockId);
      if (index !== -1) {
        blocks.splice(index, 1);
      }
    }

    return true;
  }

  /**
   * Auto-partition blocks for an instance from study groups.
   */
  autoPartitionByType(courseInstanceId: string, studyGroups: StudyGroup[]): Block[] {
    const blocks = autoPartitionByType(courseInstanceId, studyGroups) as StoredBlock[];

    // Clear old blocks for this instance
    const oldBlocks = this.blocksByInstance.get(courseInstanceId) || [];
    for (const block of oldBlocks) {
      this.blockById.delete(block.id);
    }

    // Store new blocks
    this.blocksByInstance.set(courseInstanceId, blocks);
    for (const block of blocks) {
      this.blockById.set(block.id, block);
    }

    return blocks;
  }

  /**
   * Clear all data.
   */
  clear() {
    this.blocksByInstance.clear();
    this.blockById.clear();
    this.nextBlockNumber = 1;
  }
}

// ========== Global Storage Instance ==========

const mockStorage = new MockBlockStorage();

// ========== Mock Service ==========

/**
 * Mock BlockService for development.
 * 
 * Provides in-memory block management with realistic delays.
 * No external dependencies - components pass study groups when needed.
 */
export class MockBlockService {
  private config: MockConfig = {
    fetchDelayMs: 0,
    mutationDelayMs: 0,
    errorRate: 0
  };

  constructor() {}

  configure(config: MockConfig) {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    mockStorage.clear();
  }

  private async simulate() {
    const delay = this.config.mutationDelayMs ?? 0;
    const errorRate = this.config.errorRate ?? 0;

    await new Promise(resolve => setTimeout(resolve, delay));

    if (Math.random() < errorRate) {
      throw new Error('Mock Service Error');
    }
  }

  // ========== Helper Methods ==========

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== Fetch Operations ==========

  async getBlocksForInstance(courseInstanceId: string): Promise<Block[]> {
    const delay = this.config.fetchDelayMs ?? 0;
    await new Promise(resolve => setTimeout(resolve, delay));
    const blocks = mockStorage.getBlocksForInstance(courseInstanceId);
    return blocks.map(b => ({ ...b })); // Clone
  }

  async getBlock(blockId: string): Promise<Block | null> {
    const delay = this.config.fetchDelayMs ?? 0;
    await new Promise(resolve => setTimeout(resolve, delay));
    const block = mockStorage.getBlock(blockId);
    return block ? { ...block } : null; // Clone
  }

  // ========== Create Operations ==========

  async createBlock(
    courseInstanceId: string,
    label: string,
    studyGroupIds: string[],
    order: number
  ): Promise<Block> {
    await this.simulate();
    const delay = this.config.mutationDelayMs ?? 0;
    await new Promise(resolve => setTimeout(resolve, delay));
    const block = mockStorage.createBlock(courseInstanceId, label, studyGroupIds, order);
    return { ...block }; // Clone
  }

  async autoPartitionByType(
    courseInstanceId: string,
    studyGroups: StudyGroup[]
  ): Promise<Block[]> {
    await this.simulate();
    const delay = this.config.mutationDelayMs ?? 0;
    await new Promise(resolve => setTimeout(resolve, delay));
    const blocks = mockStorage.autoPartitionByType(courseInstanceId, studyGroups);
    return blocks.map(b => ({ ...b })); // Clone
  }

  // ========== Update Operations ==========

  async updateBlock(blockId: string, updates: UpdateBlockRequest): Promise<Block> {
    await this.simulate();
    const delay = this.config.mutationDelayMs ?? 0;
    await new Promise(resolve => setTimeout(resolve, delay));
    const block = mockStorage.updateBlock(blockId, updates);
    if (!block) throw new Error(`Block ${blockId} not found`);
    return { ...block }; // Clone
  }

  async updateBlockLabel(blockId: string, label: string): Promise<Block> {
    await this.simulate();
    return this.updateBlock(blockId, { label });
  }

  async updateBlockStudyGroups(blockId: string, studyGroupIds: string[]): Promise<Block> {
    await this.simulate();
    return this.updateBlock(blockId, { studyGroupIds });
  }

  async updateBlockOrder(blockId: string, order: number): Promise<Block> {
    await this.simulate();
    return this.updateBlock(blockId, { order });
  }

  async reorderBlocks(updates: Array<{ blockId: string; order: number }>): Promise<Block[]> {
    await this.simulate();
    const delay = this.config.mutationDelayMs ?? 0;
    await new Promise(resolve => setTimeout(resolve, delay));
    const result: Block[] = [];
    for (const { blockId, order } of updates) {
      const block = mockStorage.updateBlock(blockId, { order });
      if (block) result.push({ ...block }); // Clone
    }
    return result;
  }

  // ========== Delete Operations ==========

  async deleteBlock(blockId: string): Promise<void> {
    await this.simulate();
    const delay = this.config.mutationDelayMs ?? 0;
    await new Promise(resolve => setTimeout(resolve, delay));
    const success = mockStorage.deleteBlock(blockId);
    if (!success) {
      throw new Error(`Block ${blockId} not found`);
    }
  }
}

// ========== Export Singleton Instance ==========

export const mockBlocksService = new MockBlockService();