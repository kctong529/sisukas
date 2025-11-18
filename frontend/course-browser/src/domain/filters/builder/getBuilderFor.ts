import type { FilterRuleBuilder } from "./FilterRuleBuilder";
import { TextRuleBuilder } from "./TextRuleBuilder";
import { NumericRangeRuleBuilder } from "./NumericRangeRuleBuilder";
import { DateRuleBuilder } from "./DateRuleBuilder";
import { RuleBlueprints } from "../blueprints"

type BuilderMap = {
  text: TextRuleBuilder;
  numericRange: NumericRangeRuleBuilder;
  date: DateRuleBuilder;
};

export function getBuilderFor<T extends keyof typeof RuleBlueprints>(
  blueprint: typeof RuleBlueprints[T]
): BuilderMap[typeof blueprint.builderType] {
  switch (blueprint.builderType) {
    case 'text': return new TextRuleBuilder(blueprint as any);
    case 'numericRange': return new NumericRangeRuleBuilder(blueprint as any);
    case 'date': return new DateRuleBuilder(blueprint as any);
    default:
      throw new Error(`No builder for kind: ${blueprint.builderType}`);
  }
}
