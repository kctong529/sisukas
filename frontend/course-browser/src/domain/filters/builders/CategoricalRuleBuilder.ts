import type { CategoricalRuleBlueprint } from "../blueprints/CategoricalRuleBlueprintRegistry";
import type { CategoricalRelation } from "../rules/CategoricalFilterRule";
import type { FilterRuleBuilder } from "./FilterRuleBuilder";

export class CategoricalRuleBuilder<T extends string, TEntity> implements FilterRuleBuilder<CategoricalRuleBlueprint<T, TEntity>> {
  relation: CategoricalRelation | null = null;
  value: T | T[] | null = null;

  constructor(readonly blueprint: CategoricalRuleBlueprint<T, TEntity>) {
    this.relation = blueprint.defaultRelation ?? null;
  }

  setRelation(r: CategoricalRelation) {
    if (!this.blueprint.isValidRelation(r)) throw new Error("Invalid relation");
    this.relation = r;
    return this;
  }

  setValue(v: T | T[]) {
    if (v === '' || v === null || v === undefined) {
      this.value = null;
      return this;
    }
    this.value = v;
    return this;
  }

  isComplete(): boolean {
    if (!this.relation) return false;
    if (['isEmpty', 'isNotEmpty'].includes(this.relation)) return true;
    return this.value !== null;
  }

  build() {
    if (!this.isComplete()) throw new Error("Incomplete categorical rule");
    return this.blueprint.createRule(this.relation!, this.value!);
  }
}
