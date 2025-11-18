// src/domain/filters/blueprints/NumericRangeRuleBlueprints.ts
import type { Course } from '../../models/Course';
import type { NumericRange } from '../../value-objects/NumericRange';
import { NumericRangeFilterRule, type NumericRangeRelation, type NumericRangeFilterRuleConfig } from '../categories/NumericRangeFilterRule';
import type { BaseRuleBlueprint } from './BaseRuleBlueprint';

export abstract class NumericRangeRuleBlueprint implements BaseRuleBlueprint {
  readonly builderType = 'numericRange' as const;

  abstract readonly field: string;
  abstract readonly label: string;
  abstract readonly validRelations: readonly NumericRangeRelation[];
  abstract readonly selector: (course: Course) => NumericRange;
  
  readonly defaultRelation?: NumericRangeRelation;

  createRule(relation: NumericRangeRelation, value: NumericRange | number): NumericRangeFilterRule {
    if (!this.isValidRelation(relation)) {
      throw new Error(`Invalid relation "${relation}" for field "${this.field}". Valid: ${this.validRelations.join(', ')}`);
    }

    // Validate value type based on relation category
    const rangeRelations: NumericRangeRelation[] = ['overlaps', 'within', 'contains', 'equals'];
    const numberRelations: NumericRangeRelation[] = [
      'containsNumber', 'includes',
      'minAtLeast', 'minAtMost', 'minEquals', 'maxAtLeast', 'maxAtMost', 'maxEquals',
      'spanAtLeast', 'spanAtMost', 'spanEquals'
    ];
    
    if (rangeRelations.includes(relation)) {
      if (typeof value === 'number') {
        throw new Error(`Relation "${relation}" requires a NumericRange value (e.g. { min: 5, max: 10 })`);
      }
      if (!this.isValidRangeValue(value as NumericRange)) {
        throw new Error(`Invalid NumericRange value for relation "${relation}"`);
      }
    }

    if (numberRelations.includes(relation)) {
      if (typeof value !== 'number') {
        throw new Error(`Relation "${relation}" requires a number value`);
      }
      if (!Number.isFinite(value)) {
        throw new Error(`Relation "${relation}" requires a finite number value`);
      }
    }

    const config: NumericRangeFilterRuleConfig = {
      field: this.selector,
      fieldName: this.field,
      relation,
      value,
    };

    return new NumericRangeFilterRule(config);
  }

  isValidRelation(relation: NumericRangeRelation): boolean {
    return (this.validRelations as readonly string[]).includes(relation);
  }

  private isValidRangeValue(range: NumericRange): boolean {
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
}

export class CreditsRangeRuleBlueprint extends NumericRangeRuleBlueprint {
  readonly field = 'credits';
  readonly label = 'Credits';
  readonly validRelations = ['includes', 'minEquals'] as const;
  readonly defaultRelation = 'includes' as const;
  readonly selector = (c: Course) => c.credits;
}
