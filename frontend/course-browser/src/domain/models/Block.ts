// src/domain/models/Block.ts

import type { StudyGroup } from './StudyGroup';

/**
 * A Block is a predefined container of study group options for a course instance.
 * It serves as a single source of truth for mutually exclusive study groups.
 * 
 * The active/selected study group is determined elsewhere (e.g. in a SchedulePair model)
 * allowing multiple combinations to reference the same Block without modification.
 */
export interface Block {
  blockId: string;
  courseOfferingId: string;  // Lightweight reference to course instance
  studyGroups: StudyGroup[]; // All available study groups for this course (immutable reference data)
  createdAt: Date;
}