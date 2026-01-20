// src/domain/models/Block.ts

export interface Block {
  id: string;
  courseInstanceId: string;
  label: string; // e.g. "Lecture", "Exercise H01", user-defined
  studyGroupIds: string[]; // The study groups that belong to this block
  order: number; // For sorting blocks within a course instance
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents the partitioning of study groups for a course instance.
 * Multiple blocks per course instance, each requiring exactly one selection.
 */
export type BlockPartition = Block[];