// src/domain/filters/blueprints/BaseRuleBlueprint.ts
export abstract class BaseRuleBlueprint {
  abstract readonly builderType: 'text' | 'numeric' | 'numericRange' | 'date' | 'dateRange' | 'categorical' | 'membership';
  abstract readonly field: string;
  abstract readonly label: string;
}