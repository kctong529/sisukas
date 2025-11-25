// src/domain/filters/blueprints/DateRangeRuleBlueprints.ts
import type { Course } from '../../models/Course';
import type { DateRange } from '../../value-objects/DateRange';
import { DateRangeFilterRule, type DateRangeRelation, type DateRangeFilterRuleConfig } from '../categories/DateRangeFilterRule';
import type { BaseRuleBlueprint } from './BaseRuleBlueprint';

export abstract class DateRangeRuleBlueprint implements BaseRuleBlueprint {
  readonly builderType = 'dateRange' as const;

  abstract readonly field: string;
  abstract readonly label: string;
  abstract readonly validRelations: readonly DateRangeRelation[];
  abstract readonly selector: (course: Course) => DateRange;

  readonly defaultRelation?: DateRangeRelation;

  createRule(relation: DateRangeRelation, value: DateRange): DateRangeFilterRule {
    if (!this.isValidRelation(relation)) {
      throw new Error(`Invalid relation "${relation}" for field "${this.field}". Valid: ${this.validRelations.join(', ')}`);
    }

    if (!this.isValidDateRange(value)) {
      throw new Error(`Invalid DateRange value for relation "${relation}"`);
    }

    const config: DateRangeFilterRuleConfig = {
      field: this.selector,
      fieldName: this.field,
      relation,
      value,
    };

    return new DateRangeFilterRule(config);
  }

  isValidRelation(relation: DateRangeRelation): boolean {
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

export class EnrollmentPeriodRuleBlueprint extends DateRangeRuleBlueprint {
  readonly field = 'enrollmentPeriod';
  readonly label = 'Enrollment Period';
  readonly validRelations = ['overlaps', 'contains', 'equals'] as const;
  readonly defaultRelation = 'overlaps' as const;
  readonly selector = (c: Course) => c.enrollmentPeriod;
}

export class CoursePeriodRuleBlueprint extends DateRangeRuleBlueprint {
  readonly field = 'coursePeriod';
  readonly label = 'Course Period';
  readonly validRelations = ['overlaps', 'contains', 'equals'] as const;
  readonly defaultRelation = 'overlaps' as const;
  readonly selector = (c: Course) => ({ start: c.courseDate.start, end: c.courseDate.end });
}