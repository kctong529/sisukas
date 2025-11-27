import type { DateRange } from "../../value-objects/DateRange";
import type { DateRuleBlueprint } from "../blueprints/DateRuleBlueprints";
import type { DateRelation } from "../categories/DateFilterRule";
import type { FilterRuleBuilder } from "./FilterRuleBuilder";

export class DateRuleBuilder implements FilterRuleBuilder<DateRuleBlueprint> {
  relation: DateRelation | null = null;
  value: Date | DateRange | null = null;

  constructor(readonly blueprint: DateRuleBlueprint) {
    this.relation = blueprint.defaultRelation ?? null;
  }

  setRelation(r: DateRelation) {
    if (!this.blueprint.isValidRelation(r)) throw new Error("Invalid relation");
    this.relation = r;
    return this;
  }

  setValue(v: Date | DateRange) {
    this.value = v;
    return this;
  }

  isComplete(): boolean {
    return this.relation !== null && this.value !== null;
  }

  build() {
    if (!this.isComplete()) throw new Error("Incomplete date rule");
    return this.blueprint.createRule(this.relation!, this.value!);
  }
}
