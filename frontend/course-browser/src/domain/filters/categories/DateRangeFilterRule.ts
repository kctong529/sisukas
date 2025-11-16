// src/domain/filters/categories/DateRangeFilterRule.ts
import type { Course } from '../../models/Course';
import type { FilterRule, FilterRuleJSON } from '../core/FilterRule';
import type { DateRange } from '../../value-objects/DateRange';
import { overlaps, contains, equals } from '../../value-objects/DateRange';

export type DateRangeFieldSelector = (course: Course) => DateRange;

export type DateRangeRelation =
  | 'overlaps'      // ranges intersect
  | 'within'        // field range is completely inside value range
  | 'contains'      // field range completely contains value range
  | 'equals';       // ranges are identical

export interface DateRangeFilterRuleConfig {
  field: DateRangeFieldSelector;
  fieldName: string;
  relation: DateRangeRelation;
  value: DateRange;
}

export class DateRangeFilterRule implements FilterRule {
  constructor(private config: DateRangeFilterRuleConfig) {}

  evaluate(course: Course): boolean {
    const fieldValue = this.config.field(course);
    const compareValue = this.config.value;

    // Validate date ranges
    if (!this.isValidRange(fieldValue) || !this.isValidRange(compareValue)) {
      return false;
    }

    switch (this.config.relation) {
      case 'overlaps':
        return overlaps(fieldValue, compareValue);
      case 'within':
        return contains(compareValue, fieldValue);
      case 'contains':
        return contains(fieldValue, compareValue);
      case 'equals':
        return equals(fieldValue, compareValue);
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
    return `${this.config.fieldName} ${this.config.relation} [${this.config.value.start.toLocaleDateString()} - ${this.config.value.end.toLocaleDateString()}]`;
  }

  toJSON(): FilterRuleJSON {
    return {
      type: 'dateRange',
      field: this.config.fieldName,
      relation: this.config.relation,
      value: {
        start: this.config.value.start.toISOString(),
        end: this.config.value.end.toISOString(),
      },
    };
  }
}