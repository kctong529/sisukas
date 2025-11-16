// src/domain/filters/blueprints/index.ts
import { CodeRuleBlueprint, NameRuleBlueprint, OrganizationRuleBlueprint } from './TextRuleBlueprints';

/**
 * Singleton instances of all available rule blueprints.
 * Use these to create rule instances.
 */
export const RuleBlueprints = {
  // Text
  code: new CodeRuleBlueprint(),
  name: new NameRuleBlueprint(),
  organization: new OrganizationRuleBlueprint(),
} as const;

// Type for all blueprint keys
export type RuleBlueprintKey = keyof typeof RuleBlueprints;