// src/domain/filters/categories/PeriodFilterRule.ts
import type { Course } from '../../models/Course';
import type { FilterRule, FilterRuleJSON } from '../core/FilterRule';
import type { AcademicPeriod } from '../../models/AcademicPeriod';
import { containsDate, isCompletelyAfter, isCompletelyBefore, overlaps, type DateRange } from '../../value-objects/DateRange';

export type PeriodRelation =
  | 'overlaps'
  | 'isCompletelyBefore'
  | 'isCompletelyAfter'
  | 'equals';

export interface PeriodFilterRuleConfig {
  periodIds: string[];
  periods: AcademicPeriod[];
  relation: PeriodRelation;
}

/**
 * Filter rule for checking if a course's date range overlaps with selected academic periods
 */
export class PeriodFilterRule implements FilterRule<Course> {
  private periodRanges: DateRange[];

  constructor(private config: PeriodFilterRuleConfig) {
    // Convert period IDs to date ranges
    this.periodRanges = config.periodIds
      .map(id => config.periods.find(p => p.id === id))
      .filter((p): p is AcademicPeriod => p !== undefined)
      .map(p => p.dateRange);
  }

  evaluate(course: Course): boolean {
    if (this.periodRanges.length === 0) {
      return false;
    }

    const courseRange: DateRange = {
      start: course.courseDate.start,
      end: course.courseDate.end
    };

    switch (this.config.relation) {
      case 'overlaps':
        return this.periodRanges.some(periodRange => 
          overlaps(courseRange, periodRange)
        );
      case 'isCompletelyBefore':
        return this.periodRanges.every(periodRange =>
          isCompletelyBefore(courseRange, periodRange)
        );
      case 'isCompletelyAfter':
        return this.periodRanges.every(periodRange =>
          isCompletelyAfter(courseRange, periodRange)
        );
      case 'equals':
        const periods = this.periodRanges.sort();
        return containsDate(periods[0], courseRange.start)
          && containsDate(periods[periods.length-1], courseRange.end);
      default:
        throw new Error(`Unknown date range relation: ${this.config.relation}`);
    }
  }

  describe(): string {
    const periodNames = this.config.periodIds.join(', ');
    return `Course Period overlaps with: ${periodNames}`;
  }

  toJSON(): FilterRuleJSON {
    return {
      type: 'period',
      field: 'coursePeriod',
      relation: 'overlaps',
      value: this.config.periodIds,
    };
  }
}