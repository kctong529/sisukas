// src/domain/filters/helpers/ValueParser.ts
import type { BaseRuleBlueprint } from '../blueprints/BaseRuleBlueprint';

type BuilderType = BaseRuleBlueprint['builderType'];

interface ParsableBlueprint {
  builderType: BuilderType;
  availableSets?: readonly string[];
}

type ParsedValue =
  | string
  | number
  | Date
  | { start: Date; end: Date }
  | string[]
  | undefined;

interface DateRangeInput {
  start: unknown;
  end: unknown;
}

function isDateRangeInput(value: unknown): value is DateRangeInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'start' in value &&
    'end' in value
  );
}

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
  static parse(
    blueprint: ParsableBlueprint,
    relation: string,
    value: unknown
  ): ParsedValue {
    // Relations that don't need a value
    if (relation === 'isEmpty' || relation === 'isNotEmpty') {
      return undefined;
    }
    
    switch (blueprint.builderType) {
      case 'dateRange':
        return this.parseDateRange(relation, value);
      case 'date':
        return this.parseDate(value);
      case 'numeric':
      case 'numericRange':
        return this.parseNumeric(value);
      case 'membership':
        return this.parseMembership(value, blueprint);
      case 'categorical':
        return this.parseCategorical(relation, value);
      case 'text':
      default:
        return this.parseText(value);
    }
  }

  /**
   * Parse date range value (either single date or range)
   */
  private static parseDateRange(
    relation: string,
    value: unknown
  ): Date | { start: Date; end: Date } | undefined {
    if (relation === 'containsDate') {
      if (typeof value !== 'string' || value === '') return undefined;
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    }

    if (!isDateRangeInput(value)) {
      return undefined;
    }

    const start = new Date(value.start as string);
    const end = new Date(value.end as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return undefined;
    }

    return { start, end };
  }

  /**
   * Parse single date value
   */
  private static parseDate(value: unknown): Date | undefined {
    if (typeof value !== 'string' || value === '') return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }

  /**
   * Parse numeric value
   */
  private static parseNumeric(value: unknown): number | undefined {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    const num =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
        ? parseInt(value, 10)
        : NaN;

    return isNaN(num) ? undefined : num;
  }

  /**
   * Parse membership identifier (validates against available sets)
   */
  private static parseMembership(
    value: unknown,
    blueprint: ParsableBlueprint
  ): string | undefined {
    if (typeof value !== 'string' || value === '') return undefined;

    if (!blueprint.availableSets?.includes(value)) {
      console.warn(`Invalid membership identifier: ${value}`);
      return undefined;
    }

    return value;
  }

  /**
   * Parse categorical value (handles multi-value relations)
   */
  private static parseCategorical(
    relation: string,
    value: unknown
  ): string | string[] | undefined {
    const multiValueRelations = [
      'isOneOf',
      'isNotOneOf',
      'includesAny',
      'includesAll',
    ];

    if (multiValueRelations.includes(relation)) {
      if (typeof value === 'string') {
        const values = value
          .split(',')
          .map(v => v.trim())
          .filter(Boolean);
        return values.length > 0 ? values : undefined;
      }

      return Array.isArray(value) && value.length > 0
        ? value.filter(v => typeof v === 'string')
        : undefined;
    }

    return this.parseText(value);
  }

  /**
   * Parse text value (default case)
   */
  private static parseText(value: unknown): string | undefined {
    return typeof value === 'string' && value !== '' ? value : undefined;
  }
}