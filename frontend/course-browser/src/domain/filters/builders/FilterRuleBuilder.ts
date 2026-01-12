// src/domain/filters/builder/FilterRuleBuilder.ts
export interface FilterRuleBuilder<T extends { createRule: any }> {
  readonly blueprint: T;

  isComplete(): boolean;

  build(): ReturnType<T["createRule"]>;
}
