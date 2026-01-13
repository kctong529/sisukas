// src/domain/filters/core/FilterRule.ts
<<<<<<< HEAD

import type { DateRange } from '../../valueObjects/DateRange';
import type { NumericRange } from '../../valueObjects/NumericRange';
import type { SerializedDateRange } from '../helpers/FilterSerializer';
=======
import type { Course } from '../../models/Course';
>>>>>>> main

/**
 * Base interface for all filter rules.
 * A rule evaluates to true or false for a given entity.
 */
export interface FilterRule<TEntity> {
  evaluate(entity: TEntity): boolean;
  describe(): string;
  toJSON(): FilterRuleJSON;
}

<<<<<<< HEAD
/**
 * JSON representation of a filter rule for serialization
 */
=======
>>>>>>> main
export interface FilterRuleJSON {
  type: string;
  field: string;
  relation: string;
<<<<<<< HEAD
  value?: string | number | boolean | string[] | DateRange | SerializedDateRange | NumericRange | null;
=======
  value: any;
>>>>>>> main
}