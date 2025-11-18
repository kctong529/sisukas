import type { DateRangeRuleBlueprint } from "../blueprints/DateRangeRuleBlueprints";
import type { DateRangeRelation } from "../categories/DateRangeFilterRule";
import type { FilterRuleBuilder } from "./FilterRuleBuilder";
import type { DateRange } from '../../value-objects/DateRange';

export class DateRangeRuleBuilder implements FilterRuleBuilder<DateRangeRuleBlueprint> {
  relation: DateRangeRelation | null = null;
  value: DateRange | null = null;

  constructor(readonly blueprint: DateRangeRuleBlueprint) {
    this.relation = blueprint.defaultRelation ?? null;
  }
    
  setRelation(r: DateRangeRelation) {
    if (!this.blueprint.isValidRelation(r)) throw new Error("Invalid relation");
    this.relation = r;
    return this;
  }

  setValue(v: DateRange) {
    this.value = v;
    return this;
  }

  isComplete(): boolean {
    if (this.value !== null) {
      return this.relation !== null;
    }
    return false;
  }

  build() {
    if (!this.isComplete()) throw new Error("Incomplete date range filter");
    return this.blueprint.createRule(this.relation!, this.value!);
  }
}
