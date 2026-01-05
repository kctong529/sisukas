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
import { MajorRuleBlueprint, MinorRuleBlueprint } from './MembershipRuleBlueprints';
import type { CurriculaMap } from '../../models/Curriculum';

/**
 * Static blueprints that don't require external data
 */
export const StaticRuleBlueprints = {
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

/**
 * Configuration for creating membership blueprints
 */
export interface MembershipBlueprintsConfig {
  curriculaMap: CurriculaMap;
  // Future data sources can be added here
  // departmentsMap?: DepartmentsMap;
}

/**
 * Factory function to create all rule blueprints including those requiring external data
 */
export function createRuleBlueprints(config: MembershipBlueprintsConfig) {
  const { curriculaMap } = config;

  return {
    ...StaticRuleBlueprints,
    
    // Membership (require external data)
    major: new MajorRuleBlueprint(curriculaMap),
    minor: new MinorRuleBlueprint(curriculaMap),

    // Future membership blueprints:
    // department: config.departmentsMap ? new DepartmentRuleBlueprint(config.departmentsMap) : undefined,
  } as const;
}

// Type for all blueprint keys
export type RuleBlueprintKey = keyof ReturnType<typeof createRuleBlueprints>;

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

export type { 
  MembershipRuleBlueprint 
} from './MembershipRuleBlueprints';