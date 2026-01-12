// src/domain/filters/builder/DateRangeRuleBuilder.ts
import type { DateRangeRuleBlueprint } from "../blueprints/DateRangeRuleBlueprintRegistry";
import type { DateRangeRelation } from "../rules/DateRangeFilterRule";
import type { FilterRuleBuilder } from "./FilterRuleBuilder";
import type { DateRange } from '../../valueObjects/DateRange';

export class DateRangeRuleBuilder implements FilterRuleBuilder<DateRangeRuleBlueprint> {
  relation: DateRangeRelation | null = null;
  value: DateRange | Date | null = null;

  constructor(readonly blueprint: DateRangeRuleBlueprint) {
    this.relation = blueprint.defaultRelation ?? null;
  }
    
  setRelation(r: DateRangeRelation) {
    if (!this.blueprint.isValidRelation(r)) throw new Error("Invalid relation");
    this.relation = r;
    return this;
  }

  setValue(v: DateRange | Date) {
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

    // For containsDate relation, validate single Date
    if (this.relation === 'containsDate') {
      if (!(this.value instanceof Date)) {
        return false;
      }
      // Check if date is valid (not NaN)
      return !isNaN(this.value.getTime());
    }

    // For other relations, validate DateRange
    const range = this.value as DateRange;
    
    // Check if range object exists and has both properties
    if (!range || !range.start || !range.end) {
      return false;
    }

    // Check if both are Date instances
    if (!(range.start instanceof Date) || !(range.end instanceof Date)) {
      return false;
    }

    // Check if dates are valid (not NaN)
    if (isNaN(range.start.getTime()) || isNaN(range.end.getTime())) {
      return false;
    }

    // Check if start is before or equal to end
    if (range.start > range.end) {
      return false;
    }

    return true;
  }

  build() {
    if (!this.isComplete()) throw new Error("Incomplete date range rule");
    return this.blueprint.createRule(this.relation!, this.value!);
  }
}
