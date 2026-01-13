// src/domain/filters/blueprints/BaseRuleBlueprint.ts
export abstract class BaseRuleBlueprint {
<<<<<<< HEAD
  abstract readonly builderType: 'text' | 'numeric' | 'numericRange' | 'date' | 'dateRange' | 'period' | 'categorical' | 'membership';
=======
  abstract readonly builderType: 'text' | 'numeric' | 'numericRange' | 'date' | 'dateRange' | 'categorical';
>>>>>>> main
  abstract readonly field: string;
  abstract readonly label: string;
}