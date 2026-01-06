import type { NumericRangeRuleBlueprint } from "../blueprints/NumericRangeRuleBlueprintRegistry";
import type { NumericRangeRelation } from "../rules/NumericRangeFilterRule";
import type { FilterRuleBuilder } from "./FilterRuleBuilder";
import type { NumericRange } from '../../valueObjects/NumericRange';

export class NumericRangeRuleBuilder implements FilterRuleBuilder<NumericRangeRuleBlueprint> {
  relation: NumericRangeRelation | null = null;
  value: number | NumericRange | null = null;

  constructor(readonly blueprint: NumericRangeRuleBlueprint) {
    this.relation = blueprint.defaultRelation ?? null;
  }
  
  setRelation(r: NumericRangeRelation) {
    if (!this.blueprint.isValidRelation(r)) throw new Error("Invalid relation");
    this.relation = r;
    return this;
  }

  setValue(v: number | NumericRange) {
    this.value = v;
    return this;
  }

  isComplete(): boolean {
    if (this.value !== null) {
      if (typeof this.value === 'number') {
        return this.relation !== null;
      } else {
        return this.value.min !== null && this.relation !== null;
      }
    }
    return false;
  }

  build() {
    if (!this.isComplete()) throw new Error("Incomplete numeric range rule");
    return this.blueprint.createRule(this.relation!, this.value!);
  }
}
