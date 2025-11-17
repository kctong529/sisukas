// src/domain/filters/blueprints/TextRuleBlueprints.ts
import type { Course } from '../../models/Course';
import { TextFilterRule, type TextRelation, type TextFilterRuleConfig } from '../categories/TextFilterRule';

/**
 * Base class for text field rule blueprints.
 * Each subclass represents a specific field that can be filtered with text operations.
 */
export abstract class TextRuleBlueprint {
  readonly builderType = 'text' as const;

  abstract readonly field: string;
  abstract readonly label: string;
  abstract readonly validRelations: readonly TextRelation[];
  abstract readonly selector: (course: Course) => string;
  
  readonly defaultRelation?: TextRelation;
  readonly caseSensitive: boolean = false;
  readonly trimWhitespace: boolean = true;

  createRule(relation: TextRelation, value: string): TextFilterRule {
    if (!this.isValidRelation(relation)) {
      throw new Error(`Invalid relation "${relation}" for field "${this.field}". Valid: ${this.validRelations.join(', ')}`);
    }

    const config: TextFilterRuleConfig = {
      field: this.selector,
      fieldName: this.field,
      relation,
      value,
      caseSensitive: this.caseSensitive,
      trimWhitespace: this.trimWhitespace,
    };

    return new TextFilterRule(config);
  }

  isValidRelation(relation: TextRelation): boolean {
    return (this.validRelations as readonly string[]).includes(relation);
  }
}

export class CodeRuleBlueprint extends TextRuleBlueprint {
  readonly field = 'code';
  readonly label = 'Course Code';
  readonly validRelations = ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'matches'] as const;
  readonly defaultRelation = 'startsWith' as const;
  readonly selector = (c: Course) => c.code;
}

export class NameRuleBlueprint extends TextRuleBlueprint {
  readonly field = 'name';
  readonly label = 'Course Name';
  readonly validRelations = ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'matches'] as const;
  readonly defaultRelation = 'contains' as const;
  readonly selector = (c: Course) => c.name.en;
}

export class OrganizationRuleBlueprint extends TextRuleBlueprint {
  readonly field = 'organization';
  readonly label = 'Organization';
  readonly validRelations = ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith'] as const;
  readonly defaultRelation = 'contains' as const;
  readonly selector = (c: Course) => c.organization;
}
