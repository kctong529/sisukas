// src/domain/filters/helpers/DefaultValueInitializer.ts

import { BaseRuleBlueprint } from '../blueprints/BaseRuleBlueprint';

type DefaultValue = string | { start: string; end: string };

/**
 * Utility class for initializing default values for filter fields based on blueprint type
 */
export class DefaultValueInitializer {
  /**
   * Get appropriate default value for a blueprint
   * 
   * @param blueprint - The blueprint defining the field type
   * @returns Default value appropriate for the blueprint type
   */
  static getDefaultValue(blueprint: BaseRuleBlueprint): DefaultValue {
    switch (blueprint.builderType) {
      case 'dateRange':
        return this.getDateRangeDefault(blueprint);
      case 'date':
        return this.getTodayString();
      case 'membership':
        return this.getMembershipDefault(blueprint);
      case 'categorical':
        return this.getCategoricalDefault(blueprint);
      case 'numeric':
      case 'numericRange':
      case 'text':
      default:
        return '';
    }
  }

  /**
   * Get today's date as YYYY-MM-DD string (for date inputs)
   */
  private static getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  /**
   * Get default value for date range fields
   */
  private static getDateRangeDefault(blueprint: BaseRuleBlueprint): DefaultValue {
    const todayString = this.getTodayString();

    if ('defaultRelation' in blueprint && blueprint.defaultRelation === 'containsDate') {
      // Single date for containsDate - default to today
      return todayString;
    }
    
    // Date range for other relations - default to today for both start and end
    return { 
      start: todayString, 
      end: todayString 
    };
  }

  /**
   * Get default value for membership fields
   */
  private static getMembershipDefault(blueprint: BaseRuleBlueprint): string {
    if ('availableSets' in blueprint && blueprint.availableSets) {
      const availableSets = blueprint.availableSets as string[];
      return availableSets[0] || '';
    }
    return '';
  }

  /**
   * Get default value for categorical fields
   */
  private static getCategoricalDefault(blueprint: BaseRuleBlueprint): DefaultValue {
    // If there are predefined valid values, use the first one
    if ('validValues' in blueprint && blueprint.validValues) {
      const validValues = blueprint.validValues as string[];
      if (validValues.length > 0) {
        return validValues[0];
      }
    }
    // Otherwise empty string (for open-ended categorical like teachers, tags)
    return '';
  }
}