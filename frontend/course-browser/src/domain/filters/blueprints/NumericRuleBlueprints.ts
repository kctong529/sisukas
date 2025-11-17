// src/domain/filters/blueprints/NumericRuleBlueprints.ts
import type { Course } from '../../models/Course';
import type { NumericRange } from '../../value-objects/NumericRange';
import { NumericFilterRule, type NumericRelation, type NumericFilterRuleConfig } from '../categories/NumericFilterRule';

export abstract class NumericRuleBlueprint {
  readonly builderType = 'numeric' as const;

  abstract readonly field: string;
  abstract readonly label: string;
  abstract readonly validRelations: readonly NumericRelation[];
  abstract readonly selector: (course: Course) => number;

  readonly defaultRelation?: NumericRelation;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly epsilon?: number;

  createRule(relation: NumericRelation, value: number | NumericRange): NumericFilterRule {
    if (!this.isValidRelation(relation)) {
      throw new Error(`Invalid relation "${relation}" for field "${this.field}". Valid: ${this.validRelations.join(', ')}`);
    }

    if (relation === 'between' && !Array.isArray(value)) {
      throw new Error(`Relation "between" requires a range [min, max]`);
    }

    if (relation !== 'between' && Array.isArray(value)) {
      throw new Error(`Relation "${relation}" requires a single number value`);
    }

    const config: NumericFilterRuleConfig = {
      field: this.selector,
      fieldName: this.field,
      relation,
      value,
      epsilon: this.epsilon,
    };

    return new NumericFilterRule(config);
  }

  isValidRelation(relation: NumericRelation): boolean {
    return (this.validRelations as readonly string[]).includes(relation);
  }
}
