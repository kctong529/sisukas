// src/domain/filters/blueprints/BaseRuleBlueprint.ts
export abstract class BaseRuleBlueprint {
  abstract readonly builderType: 'text' | 'numeric' | 'numericRange' | 'date' | 'dateRange' | 'period' | 'categorical' | 'membership';
  abstract readonly field: string;
  abstract readonly label: string;
  
  abstract readonly validRelations: readonly string[];
  abstract readonly defaultRelation: string;
  
  readonly validValues?: readonly string[];
  readonly valueLabels?: Readonly<Record<string, string>>;
  readonly availableSets?: readonly string[];
  readonly getSetLabel?: (id: string) => string;
}