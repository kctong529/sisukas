// src/domain/filters/categories/DateFilterRule.ts
import type { Course } from '../../models/Course';
import type { FilterRule, FilterRuleJSON } from '../core/FilterRule';
import type { DateRange } from '../../value-objects/DateRange';
import { includes } from '../../value-objects/DateRange';

export type DateFieldSelector = (course: Course) => Date;

export type DateRelation =
  | 'before'
  | 'after'
  | 'onOrBefore'
  | 'onOrAfter'
  | 'equals'
  | 'between';

export interface DateFilterRuleConfig {
  field: DateFieldSelector;
  fieldName: string;
  relation: DateRelation;
  value: Date | DateRange;
  ignoreTime?: boolean;
}

export class DateFilterRule implements FilterRule {
  constructor(private config: DateFilterRuleConfig) { }

  private normalizeDate(date: Date): number {
    if (this.config.ignoreTime) {
      // Compare only date part (midnight UTC)
      return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    }
    return date.getTime();
  }

  evaluate(course: Course): boolean {
    const fieldValue = this.config.field(course);

    if (!(fieldValue instanceof Date) || isNaN(fieldValue.getTime())) {
      return false;
    }

    const fieldTime = this.normalizeDate(fieldValue);

    switch (this.config.relation) {
      case 'before': {
        const compareTime = this.normalizeDate(this.config.value as Date);
        return fieldTime < compareTime;
      }
      case 'after': {
        const compareTime = this.normalizeDate(this.config.value as Date);
        return fieldTime > compareTime;
      }
      case 'onOrBefore': {
        const compareTime = this.normalizeDate(this.config.value as Date);
        return fieldTime <= compareTime;
      }
      case 'onOrAfter': {
        const compareTime = this.normalizeDate(this.config.value as Date);
        return fieldTime >= compareTime;
      }
      case 'equals': {
        const compareTime = this.normalizeDate(this.config.value as Date);
        return fieldTime === compareTime;
      }
      case 'between': {
        const compareValue = this.config.value as DateRange;
        return includes(compareValue, fieldValue);
      }
      default:
        throw new Error(`Unknown date relation: ${this.config.relation}`);
    }
  }

  describe(): string {
    if (this.config.relation === 'between') {
      const compareValue = this.config.value as DateRange;
      return `${this.config.fieldName} between ${compareValue.start.toLocaleDateString()} and ${compareValue.end.toLocaleDateString()}`;
    }
    const value = this.config.value as Date;
    return `${this.config.fieldName} ${this.config.relation} ${value.toLocaleDateString()}`;
  }

  toJSON(): FilterRuleJSON {
    if (this.config.relation === 'between') {
      const compareValue = this.config.value as DateRange;
      return {
        type: 'date',
        field: this.config.fieldName,
        relation: this.config.relation,
        value: {
          start: compareValue.start.toISOString(),
          end: compareValue.end.toISOString(),
        },
      };
    } else {
      const compareValue = this.config.value as Date;
      return {
        type: 'date',
        field: this.config.fieldName,
        relation: this.config.relation,
        value: compareValue.toISOString(),
      };
    }
  }
}