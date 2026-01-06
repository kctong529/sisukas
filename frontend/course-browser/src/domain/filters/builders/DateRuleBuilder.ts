import type { DateRange } from "../../valueObjects/DateRange";
import type { DateRuleBlueprint } from "../blueprints/DateRuleBlueprintRegistry";
import type { DateRelation } from "../rules/DateFilterRule";
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
    if (this.relation === null) {
      return false;
    }

    if (this.value === null || this.value === undefined) {
      return false;
    }

    if (!(this.value instanceof Date)) {
      return false;
    }
    
    return !isNaN(this.value.getTime());
  }

  build() {
    if (!this.isComplete()) throw new Error("Incomplete date rule");
    return this.blueprint.createRule(this.relation!, this.value!);
  }
}
