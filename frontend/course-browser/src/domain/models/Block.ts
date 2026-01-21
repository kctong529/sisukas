// src/domain/models/Block.ts

export interface Block {
  id: string;
  courseInstanceId: string;
  label: string;
  studyGroupIds: string[];
  order: number;
  colorIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents the partitioning of study groups for a course instance.
 * Multiple blocks per course instance, each requiring exactly one selection.
 */
export type BlockPartition = Block[];