// src/domain/filters/builder/TextRuleBuilder.ts
import type { TextRuleBlueprint } from "../blueprints/TextRuleBlueprintRegistry";
import type { TextRelation } from "../rules/TextFilterRule";
import type { FilterRuleBuilder } from "./FilterRuleBuilder";

export class TextRuleBuilder implements FilterRuleBuilder<TextRuleBlueprint> {
  relation: TextRelation | null = null;
  value: string = "";

  constructor(readonly blueprint: TextRuleBlueprint) {
    this.relation = blueprint.defaultRelation ?? null;
  }

  setRelation(r: TextRelation) {
    if (!this.blueprint.isValidRelation(r)) throw new Error("Invalid relation");
    this.relation = r;
    return this;
  }

  setValue(v: string) {
    this.value = v;
    return this;
  }

  isComplete(): boolean {
    return this.relation !== null && this.value.trim() !== "";
  }

  build() {
    if (!this.isComplete()) throw new Error("Incomplete text filter rule");
    return this.blueprint.createRule(this.relation!, this.value);
  }
}
