// src/domain/filters/blueprints/DateRuleBlueprints.ts
import type { Course } from '../../models/Course';
import type { DateRange } from '../../value-objects/DateRange';
import { DateFilterRule, type DateRelation, type DateFilterRuleConfig } from '../categories/DateFilterRule';

export abstract class DateRuleBlueprint {
  abstract readonly field: string;
  abstract readonly label: string;
  abstract readonly validRelations: readonly DateRelation[];
  abstract readonly selector: (course: Course) => Date;
  
  readonly defaultRelation?: DateRelation;
  readonly ignoreTime: boolean = true;

  createRule(relation: DateRelation, value: Date | DateRange): DateFilterRule {
    if (!this.isValidRelation(relation)) {
      throw new Error(`Invalid relation "${relation}" for field "${this.field}". Valid: ${this.validRelations.join(', ')}`);
    }

    if (relation === 'between' && !Array.isArray(value)) {
      throw new Error(`Relation "between" requires a range [start, end]`);
    }

    if (relation !== 'between' && Array.isArray(value)) {
      throw new Error(`Relation "${relation}" requires a single Date value`);
    }

    const config: DateFilterRuleConfig = {
      field: this.selector,
      fieldName: this.field,
      relation,
      value,
      ignoreTime: this.ignoreTime,
    };

    return new DateFilterRule(config);
  }

  isValidRelation(relation: DateRelation): boolean {
    return (this.validRelations as readonly string[]).includes(relation);
  }
}

export class StartDateRuleBlueprint extends DateRuleBlueprint {
  readonly field = 'startDate';
  readonly label = 'Start Date';
  readonly validRelations = ['before', 'after', 'onOrBefore', 'onOrAfter', 'equals', 'between'] as const;
  readonly defaultRelation = 'onOrAfter' as const;
  readonly selector = (c: Course) => c.startDate;
}

export class EndDateRuleBlueprint extends DateRuleBlueprint {
  readonly field = 'endDate';
  readonly label = 'End Date';
  readonly validRelations = ['before', 'after', 'onOrBefore', 'onOrAfter', 'equals', 'between'] as const;
  readonly defaultRelation = 'onOrBefore' as const;
  readonly selector = (c: Course) => c.endDate;
}