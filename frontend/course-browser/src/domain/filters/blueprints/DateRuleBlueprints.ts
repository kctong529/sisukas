// src/domain/filters/blueprints/DateRuleBlueprints.ts
import type { Course } from '../../models/Course';
import type { DateRange } from '../../value-objects/DateRange';
import { DateFilterRule, type DateRelation, type DateFilterRuleConfig } from '../categories/DateFilterRule';
import type { BaseRuleBlueprint } from './BaseRuleBlueprint';

export abstract class DateRuleBlueprint implements BaseRuleBlueprint {
  readonly builderType = 'date' as const;

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

    if (relation === 'between' && !this.isValidDateRange(value as DateRange)) {
      throw new Error(`Relation "between" requires a DateRange`);
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

  private isValidDateRange(range: DateRange): boolean {
    return range.start instanceof Date &&
           range.end instanceof Date &&
           !isNaN(range.start.getTime()) &&
           !isNaN(range.end.getTime()) &&
           range.start <= range.end;
  }
}

export class StartDateRuleBlueprint extends DateRuleBlueprint {
  readonly field = 'startDate';
  readonly label = 'Start Date';
  readonly validRelations = ['before', 'after', 'onOrBefore', 'onOrAfter', 'equals', 'between'] as const;
  readonly defaultRelation = 'onOrAfter' as const;
  readonly selector = (c: Course) => c.courseDate.start;
}

export class EndDateRuleBlueprint extends DateRuleBlueprint {
  readonly field = 'endDate';
  readonly label = 'End Date';
  readonly validRelations = ['before', 'after', 'onOrBefore', 'onOrAfter', 'equals', 'between'] as const;
  readonly defaultRelation = 'onOrBefore' as const;
  readonly selector = (c: Course) => c.courseDate.end;
}