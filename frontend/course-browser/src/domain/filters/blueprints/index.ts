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

import { CodeRuleBlueprint, NameRuleBlueprint } from './TextRuleBlueprintRegistry';
import { CreditsRangeRuleBlueprint } from './NumericRangeRuleBlueprintRegistry';
import { StartDateRuleBlueprint, EndDateRuleBlueprint } from './DateRuleBlueprintRegistry';
import { EnrollmentRuleBlueprint } from './DateRangeRuleBlueprintRegistry';
import { LevelRuleBlueprint, FormatRuleBlueprint, LanguagesRuleBlueprint, TeachersRuleBlueprint, TagsRuleBlueprint, OrganizationRuleBlueprint } from './CategoricalRuleBlueprintRegistry';
import { MajorRuleBlueprint, MinorRuleBlueprint } from './MembershipRuleBlueprintRegistry';
import { PeriodRuleBlueprint } from './PeriodRuleBlueprint';
import type { CurriculaMap } from '../../models/Curriculum';
import type { AcademicPeriod } from '../../models/AcademicPeriod';

/**
 * Static blueprints that don't require external data
 */
export const StaticRuleBlueprints = {
  // Text
  code: new CodeRuleBlueprint(),
  name: new NameRuleBlueprint(),

  // NumericRange
  credits: new CreditsRangeRuleBlueprint(),

  // Date
  startDate: new StartDateRuleBlueprint(),
  endDate: new EndDateRuleBlueprint(),
  
  // DateRange
  enrollment: new EnrollmentRuleBlueprint(),
  
  // Categorical
  level: new LevelRuleBlueprint(),
  format: new FormatRuleBlueprint(),
  language: new LanguagesRuleBlueprint(),
  teachers: new TeachersRuleBlueprint(),
  tags: new TagsRuleBlueprint(),
} as const;

/**
 * Configuration for creating blueprints that require external data
 */
export interface BlueprintsConfig {
  curriculaMap: CurriculaMap;
  organizations: string[];
  periods: AcademicPeriod[];
  // Future data sources can be added here
  // departmentsMap?: DepartmentsMap;
}

/**
 * Factory function to create all rule blueprints including those requiring external data
 */
export function createRuleBlueprints(config: BlueprintsConfig) {
  const { curriculaMap, organizations, periods } = config;

  return {
    ...StaticRuleBlueprints,

    // Categorical (require external data)
    organization: new OrganizationRuleBlueprint(organizations),

    // Period filtering (requires periods data)
    period: new PeriodRuleBlueprint(periods),
    
    // Membership (require external data)
    major: new MajorRuleBlueprint(curriculaMap),
    minor: new MinorRuleBlueprint(curriculaMap),

    // Future blueprints:
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
} from './TextRuleBlueprintRegistry';

export type { 
  NumericRuleBlueprint 
} from './NumericRuleBlueprintRegistry';

export type { 
  NumericRangeRuleBlueprint 
} from './NumericRangeRuleBlueprintRegistry';

export type { 
  DateRuleBlueprint 
} from './DateRuleBlueprintRegistry';

export type { 
  DateRangeRuleBlueprint 
} from './DateRangeRuleBlueprintRegistry';

export type { 
  CategoricalRuleBlueprint 
} from './CategoricalRuleBlueprintRegistry';

export type { 
  MembershipRuleBlueprint 
} from './MembershipRuleBlueprintRegistry';

export type { 
  PeriodRuleBlueprint 
} from './PeriodRuleBlueprint';