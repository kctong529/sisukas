// src/domain/filters/categories/CategoricalFilterRule.ts
import type { FilterRule, FilterRuleJSON } from '../core/FilterRule';
import * as ArrayComp from '../../valueObjects/ArrayComparison';

export type CategoricalFieldSelector<T extends string, TEntity> = (entity: TEntity) => T | T[];

export type CategoricalRelation =
  // Single value relations
  | 'equals'
  | 'notEquals'
  | 'isOneOf'
  | 'isNotOneOf'
  // Array relations
  | 'includes'
  | 'notIncludes'
  | 'includesAny'
  | 'includesAll'
  | 'isEmpty'
  | 'isNotEmpty';

export interface CategoricalFilterRuleConfig<T extends string, TEntity> {
  field: CategoricalFieldSelector<T, TEntity>;
  fieldName: string;
  relation: CategoricalRelation;
  value?: T | T[];
  validValues?: T[];
  caseSensitive?: boolean;
  partial?: boolean;
}

export class CategoricalFilterRule<T extends string, TEntity> implements FilterRule<TEntity> {
  private static readonly ARRAY_RELATIONS: CategoricalRelation[] = [
    'includes', 'notIncludes', 'includesAny', 'includesAll', 'isEmpty', 'isNotEmpty'
  ];

  private static readonly SINGLE_VALUE_RELATIONS: CategoricalRelation[] = [
    'equals', 'notEquals', 'isOneOf', 'isNotOneOf'
  ];

  constructor(private config: CategoricalFilterRuleConfig<T, TEntity>) {
    // Only validate if validValues is provided AND not empty
    if (this.config.validValues && this.config.validValues.length > 0) {
      this.validateValues();
    }
  }

  private validateValues(): void {
    if (this.config.value === undefined) return;

    const values = Array.isArray(this.config.value) ? this.config.value : [this.config.value];
    const valid = this.config.validValues!;

    for (const val of values) {
      if (!valid.includes(val)) {
        throw new Error(`Invalid value "${val}" for field ${this.config.fieldName}. Valid values: ${valid.join(', ')}`);
      }
    }
  }

  private isArrayRelation(): boolean {
    return CategoricalFilterRule.ARRAY_RELATIONS.includes(this.config.relation);
  }

  private assertArrayField(fieldValue: T | T[]): asserts fieldValue is T[] {
    if (!Array.isArray(fieldValue)) {
      throw new Error(`Relation '${this.config.relation}' requires an array field`);
    }
  }

  private assertSingleValueField(fieldValue: T | T[]): asserts fieldValue is T {
    if (Array.isArray(fieldValue)) {
      throw new Error(`Relation '${this.config.relation}' cannot be used with array fields`);
    }
  }

  evaluate(entity: TEntity): boolean {
    const fieldValue = this.config.field(entity);
    const options = {
      caseSensitive: this.config.caseSensitive,
      partial: this.config.partial
    };

    // Array relations
    if (this.isArrayRelation()) {
      this.assertArrayField(fieldValue);

      switch (this.config.relation) {
        case 'includes':
          return ArrayComp.includes(fieldValue, this.config.value as T, options);
        case 'notIncludes':
          return ArrayComp.notIncludes(fieldValue, this.config.value as T, options);
        case 'includesAny': {
          const values = Array.isArray(this.config.value) ? this.config.value : [this.config.value];
          return ArrayComp.includesAny(fieldValue, values, options);
        }
        case 'includesAll': {
          const values = Array.isArray(this.config.value) ? this.config.value : [this.config.value];
          return ArrayComp.includesAll(fieldValue, values, options);
        }
        case 'isEmpty':
          return ArrayComp.isEmpty(fieldValue);
        case 'isNotEmpty':
          return ArrayComp.isNotEmpty(fieldValue);
      }
    }

    // Single value relations
    this.assertSingleValueField(fieldValue);

    switch (this.config.relation) {
      case 'equals':
        return fieldValue === this.config.value;
      case 'notEquals':
        return fieldValue !== this.config.value;
      case 'isOneOf': {
        const values = Array.isArray(this.config.value) ? this.config.value : [this.config.value];
        return values.includes(fieldValue);
      }
      case 'isNotOneOf': {
        const values = Array.isArray(this.config.value) ? this.config.value : [this.config.value];
        return !values.includes(fieldValue);
      }
      default:
        throw new Error(`Unknown categorical relation: ${this.config.relation}`);
    }
  }

  describe(): string {
    if (this.config.relation === 'isEmpty' || this.config.relation === 'isNotEmpty') {
      return `${this.config.fieldName} ${this.config.relation}`;
    }
    if (Array.isArray(this.config.value)) {
      return `${this.config.fieldName} ${this.config.relation} [${this.config.value.join(', ')}]`;
    }
    return `${this.config.fieldName} ${this.config.relation} ${this.config.value}`;
  }

  toJSON(): FilterRuleJSON {
    return {
      type: 'categorical',
      field: this.config.fieldName,
      relation: this.config.relation,
      value: this.config.value,
    };
  }
}
