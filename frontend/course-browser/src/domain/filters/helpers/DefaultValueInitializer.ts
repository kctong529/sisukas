// src/domain/filters/helpers/DefaultValueInitializer.ts

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
  static getDefaultValue(blueprint: any): any {
    switch (blueprint.builderType) {
      case 'dateRange':
        return this.getDateRangeDefault(blueprint);
      case 'date':
        return this.getTodayString();
      case 'membership':
        return blueprint.availableSets[0] || '';
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
  private static getDateRangeDefault(blueprint: any): any {
    const todayString = this.getTodayString();

    if (blueprint.defaultRelation === 'containsDate') {
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
   * Get default value for categorical fields
   */
  private static getCategoricalDefault(blueprint: any): any {
    // If there are predefined valid values, use the first one
    if (blueprint.validValues && blueprint.validValues.length > 0) {
      return blueprint.validValues[0];
    }
    // Otherwise empty string (for open-ended categorical like teachers, tags)
    return '';
  }
}