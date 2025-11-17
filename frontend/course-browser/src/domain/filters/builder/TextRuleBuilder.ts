import type { TextRuleBlueprint } from "../blueprints/TextRuleBlueprints";
import type { TextRelation } from "../categories/TextFilterRule";
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
  }

  setValue(v: string) {
    this.value = v;
  }

  isComplete(): boolean {
    return this.relation !== null && this.value.trim() !== "";
  }

  build() {
    if (!this.isComplete()) throw new Error("Incomplete text filter rule");
    return this.blueprint.createRule(this.relation!, this.value);
  }
}
