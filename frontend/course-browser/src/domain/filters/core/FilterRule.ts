// src/domain/filters/core/FilterRule.ts
import type { Course } from '../../models/Course';

/**
 * Base interface for all filter rules.
 * A rule evaluates to true or false for a given course.
 */
export interface FilterRule {
  evaluate(course: Course): boolean;
  describe(): string;
  toJSON(): FilterRuleJSON;
}

export interface FilterRuleJSON {
  type: string;
  field: string;
  relation: string;
  value: any;
}