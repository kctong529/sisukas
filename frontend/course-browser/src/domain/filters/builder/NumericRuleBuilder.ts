import type { NumericRuleBlueprint } from "../blueprints/NumericRuleBlueprints";
import type { NumericRelation } from "../categories/NumericFilterRule";
import type { FilterRuleBuilder } from "./FilterRuleBuilder";

export class NumericRuleBuilder implements FilterRuleBuilder<NumericRuleBlueprint> {
  relation: NumericRelation | null = null;
  value: number | null = null;

  constructor(readonly blueprint: NumericRuleBlueprint) {
    this.relation = blueprint.defaultRelation ?? null;
  }

  setRelation(r: NumericRelation) {
    if (!this.blueprint.isValidRelation(r)) throw new Error("Invalid relation");
    this.relation = r;
    return this;
  }

  setValue(v: number) {
    this.value = v;
    return this;
  }

  isComplete(): boolean {
    return this.relation !== null && this.value !== null;
  }

  build() {
    if (!this.isComplete()) throw new Error("Incomplete numeric rule");
    return this.blueprint.createRule(this.relation!, this.value!);
  }
}
