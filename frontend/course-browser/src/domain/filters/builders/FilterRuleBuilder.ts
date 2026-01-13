// src/domain/filters/builder/FilterRuleBuilder.ts

export interface FilterRuleBuilder<TBlueprint, TRule = unknown> {
  readonly blueprint: TBlueprint;

  isComplete(): boolean;

  build(): TRule;
}
