import type { NumericRange } from "../../valueObjects/NumericRange";
import type { NumericRuleBlueprint } from "../blueprints/NumericRuleBlueprintRegistry";
import type { NumericRelation } from "../rules/NumericFilterRule";
import type { FilterRuleBuilder } from "./FilterRuleBuilder";

export class NumericRuleBuilder implements FilterRuleBuilder<NumericRuleBlueprint> {
  relation: NumericRelation | null = null;
  value: number | NumericRange | null = null;

  constructor(readonly blueprint: NumericRuleBlueprint) {
    this.relation = blueprint.defaultRelation ?? null;
  }

  setRelation(r: NumericRelation) {
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
    if (!this.isComplete()) throw new Error("Incomplete numeric rule");
    return this.blueprint.createRule(this.relation!, this.value!);
  }
}
