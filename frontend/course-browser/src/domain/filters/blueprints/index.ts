// src/domain/filters/blueprints/index.ts
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