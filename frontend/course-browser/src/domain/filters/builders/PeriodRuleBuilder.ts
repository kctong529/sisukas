// src/domain/filters/builder/PeriodRuleBuilder.ts
import type { PeriodRuleBlueprint } from '../blueprints/PeriodRuleBlueprint';
import type { PeriodFilterRule, PeriodRelation } from '../rules/PeriodFilterRule';
import type { FilterRuleBuilder } from './FilterRuleBuilder';

export class PeriodRuleBuilder implements FilterRuleBuilder<PeriodRuleBlueprint, PeriodFilterRule> {
  readonly builderType = 'period' as const;
  
  private relation: PeriodRelation | null = null;
  private periodIds: string[] = [];

  constructor(readonly blueprint: PeriodRuleBlueprint) {
    this.relation = blueprint.defaultRelation ?? null;
  }

  setRelation(r: PeriodRelation) {
    if (!this.blueprint.isValidRelation(r)) throw new Error("Invalid relation");
    this.relation = r;
    return this;
  }

  setPeriodIds(ids: string | string[]) {
    this.periodIds = Array.isArray(ids) 
      ? ids 
      : typeof ids === 'string' 
        ? ids.split(',').map(s => s.trim()).filter(Boolean)
        : [];
    return this;
  }

  // Alias for compatibility with generic setValue
  setValue(value: string | string[]) {
    return this.setPeriodIds(value);
  }

  isComplete(): boolean {
    return this.relation !== null && this.periodIds.length > 0;
  }

  build() {
    if (!this.isComplete()) {
      throw new Error("Incomplete period rule");
    }
    return this.blueprint.createRule(this.relation!, this.periodIds);
  }
}