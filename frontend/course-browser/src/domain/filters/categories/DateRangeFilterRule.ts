// src/domain/filters/categories/DateRangeFilterRule.ts
import type { Course } from '../../models/Course';
import type { FilterRule, FilterRuleJSON } from '../core/FilterRule';
import type { DateRange } from '../../value-objects/DateRange';
import { overlaps, contains, equals, containsDate } from '../../value-objects/DateRange';

export type DateRangeFieldSelector = (course: Course) => DateRange;

export type DateRangeRelation =
  | 'overlaps'      // ranges intersect
  | 'within'        // field range is completely inside value range
  | 'contains'      // field range completely contains value range
  | 'equals'        // ranges are identical
  | 'containsDate'; // field range contains a specific date

export interface DateRangeFilterRuleConfig {
  field: DateRangeFieldSelector;
  fieldName: string;
  relation: DateRangeRelation;
  value: DateRange | Date;
}

export class DateRangeFilterRule implements FilterRule<Course> {
  constructor(private config: DateRangeFilterRuleConfig) {}

  evaluate(course: Course): boolean {
    const fieldValue = this.config.field(course);
    const compareValue = this.config.value;

    // Validate field range
    if (!this.isValidRange(fieldValue)) {
      return false;
    }

    // Handle date comparison (single date vs range)
    if (this.config.relation === 'containsDate') {
      if (!(compareValue instanceof Date)) {
        return false;
      }
      return containsDate(fieldValue, compareValue);
    }

    // Handle range comparisons
    if (!(compareValue instanceof Date) && !this.isValidRange(compareValue)) {
      return false;
    }

    const compareRange = compareValue as DateRange;

    switch (this.config.relation) {
      case 'overlaps':
        return overlaps(fieldValue, compareRange);
      case 'within':
        return contains(compareRange, fieldValue);
      case 'contains':
        return contains(fieldValue, compareRange);
      case 'equals':
        return equals(fieldValue, compareRange);
      default:
        throw new Error(`Unknown date range relation: ${this.config.relation}`);
    }
  }

  private isValidRange(range: DateRange): boolean {
    return range.start instanceof Date &&
           range.end instanceof Date &&
           !isNaN(range.start.getTime()) &&
           !isNaN(range.end.getTime()) &&
           range.start <= range.end;
  }

  describe(): string {
    if (this.config.relation === 'containsDate' && this.config.value instanceof Date) {
      return `${this.config.fieldName} ${this.config.relation} ${this.config.value.toLocaleDateString()}`;
    }
    const value = this.config.value as DateRange;
    return `${this.config.fieldName} ${this.config.relation} [${value.start.toLocaleDateString()} - ${value.end.toLocaleDateString()}]`;
  }

  toJSON(): FilterRuleJSON {
    if (this.config.relation === 'containsDate' && this.config.value instanceof Date) {
      return {
        type: 'dateRange',
        field: this.config.fieldName,
        relation: this.config.relation,
        value: this.config.value.toISOString(),
      };
    }
    
    const value = this.config.value as DateRange;
    return {
      type: 'dateRange',
      field: this.config.fieldName,
      relation: this.config.relation,
      value: {
        start: value.start.toISOString(),
        end: value.end.toISOString(),
      },
    };
  }
}