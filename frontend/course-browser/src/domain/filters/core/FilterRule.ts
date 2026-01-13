// src/domain/filters/core/FilterRule.ts

import type { DateRange } from '../../valueObjects/DateRange';
import type { NumericRange } from '../../valueObjects/NumericRange';
import type { SerializedDateRange } from '../helpers/FilterSerializer';

/**
 * Base interface for all filter rules.
 * A rule evaluates to true or false for a given entity.
 */
export interface FilterRule<TEntity> {
  evaluate(entity: TEntity): boolean;
  describe(): string;
  toJSON(): FilterRuleJSON;
}

/**
 * JSON representation of a filter rule for serialization
 */
export interface FilterRuleJSON {
  type: string;
  field: string;
  relation: string;
  value?: string | number | boolean | string[] | DateRange | SerializedDateRange | NumericRange | null;
}