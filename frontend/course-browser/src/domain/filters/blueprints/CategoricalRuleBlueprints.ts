// src/domain/filters/blueprints/CategoricalRuleBlueprints.ts
import type { Course } from '../../models/Course';
import type { StudyLevel, CourseFormat, Language } from '../../value-objects/CourseTypes';
import { CategoricalFilterRule, type CategoricalRelation, type CategoricalFilterRuleConfig } from '../categories/CategoricalFilterRule';

export abstract class CategoricalRuleBlueprint<T extends string> {
  abstract readonly field: string;
  abstract readonly label: string;
  abstract readonly validRelations: readonly CategoricalRelation[];
  abstract readonly selector: (course: Course) => T | T[];
  abstract readonly validValues: readonly T[];
  
  readonly defaultRelation?: CategoricalRelation;
  readonly valueLabels?: Record<T, string>;
  readonly caseSensitive?: boolean;
  readonly partial?: boolean = false;
  
  createRule(relation: CategoricalRelation, value?: T | T[]): CategoricalFilterRule<T> {
    if (!this.isValidRelation(relation)) {
      throw new Error(`Invalid relation "${relation}" for field "${this.field}". Valid: ${this.validRelations.join(', ')}`);
    }

    // Validate value requirements
    this.validateValueRequirement(relation, value);

    const config: CategoricalFilterRuleConfig<T> = {
      field: this.selector,
      fieldName: this.field,
      relation,
      value,
      validValues: this.validValues as T[],
      caseSensitive: this.caseSensitive,
      partial: this.partial,
    };

    return new CategoricalFilterRule(config);
  }

  isValidRelation(relation: CategoricalRelation): boolean {
    return (this.validRelations as readonly string[]).includes(relation);
  }

  private validateValueRequirement(relation: CategoricalRelation, value?: T | T[]): void {
    const noValueRelations: CategoricalRelation[] = ['isEmpty', 'isNotEmpty'];
    
    if (noValueRelations.includes(relation)) {
      if (value !== undefined) {
        throw new Error(`Relation "${relation}" does not accept a value`);
      }
    } else {
      if (value === undefined) {
        throw new Error(`Relation "${relation}" requires a value`);
      }
    }
  }
}

export class LevelRuleBlueprint extends CategoricalRuleBlueprint<StudyLevel> {
  readonly field = 'level';
  readonly label = 'Study Level';
  readonly validRelations = ['equals', 'notEquals', 'isOneOf', 'isNotOneOf'] as const;
  readonly defaultRelation = 'equals' as const;
  readonly selector = (c: Course) => c.level;
  readonly validValues = ['basic-studies', 'intermediate-studies', 'advanced-studies', 'postgraduate-studies', 'other-studies'] as const;
  readonly valueLabels = {
    'basic-studies': 'Basic Studies',
    'intermediate-studies': 'Intermediate Studies',
    'advanced-studies': 'Advanced Studies',
    'postgraduate-studies': 'Postgraduate Studies',
    'other-studies': 'Other Studies',
  } as const;
}

export class FormatRuleBlueprint extends CategoricalRuleBlueprint<CourseFormat> {
  readonly field = 'format';
  readonly label = 'Course Format';
  readonly validRelations = ['equals', 'notEquals', 'isOneOf', 'isNotOneOf'] as const;
  readonly defaultRelation = 'equals' as const;
  readonly selector = (c: Course) => c.format;
  readonly validValues = ['lecture', 'thesis', 'exam', 'other'] as const;
  readonly valueLabels = {
    'lecture': 'Lecture',
    'thesis': 'Thesis',
    'exam': 'Exam',
    'other': 'Other',
  } as const;
}

export class LanguagesRuleBlueprint extends CategoricalRuleBlueprint<Language> {
  readonly field = 'languages';
  readonly label = 'Languages';
  readonly validRelations = ['includes', 'notIncludes', 'includesAny', 'includesAll', 'isEmpty', 'isNotEmpty'] as const;
  readonly defaultRelation = 'includesAny' as const;
  readonly selector = (c: Course) => c.languages;
  readonly validValues = ['en', 'fi', 'sv'] as const;
  readonly valueLabels = {
    'en': 'English',
    'fi': 'Finnish',
    'sv': 'Swedish',
  } as const;
}

export class TeachersRuleBlueprint extends CategoricalRuleBlueprint<string> {
  readonly field = 'teachers';
  readonly label = 'Teachers';
  readonly validRelations = ['includes', 'notIncludes', 'includesAny', 'includesAll', 'isEmpty', 'isNotEmpty'] as const;
  readonly defaultRelation = 'includes' as const;
  readonly selector = (c: Course) => c.teachers;
  readonly validValues = [] as const; // No predefined values for teachers
  readonly caseSensitive = false;
  readonly partial = true;
}

export class TagsRuleBlueprint extends CategoricalRuleBlueprint<string> {
  readonly field = 'tags';
  readonly label = 'Tags';
  readonly validRelations = ['includes', 'notIncludes', 'includesAny', 'includesAll', 'isEmpty', 'isNotEmpty'] as const;
  readonly defaultRelation = 'includes' as const;
  readonly selector = (c: Course) => c.tags ?? [];
  readonly validValues = [] as const; // No predefined values for tags
  readonly caseSensitive = false;
}
