// src/domain/models/Plan.ts

import type { Course } from './Course';
import type { Block } from './Block';

/**
 * A user's study plan containing courses and study group options (Blocks).
 * 
 * Structure:
 * - courses: List of all courses in the plan
 * - blocks: Containers of study group options (one block per course instance)
 * 
 * The blocks are reference data that multiple schedule combinations can use.
 * Selections (which group is active) are determined by the pairing algorithm
 * when evaluating different combinations for time compatibility.
 */
export interface Plan {
  planId: string;
  userId: string;
  name: string;
  description?: string;
  courses: Course[];      // All courses in this plan
  blocks: Block[];        // Study group options (one block per course instance, immutable reference data)
  createdAt: Date;
  updatedAt: Date;
}