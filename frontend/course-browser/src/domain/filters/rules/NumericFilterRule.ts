// src/domain/filters/rules/NumericFilterRule.ts
import type { Course } from '../../models/Course';
import type { FilterRule, FilterRuleJSON } from '../core/FilterRule';
import type { NumericRange } from '../../valueObjects/NumericRange';
import { includes } from '../../valueObjects/NumericRange';

export type NumericFieldSelector = (course: Course) => number;

export type NumericRelation =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between';

export interface NumericFilterRuleConfig {
  field: NumericFieldSelector;
  fieldName: string;
  relation: NumericRelation;
  value: number | NumericRange;
  epsilon?: number;
}

export class NumericFilterRule implements FilterRule<Course> {
  private readonly epsilon: number;

  constructor(private config: NumericFilterRuleConfig) {
    this.epsilon = config.epsilon ?? 1e-9;
  }

  evaluate(course: Course): boolean {
    const fieldValue = this.config.field(course);

    if (!Number.isFinite(fieldValue)) {
      return false;
    }

    switch (this.config.relation) {
      case 'equals':
        return Math.abs(fieldValue - (this.config.value as number)) < this.epsilon;
      case 'notEquals':
        return Math.abs(fieldValue - (this.config.value as number)) >= this.epsilon;
      case 'greaterThan':
        return fieldValue > (this.config.value as number);
      case 'greaterThanOrEqual':
        return fieldValue >= (this.config.value as number) ||
          Math.abs(fieldValue - (this.config.value as number)) < this.epsilon;
      case 'lessThan':
        return fieldValue < (this.config.value as number);
      case 'lessThanOrEqual':
        return fieldValue <= (this.config.value as number) ||
          Math.abs(fieldValue - (this.config.value as number)) < this.epsilon;
      case 'between': {
        const compareValue = this.config.value as NumericRange;
        return includes(compareValue, fieldValue);
      }
      default:
        throw new Error(`Unknown numeric relation: ${this.config.relation}`);
    }
  }

  describe(): string {
    if (this.config.relation === 'between') {
      const compareValue = this.config.value as NumericRange;
      return `${this.config.fieldName} between ${compareValue.min} and ${compareValue.max}`;
    }
    return `${this.config.fieldName} ${this.config.relation} ${this.config.value}`;
  }

  toJSON(): FilterRuleJSON {
    return {
      type: 'numeric',
      field: this.config.fieldName,
      relation: this.config.relation,
      value: this.config.value,
    };
  }
}