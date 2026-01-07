// src/domain/filters/utils/FilterSerializer.ts
import type { FilterConfig } from '../FilterTypes';

export interface SerializedFilterRule {
  field: string;
  relation: string;
  value: string;
}

export interface SerializedFilterGroup {
  rules: SerializedFilterRule[];
  is_must: boolean;
}

export interface SerializedFilters {
  groups: SerializedFilterGroup[];
}

/**
 * Utility for serializing and deserializing filter configurations
 * Compatible with Sisukas Filters API v0.3.2
 */
export class FilterSerializer {
  /**
   * Convert FilterConfig array to API-compatible JSON format
   */
  static toJSON(filterConfigs: FilterConfig[]): SerializedFilters {
    if (filterConfigs.length === 0) {
      return { groups: [] };
    }

    const groups: SerializedFilterGroup[] = [];
    let currentGroup: SerializedFilterRule[] = [];

    filterConfigs.forEach((config, index) => {
      const valueStr = this.valueToString(config.value);

      const rule: SerializedFilterRule = {
        field: config.blueprintKey,
        relation: config.relation,
        value: valueStr
      };

      if (index > 0 && config.booleanOp === 'OR') {
        // Start new OR group
        if (currentGroup.length > 0) {
          groups.push({
            rules: currentGroup,
            is_must: false
          });
        }
        currentGroup = [rule];
      } else {
        // Add to current AND group
        currentGroup.push(rule);
      }
    });

    // Push final group
    if (currentGroup.length > 0) {
      groups.push({
        rules: currentGroup,
        is_must: false
      });
    }

    return { groups };
  }

  /**
   * Convert API JSON format back to FilterConfig array
   */
  static fromJSON(data: SerializedFilters, blueprints: any): FilterConfig[] {
    const configs: FilterConfig[] = [];
    let nextId = 0;
    let isFirstRule = true;

    data.groups.forEach((group, groupIndex) => {
      group.rules.forEach((rule, ruleIndex) => {
        const blueprint = blueprints[rule.field];
        
        if (!blueprint) {
          console.warn(`Unknown blueprint: ${rule.field}`);
          return;
        }

        // Determine boolean operator based on group structure
        let booleanOp: 'AND' | 'OR' = 'AND';
        if (!isFirstRule) {
          // First rule of a new group (after first group) gets OR
          // Other rules in same group get AND
          booleanOp = ruleIndex === 0 && groupIndex > 0 ? 'OR' : 'AND';
        }

        // Parse value from string back to appropriate type
        const parsedValue = this.stringToValue(rule.value, blueprint);

        configs.push({
          id: nextId++,
          blueprintKey: rule.field,
          relation: rule.relation,
          value: rule.value,
          booleanOp
        });

        isFirstRule = false;
      });
    });

    return configs;
  }

  /**
   * Convert any value to string for API
   */
  private static valueToString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Handle date objects
    if (value instanceof Date) {
      return value.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    // Handle date range objects
    if (typeof value === 'object' && 'start' in value && 'end' in value) {
      const start = value.start instanceof Date 
        ? value.start.toISOString().split('T')[0]
        : String(value.start);
      const end = value.end instanceof Date
        ? value.end.toISOString().split('T')[0]
        : String(value.end);
      return `${start},${end}`;
    }

    // Handle arrays (for multi-value filters like periods)
    if (Array.isArray(value)) {
      return value.join(',');
    }

    // Default: convert to string
    return String(value);
  }

  /**
   * Parse string value back to appropriate type based on blueprint
   */
  private static stringToValue(valueStr: string, blueprint: any): any {
    if (!valueStr) {
      return '';
    }

    // Handle different builder types
    switch (blueprint.builderType) {
      case 'date':
        return valueStr; // Keep as string for date input

      case 'dateRange':
        // Check if it's a range (contains comma)
        if (valueStr.includes(',')) {
          const [start, end] = valueStr.split(',').map(s => s.trim());
          return { start, end };
        }
        return valueStr;

      case 'numeric':
      case 'numericRange':
        // Try to parse as number, fall back to string
        const num = parseInt(valueStr);
        return isNaN(num) ? valueStr : num;

      case 'period':
        // Period selections are comma-separated
        return valueStr;

      case 'categorical':
        return valueStr;

      default:
        return valueStr;
    }
  }
}