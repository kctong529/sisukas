// src/domain/filters/categories/NumericRangeFilterRule.ts
import type { Course } from '../../models/Course';
import type { FilterRule, FilterRuleJSON } from '../core/FilterRule';
import type { NumericRange } from '../../value-objects/NumericRange';
import {
  containsNumber,
  isWithinRange,
  overlaps,
  contains,
  equals,
  minAtLeast,
  minAtMost,
  minEquals,
  maxAtLeast,
  maxAtMost,
  maxEquals,
  spanAtLeast,
  spanAtMost,
  spanEquals
} from '../../value-objects/NumericRange';

export type NumericRangeFieldSelector = (course: Course) => NumericRange;

export type NumericRangeRelation =
  // Range vs Range operations
  | 'overlaps'        // field range intersects with value range
  | 'within'          // field range is completely inside value range
  | 'contains'        // field range completely contains value range
  | 'equals'          // field range is identical to value range
  // Range vs Number operations
  | 'containsNumber'  // field range contains a specific number
  | 'includes'        // alias for containsNumber
  // Range boundary checks
  | 'minAtLeast'      // field.min >= value
  | 'minAtMost'       // field.min <= value
  | 'minEquals'       // field.min == value
  | 'maxAtLeast'      // field.max >= value (or unbounded)
  | 'maxAtMost'       // field.max <= value
  | 'maxEquals'       // field.max == value
  // Range span checks
  | 'spanAtLeast'     // (field.max - field.min) >= value
  | 'spanAtMost'      // (field.max - field.min) <= value
  | 'spanEquals';     // (field.max - field.min) === value

export interface NumericRangeFilterRuleConfig {
  field: NumericRangeFieldSelector;
  fieldName: string;
  relation: NumericRangeRelation;
  value: NumericRange | number;
}

export class NumericRangeFilterRule implements FilterRule<Course> {
  constructor(private config: NumericRangeFilterRuleConfig) { }

  evaluate(course: Course): boolean {
    const fieldValue = this.config.field(course);

    // Validate field range
    if (!this.isValidRange(fieldValue)) {
      return false;
    }

    switch (this.config.relation) {
      // Range vs Range operations
      case 'overlaps':
      case 'within':
      case 'contains':
      case 'equals': {
        const compareValue = this.config.value as NumericRange;
        if (!this.isValidRange(compareValue)) {
          return false;
        }

        if (this.config.relation === 'overlaps') {
          return overlaps(fieldValue, compareValue);
        }
        if (this.config.relation === 'within') {
          return isWithinRange(fieldValue, compareValue);
        }
        if (this.config.relation === 'contains') {
          return contains(fieldValue, compareValue);
        }
        return equals(fieldValue, compareValue);
      }

      // Range vs Number operations
      case 'containsNumber':
      case 'includes':
        return containsNumber(fieldValue, this.config.value as number);

      // Range boundary checks
      case 'minAtLeast':
        return minAtLeast(fieldValue, this.config.value as number);
      case 'minAtMost':
        return minAtMost(fieldValue, this.config.value as number);
      case 'minEquals':
        return minEquals(fieldValue, this.config.value as number);
      case 'maxAtLeast':
        return maxAtLeast(fieldValue, this.config.value as number);
      case 'maxAtMost':
        return maxAtMost(fieldValue, this.config.value as number);
      case 'maxEquals':
        return maxEquals(fieldValue, this.config.value as number);

      // Range span checks
      case 'spanAtLeast':
        return spanAtLeast(fieldValue, this.config.value as number);
      case 'spanAtMost':
        return spanAtMost(fieldValue, this.config.value as number);
      case 'spanEquals':
        return spanEquals(fieldValue, this.config.value as number);

      default:
        throw new Error(`Unknown numeric range relation: ${this.config.relation}`);
    }
  }

  private isValidRange(range: NumericRange): boolean {
    if (!Number.isFinite(range.min)) {
      return false;
    }

    if (range.max !== undefined) {
      if (!Number.isFinite(range.max)) {
        return false;
      }
      if (range.min > range.max) {
        return false;
      }
    }

    return true;
  }

  describe(): string {
    if (
      this.config.relation === 'overlaps' ||
      this.config.relation === 'within' ||
      this.config.relation === 'contains' ||
      this.config.relation === 'equals'
    ) {
      const range = this.config.value as NumericRange;
      const minStr = `${range.min}`;
      const maxStr = range.max !== undefined ? `${range.max}` : '∞';
      return `${this.config.fieldName} ${this.config.relation} [${minStr}, ${maxStr}]`;
    }

    return `${this.config.fieldName} ${this.config.relation} ${this.config.value}`;
  }

  toJSON(): FilterRuleJSON {
    return {
      type: 'numericRange',
      field: this.config.fieldName,
      relation: this.config.relation,
      value: this.config.value,
    };
  }
}