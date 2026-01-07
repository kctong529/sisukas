// src/domain/filters/utils/FilterSerializer.ts
import type { FilterConfig, FilterRuleGroups } from '../FilterTypes';

export interface SerializedFilterRule {
  field: string;
  relation: string;
  value: any;
}

export interface SerializedFilterGroup {
  rules: SerializedFilterRule[];
}

export interface SerializedFilters {
  groups: SerializedFilterGroup[];
}

/**
 * Utility for serializing and deserializing filter configurations
 */
export class FilterSerializer {
  /**
   * Convert FilterConfig array to API-compatible JSON format
   */
  static toJSON(filterConfigs: FilterConfig[]): SerializedFilters {
    const groups: SerializedFilterGroup[] = [];
    let currentGroup: SerializedFilterRule[] = [];

    filterConfigs.forEach((config, index) => {
      const rule: SerializedFilterRule = {
        field: config.blueprintKey,
        relation: config.relation,
        value: config.value
      };

      if (index > 0 && config.booleanOp === 'OR') {
        // Start new OR group
        if (currentGroup.length > 0) {
          groups.push({ rules: currentGroup });
        }
        currentGroup = [rule];
      } else {
        // Add to current AND group
        currentGroup.push(rule);
      }
    });

    // Push final group
    if (currentGroup.length > 0) {
      groups.push({ rules: currentGroup });
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

        // Determine boolean operator
        let booleanOp: 'AND' | 'OR' = 'AND';
        if (!isFirstRule) {
          booleanOp = ruleIndex === 0 ? 'OR' : 'AND';
        }

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
}