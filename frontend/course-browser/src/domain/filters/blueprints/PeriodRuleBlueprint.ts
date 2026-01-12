// src/domain/filters/blueprints/PeriodRuleBlueprint.ts
import type { AcademicPeriod } from '../../models/AcademicPeriod';
import { PeriodFilterRule, type PeriodRelation } from '../rules/PeriodFilterRule';
import type { BaseRuleBlueprint } from './BaseRuleBlueprint';

export class PeriodRuleBlueprint implements BaseRuleBlueprint {
  readonly builderType = 'period' as const;
  readonly field = 'coursePeriod';
  readonly label = 'Period';
  readonly validRelations = ['overlaps', 'isCompletelyBefore', 'isCompletelyAfter', 'equals'] as const;
  readonly defaultRelation = 'overlaps' as const;

  constructor(private periods: AcademicPeriod[]) {}

  createRule(relation: PeriodRelation, value: string | string[]): PeriodFilterRule {
    if (!this.isValidRelation(relation)) {
      throw new Error(`Invalid relation "${relation}" for field "${this.field}"`);
    }

    // Parse period IDs from value
    const periodIds = Array.isArray(value) 
      ? value 
      : typeof value === 'string' 
        ? value.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    if (periodIds.length === 0) {
      throw new Error('At least one period must be selected');
    }

    return new PeriodFilterRule({
      periodIds,
      periods: this.periods,
      relation
    });
  }

  isValidRelation(relation: string): boolean {
    return (this.validRelations as readonly string[]).includes(relation);
  }

  // Helper for UI to get available periods
  getAvailablePeriods(): AcademicPeriod[] {
    return this.periods;
  }
}