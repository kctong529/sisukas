/**
 * @module RuleBlueprints
 * 
 * This module exports:
 * 1. Singleton instances of each blueprint via RuleBlueprints
 * 2. Type exports for all blueprint types
 * 3. The keys of the blueprint collection (RuleBlueprintKey)
 *
 * Blueprints are used to construct strongly-typed filter rules via their corresponding builders.
 */

import { CodeRuleBlueprint, NameRuleBlueprint, OrganizationRuleBlueprint } from './TextRuleBlueprints';
import { CreditsRangeRuleBlueprint } from './NumericRangeRuleBlueprints';
import { StartDateRuleBlueprint, EndDateRuleBlueprint } from './DateRuleBlueprints';
import { EnrollmentPeriodRuleBlueprint, CoursePeriodRuleBlueprint } from './DateRangeRuleBlueprints';
import { LevelRuleBlueprint, FormatRuleBlueprint, LanguagesRuleBlueprint, TeachersRuleBlueprint, TagsRuleBlueprint } from './CategoricalRuleBlueprints';

/**
 * Singleton instances of all available rule blueprints.
 * Use these to create rule instances.
 */
export const RuleBlueprints = {
  // Text
  code: new CodeRuleBlueprint(),
  name: new NameRuleBlueprint(),
  organization: new OrganizationRuleBlueprint(),

  // NumericRange
  credits: new CreditsRangeRuleBlueprint(),

  // Date
  startDate: new StartDateRuleBlueprint(),
  endDate: new EndDateRuleBlueprint(),
  
  // DateRange
  enrollmentPeriod: new EnrollmentPeriodRuleBlueprint(),
  coursePeriod: new CoursePeriodRuleBlueprint(),
  
  // Categorical
  level: new LevelRuleBlueprint(),
  format: new FormatRuleBlueprint(),
  language: new LanguagesRuleBlueprint(),
  teachers: new TeachersRuleBlueprint(),
  tags: new TagsRuleBlueprint(),
} as const;

// Type for all blueprint keys
export type RuleBlueprintKey = keyof typeof RuleBlueprints;

export type { 
  BaseRuleBlueprint 
} from './BaseRuleBlueprint';

export type { 
  TextRuleBlueprint 
} from './TextRuleBlueprints';

export type { 
  NumericRuleBlueprint 
} from './NumericRuleBlueprints';

export type { 
  NumericRangeRuleBlueprint 
} from './NumericRangeRuleBlueprints';

export type { 
  DateRuleBlueprint 
} from './DateRuleBlueprints';

export type { 
  DateRangeRuleBlueprint 
} from './DateRangeRuleBlueprints';

export type { 
  CategoricalRuleBlueprint 
} from './CategoricalRuleBlueprints';