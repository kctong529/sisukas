// src/domain/filters/utils/ValueParser.ts

/**
 * Utility class for parsing filter values from UI inputs into domain types
 */
export class ValueParser {
  /**
   * Parse a value based on blueprint type and relation
   * 
   * @param blueprint - The blueprint defining the field type
   * @param relation - The relation being used
   * @param valueStr - The raw value from the UI
   * @returns Parsed value or undefined if invalid/incomplete
   */
  static parse(blueprint: any, relation: string, valueStr: any): any {
    // Relations that don't need a value
    if (relation === 'isEmpty' || relation === 'isNotEmpty') {
      return undefined;
    }
    
    switch (blueprint.builderType) {
      case 'dateRange':
        return this.parseDateRange(relation, valueStr);
      case 'date':
        return this.parseDate(valueStr);
      case 'numeric':
      case 'numericRange':
        return this.parseNumeric(valueStr);
      case 'membership':
        return this.parseMembership(valueStr, blueprint);
      case 'categorical':
        return this.parseCategorical(relation, valueStr);
      case 'text':
      default:
        return this.parseText(valueStr);
    }
  }

  /**
   * Parse date range value (either single date or range)
   */
  private static parseDateRange(relation: string, valueStr: any): any {
    if (relation === 'containsDate') {
      if (!valueStr || valueStr === '') return undefined;
      const date = new Date(valueStr);
      return isNaN(date.getTime()) ? undefined : date;
    }
    
    // Date range for other relations
    if (!valueStr || !valueStr.start || !valueStr.end) {
      return undefined;
    }
    
    const start = new Date(valueStr.start);
    const end = new Date(valueStr.end);
    
    // Return undefined if either date is invalid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return undefined;
    }
    
    return { start, end };
  }

  /**
   * Parse single date value
   */
  private static parseDate(valueStr: any): Date | undefined {
    if (!valueStr || valueStr === '') return undefined;
    const date = new Date(valueStr);
    return isNaN(date.getTime()) ? undefined : date;
  }

  /**
   * Parse numeric value
   */
  private static parseNumeric(valueStr: any): number | undefined {
    if (valueStr === '' || valueStr === null || valueStr === undefined) {
      return undefined;
    }
    const num = typeof valueStr === 'number' ? valueStr : parseInt(valueStr);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Parse membership identifier (validates against available sets)
   */
  private static parseMembership(valueStr: any, blueprint: any): string | undefined {
    if (!valueStr || valueStr === '') return undefined;
    
    // Validate identifier is in available sets
    if (!blueprint.availableSets.includes(valueStr)) {
      console.warn(`Invalid membership identifier: ${valueStr}`);
      return undefined;
    }
    
    return valueStr;
  }

  /**
   * Parse categorical value (handles multi-value relations)
   */
  private static parseCategorical(relation: string, valueStr: any): any {
    const multiValueRelations = ['isOneOf', 'isNotOneOf', 'includesAny', 'includesAll'];
    
    if (multiValueRelations.includes(relation)) {
      if (typeof valueStr === 'string') {
        const values = valueStr.split(',').map(v => v.trim()).filter(v => v);
        return values.length > 0 ? values : undefined;
      }
      return Array.isArray(valueStr) && valueStr.length > 0 ? valueStr : undefined;
    }
    
    return this.parseText(valueStr);
  }

  /**
   * Parse text value (default case)
   */
  private static parseText(valueStr: any): string | undefined {
    return valueStr && valueStr !== '' ? valueStr : undefined;
  }
}