// src/infrastructure/services/BlockService.mock.ts

import type { Block } from '../../domain/models/Block';
import type { StudyGroup } from '../../domain/models/StudyGroup';

// ========== Request/Response Types (from BlockService.ts) ==========

interface CreateBlockRequest {
  courseInstanceId: string;
  label: string;
  studyGroupIds: string[];
  order: number;
}

interface UpdateBlockRequest {
  label?: string;
  studyGroupIds?: string[];
  order?: number;
}

interface BlocksForInstanceResponse {
  courseInstanceId: string;
  blocks: Block[];
}

type CourseType = 'balanced' | 'lecture-heavy' | 'exercise-heavy';

function cloneBlock(b: Block): Block {
  return {
    ...b,
    studyGroupIds: [...b.studyGroupIds],
    // Dates are objects; cloning them prevents shared references
    createdAt: new Date(b.createdAt),
    updatedAt: new Date(b.updatedAt),
  };
}

function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map(cloneBlock);
}

// ========== Mock Data Generator ==========

/**
 * Generates realistic mock study groups for a course instance.
 * Groups by type following the default partition strategy.
 */
function generateMockStudyGroups(
  courseInstanceId: string,
  courseType: CourseType = 'balanced'
): StudyGroup[] {
  const groups: StudyGroup[] = [];

  // Lecture groups (1-2)
  if (courseType !== 'exercise-heavy') {
    groups.push({
      groupId: `${courseInstanceId}:L01`,
      name: 'Lecture 1',
      type: 'Lecture',
      studyEvents: [
        { start: '2025-01-13T10:00:00Z', end: '2025-01-13T12:00:00Z', location: undefined },
        { start: '2025-01-15T10:00:00Z', end: '2025-01-15T12:00:00Z', location: undefined },
      ],
    });

    if (courseType === 'balanced') {
      groups.push({
        groupId: `${courseInstanceId}:L02`,
        name: 'Lecture 1 (Swedish)',
        type: 'Lecture',
        studyEvents: [
          { start: '2025-01-14T10:00:00Z', end: '2025-01-14T12:00:00Z', location: undefined },
          { start: '2025-01-16T10:00:00Z', end: '2025-01-16T12:00:00Z', location: undefined },
        ],
      });
    }
  }

  // Exercise groups (2-4)
  const exerciseCount = courseType === 'lecture-heavy' ? 2 : courseType === 'exercise-heavy' ? 4 : 3;
  for (let i = 1; i <= exerciseCount; i++) {
    groups.push({
      groupId: `${courseInstanceId}:E${i.toString().padStart(2, '0')}`,
      name: `Exercise Group H${i.toString().padStart(2, '0')}`,
      type: 'Exercise',
      studyEvents: [
        {
          start: `2025-01-${13 + i}T14:00:00Z`,
          end: `2025-01-${13 + i}T16:00:00Z`,
          location: undefined,
        },
      ],
    });
  }

  // Exam group (1)
  groups.push({
    groupId: `${courseInstanceId}:EX01`,
    name: 'Exam',
    type: 'Exam',
    studyEvents: [{ start: '2025-01-22T09:00:00Z', end: '2025-01-22T12:00:00Z', location: undefined }],
  });

  return groups;
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

  // courseInstanceId -> StudyGroup[]
  private studyGroupsByInstance = new Map<string, StudyGroup[]>();

  // blockId -> Block (for quick lookup)
  private blockById = new Map<string, StoredBlock>();

  private nextBlockNumber = 1;

  constructor() {
    this.initializeSampleData();
  }

  /**
   * Initialize with sample course instances.
   */
  private initializeSampleData() {
    const sampleInstances = [
      { id: 'aalto-CUR-206050-3121830', name: 'CS-C2160', type: 'balanced' },
      { id: 'MATH-A1020:2025-autumn', name: 'MATH-A1020', type: 'lecture-heavy' },
      { id: 'PHYS-A1001:2025-autumn', name: 'PHYS-A1001', type: 'exercise-heavy' },
    ] as const;

    for (const instance of sampleInstances) {
      // Generate study groups
      const groups = generateMockStudyGroups(instance.id, instance.type);
      this.studyGroupsByInstance.set(instance.id, groups);

      // Auto-partition into blocks
      const blocks = autoPartitionByType(instance.id, groups);
      this.blocksByInstance.set(instance.id, blocks);

      // Index blocks by ID
      for (const block of blocks) {
        this.blockById.set(block.id, block);
      }
    }
  }

  /**
   * Get all blocks for an instance.
   * Auto-partitions blocks if they don't exist (handles dynamic test instances).
   */
  getBlocksForInstance(courseInstanceId: string): Block[] {
    let blocks = this.blocksByInstance.get(courseInstanceId);
    
    // If blocks already exist, return them
    if (blocks && blocks.length > 0) {
      return blocks;
    }
    
    // Otherwise, auto-generate blocks for this instance
    let groups = this.studyGroupsByInstance.get(courseInstanceId);
    
    if (!groups || groups.length === 0) {
      // No study groups - generate them
      groups = generateMockStudyGroups(courseInstanceId, 'balanced');
      this.studyGroupsByInstance.set(courseInstanceId, groups);
    }
    
    // Auto-partition study groups into blocks
    blocks = autoPartitionByType(courseInstanceId, groups);
    
    // Cache the blocks
    this.blocksByInstance.set(courseInstanceId, blocks);
    
    // Index blocks by ID
    for (const block of blocks) {
      this.blockById.set(block.id, block);
    }
    
    return blocks;
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

  setInstanceData(courseInstanceId: string, groups: StudyGroup[], blocks: Block[]) {
    this.studyGroupsByInstance.set(courseInstanceId, groups);

    // Clear old blocks for instance from index
    const oldBlocks = this.blocksByInstance.get(courseInstanceId) || [];
    for (const b of oldBlocks) this.blockById.delete(b.id);

    // Store blocks as-is
    this.blocksByInstance.set(courseInstanceId, blocks);
    for (const b of blocks) this.blockById.set(b.id, b as StoredBlock);
  }

  /**
   * Auto-partition blocks for an instance (regenerate from study groups).
   */
  autoPartitionByType(courseInstanceId: string): Block[] {
    let groups = this.studyGroupsByInstance.get(courseInstanceId);
    
    // Auto-generate study groups if missing
    if (!groups || groups.length === 0) {
      groups = generateMockStudyGroups(courseInstanceId, 'balanced');
      this.studyGroupsByInstance.set(courseInstanceId, groups);
    }

    const blocks = autoPartitionByType(courseInstanceId, groups);

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
   * Get all course instances with blocks.
   */
  getAllInstances(): string[] {
    return Array.from(this.blocksByInstance.keys());
  }

  /**
   * Clear all data (for testing).
   */
  clear() {
    this.blocksByInstance.clear();
    this.blockById.clear();
    this.studyGroupsByInstance.clear();
    this.nextBlockNumber = 1;
  }

  /**
   * Reset to sample data (for testing).
   */
  reset() {
    this.clear();
    this.initializeSampleData();
  }
}

// ========== Global Storage Instance ==========

const mockStorage = new MockBlockStorage();

// ========== Mock Service ==========

/**
 * Mock BlockService for development and testing.
 * 
 * Provides the same interface as BlockService but uses in-memory storage.
 * Includes configurable delays and error simulation for realistic testing.
 * 
 * Usage:
 * ```typescript
 * import { mockBlocksService as blockService } from '../../infrastructure/services/BlockService.mock';
 * // Use like the real BlockService
 * ```
 */
export class MockBlockService {
  // Configurable behavior for testing
  private fetchDelayMs = 300;
  private mutationDelayMs = 500;
  private errorRate = 0; // 0-1, probability of error
  private shouldFail = false;

  constructor() {
    // Default: realistic delays, no errors
  }

  /**
   * Configure delays and error behavior.
   */
  configure(options: {
    fetchDelayMs?: number;
    mutationDelayMs?: number;
    errorRate?: number;
  }): void {
    if (options.fetchDelayMs !== undefined) this.fetchDelayMs = options.fetchDelayMs;
    if (options.mutationDelayMs !== undefined) this.mutationDelayMs = options.mutationDelayMs;
    if (options.errorRate !== undefined) this.errorRate = Math.max(0, Math.min(1, options.errorRate));
  }

  /**
   * Force the next operation to fail (for testing error handling).
   */
  failNext(): void {
    this.shouldFail = true;
  }

  /**
   * Reset to default configuration and clear errors.
   */
  reset(): void {
    this.fetchDelayMs = 300;
    this.mutationDelayMs = 500;
    this.errorRate = 0;
    this.shouldFail = false;
    mockStorage.reset();
  }

  // ========== Helper Methods ==========

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shouldError(): boolean {
    if (this.shouldFail) {
      this.shouldFail = false;
      return true;
    }
    return Math.random() < this.errorRate;
  }

  private throwRandomError(context: string): never {
    const errors = [
      new Error(`Failed to ${context}: Network error`),
      new Error(`Failed to ${context}: Server error`),
      new Error(`Failed to ${context}: Invalid data`),
    ];
    throw errors[Math.floor(Math.random() * errors.length)];
  }

  // ========== Fetch Operations ==========

  async getBlocksForInstance(courseInstanceId: string): Promise<Block[]> {
    await this.delay(this.fetchDelayMs);

    if (this.shouldError()) {
      this.throwRandomError(`fetch blocks for ${courseInstanceId}`);
    }

    const blocks = mockStorage.getBlocksForInstance(courseInstanceId);
    return cloneBlocks(blocks);
  }

  async getBlock(blockId: string): Promise<Block | null> {
    await this.delay(this.fetchDelayMs);

    if (this.shouldError()) {
      this.throwRandomError(`fetch block ${blockId}`);
    }

    const b = mockStorage.getBlock(blockId);
    return b ? cloneBlock(b) : null;
  }

  // ========== Create Operations ==========

  async createBlock(
    courseInstanceId: string,
    label: string,
    studyGroupIds: string[],
    order: number
  ): Promise<Block> {
    await this.delay(this.mutationDelayMs);

    if (this.shouldError()) {
      this.throwRandomError('create block');
    }

    const block = mockStorage.createBlock(courseInstanceId, label, studyGroupIds, order);
    return cloneBlock(block);
  }

  async autoPartitionByType(courseInstanceId: string): Promise<Block[]> {
    await this.delay(this.mutationDelayMs);

    if (this.shouldError()) {
      this.throwRandomError(`auto-partition ${courseInstanceId}`);
    }

    const blocks = mockStorage.autoPartitionByType(courseInstanceId);
    return cloneBlocks(blocks);
  }

  // ========== Update Operations ==========

  async updateBlock(blockId: string, updates: UpdateBlockRequest): Promise<Block> {
    await this.delay(this.mutationDelayMs);

    if (this.shouldError()) {
      this.throwRandomError(`update block ${blockId}`);
    }

    const block = mockStorage.updateBlock(blockId, updates);
    if (!block) throw new Error(`Block ${blockId} not found`);

    return cloneBlock(block);
  }

  async updateBlockLabel(blockId: string, label: string): Promise<Block> {
    return this.updateBlock(blockId, { label });
  }

  async updateBlockStudyGroups(blockId: string, studyGroupIds: string[]): Promise<Block> {
    return this.updateBlock(blockId, { studyGroupIds });
  }

  async updateBlockOrder(blockId: string, order: number): Promise<Block> {
    return this.updateBlock(blockId, { order });
  }

  async reorderBlocks(updates: Array<{ blockId: string; order: number }>): Promise<Block[]> {
    await this.delay(this.mutationDelayMs);

    if (this.shouldError()) {
      this.throwRandomError('reorder blocks');
    }

    const result: Block[] = [];
    for (const { blockId, order } of updates) {
      const block = mockStorage.updateBlock(blockId, { order });
      if (block) result.push(block);
    }

    return cloneBlocks(result);
  }

  // ========== Delete Operations ==========

  async deleteBlock(blockId: string): Promise<void> {
    await this.delay(this.mutationDelayMs);

    if (this.shouldError()) {
      this.throwRandomError(`delete block ${blockId}`);
    }

    const success = mockStorage.deleteBlock(blockId);
    if (!success) {
      throw new Error(`Block ${blockId} not found`);
    }
  }

  // ========== Testing Utilities ==========

  /**
   * Get all course instances (for testing/debugging).
   */
  getInstancesForTesting(): string[] {
    return mockStorage.getAllInstances();
  }

  /**
   * Create a new test instance with auto-partitioned blocks.
   */
  createTestInstanceForTesting(
    courseInstanceId: string,
    courseType: CourseType = 'balanced'
  ): Block[] {
    const groups = generateMockStudyGroups(courseInstanceId, courseType);
    const blocks = autoPartitionByType(courseInstanceId, groups);

    // store blocks with their real IDs (Lecture/Exercise/Exam), not custom-*
    mockStorage.setInstanceData(courseInstanceId, groups, blocks);

    return blocks;
  }

  /**
   * Clear all data (for testing).
   */
  clearForTesting(): void {
    mockStorage.clear();
  }
}

// ========== Export Singleton Instance ==========

export const mockBlocksService = new MockBlockService();

// ========== Example Usage Comment ==========

/*
// In your app, use the mock service during development:

import { mockBlocksService as blockService } from '../../infrastructure/services/BlockService.mock';

// Configure for testing
blockService.configure({ fetchDelayMs: 100, mutationDelayMs: 200 });

// Or add error simulation
blockService.configure({ errorRate: 0.1 }); // 10% of operations fail

// Simulate a network error for the next operation
blockService.failNext();

// Use exactly like the real service
const blocks = await blockService.getBlocksForInstance('CS-A1110:2025-autumn');

// For testing: check what instances exist
const instances = blockService.getInstancesForTesting();

// Reset state between tests
blockService.reset();

// When ready to use the real service, just swap the import:
// import { blockService } from '../../infrastructure/services/BlockService';
*/