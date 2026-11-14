import type { Course } from '../models/Course';
// src/domain/filters/types.ts
import type { FilterRule } from './core/FilterRule';

/**
 * Configuration for a single filter rule in the UI
 */
export interface FilterConfig {
  id: number;
  blueprintKey: string;
  relation: string;
  value: unknown;
  booleanOp: 'AND' | 'OR';
}

/**
 * A group of filter rules that are AND-ed together
 */
export type FilterRuleGroup = FilterRule<Course>[];

/**
 * Multiple filter groups that are OR-ed together
 * (OR between groups, AND within groups)
 */
export type FilterRuleGroups = FilterRuleGroup[];