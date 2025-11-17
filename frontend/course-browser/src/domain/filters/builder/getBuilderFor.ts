import { TextRuleBuilder } from "./TextRuleBuilder";

export function getBuilderFor(blueprint: any) {
  switch (blueprint.builderType) {
    case 'text': return new TextRuleBuilder(blueprint);
    default:
      throw new Error(`No builder for kind: ${blueprint.builderType}`);
  }
}
