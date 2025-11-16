// src/domain/filters/categories/TextFilterRule.ts
import type { Course } from '../../models/Course';
import type { FilterRule, FilterRuleJSON } from '../core/FilterRule';

export type TextFieldSelector = (course: Course) => string;

export type TextRelation = 
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'matches'; // regex

export interface TextFilterRuleConfig {
  field: TextFieldSelector;
  fieldName: string;
  relation: TextRelation;
  value: string;
  caseSensitive?: boolean;
  trimWhitespace?: boolean;
}

export class TextFilterRule implements FilterRule {
  constructor(private config: TextFilterRuleConfig) {}

  evaluate(course: Course): boolean {
    let fieldValue = this.config.field(course);
    let compareValue = this.config.value;

    // Whitespace handling
    if (this.config.trimWhitespace !== false) {
      fieldValue = fieldValue.trim();
      compareValue = compareValue.trim();
    }

    // Case sensitivity
    if (!this.config.caseSensitive) {
      fieldValue = fieldValue.toLowerCase();
      compareValue = compareValue.toLowerCase();
    }

    switch (this.config.relation) {
      case 'equals':
        return fieldValue === compareValue;
      case 'notEquals':
        return fieldValue !== compareValue;
      case 'contains':
        return fieldValue.includes(compareValue);
      case 'notContains':
        return !fieldValue.includes(compareValue);
      case 'startsWith':
        return fieldValue.startsWith(compareValue);
      case 'endsWith':
        return fieldValue.endsWith(compareValue);
      case 'matches':
        return new RegExp(compareValue).test(fieldValue);
      default:
        throw new Error(`Unknown text relation: ${this.config.relation}`);
    }
  }

  describe(): string {
    return `${this.config.fieldName} ${this.config.relation} "${this.config.value}"`;
  }

  toJSON(): FilterRuleJSON {
    return {
      type: 'text',
      field: this.config.fieldName,
      relation: this.config.relation,
      value: this.config.value,
    };
  }
}