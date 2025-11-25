// src/domain/filters/blueprints/SetMembershipRuleBlueprint.ts
import type { Course } from '../../models/Course';
import type { CurriculaMap } from '../../models/Curriculum';
import type { CourseCode } from '../../value-objects/CourseCode';
import type { BaseRuleBlueprint } from './BaseRuleBlueprint';
import type { CategoricalRelation } from '../categories/CategoricalFilterRule';

/**
 * Abstract Base Blueprint for rules that check if a field on an entity
 * belongs to a predefined external set of values.
 *
 * This class provides a generic way to implement inclusion/exclusion rules
 * against external data sources (like Curricula, Department lists, etc) for any entity type.
 *
 * It is generic over:
 * 1. TData: The type of the external data source (e.g. CurriculaMap, DepartmentConfig).
 * 2. TMember: The type of the element being checked for membership (e.g. CourseCode, string).
 * 3. TEntity: The type of the entity being filtered (e.g. Course, Student, Program).
 *
 * The concrete class must define:
 * - The selector: which TMember value to extract from the TEntity (e.g. c.code)
 * - The getTargetSet method: how to retrieve the specific Set<TMember> from TData using a lookup key
 */
export abstract class SetMembershipRuleBlueprint<TData, TMember, TEntity> implements BaseRuleBlueprint {
  readonly builderType = 'categorical' as const;

  abstract readonly field: string; 
  abstract readonly label: string;
  readonly validRelations: readonly CategoricalRelation[] = ['isOneOf', 'isNotOneOf'] as const;
  readonly defaultRelation = 'isOneOf' as const;
  
  /**
   * Abstract selector: Must return the value of type TMember from the TEntity
   * that will be checked for set membership
   */
  abstract readonly selector: (entity: TEntity) => TMember;

  readonly validValues = [] as const; // Dynamic values
  protected readonly dataMap: TData;

  constructor(dataMap: TData) {
    this.dataMap = dataMap;
  }

  /**
   * Defines how to retrieve the specific target Set of TMember elements from the TData map
   * based on the user-provided lookup key.
   * Must be implemented by concrete classes.
   */
  protected abstract getTargetSet(lookupKey: string): Set<TMember> | undefined;

  isValidRelation(relation: CategoricalRelation): boolean {
    return (this.validRelations as readonly string[]).includes(relation);
  }

  /**
   * Creates a concrete rule (a predicate function) that checks if an entity's
   * selected field is included in the set(s) retrieved from the data map
   */
  createRule(relation: CategoricalRelation, value: string | string[]): (entity: TEntity) => boolean {
    if (!this.isValidRelation(relation)) {
      throw new Error(`Invalid relation "${relation}" for field "${this.field}". Valid: ${this.validRelations.join(', ')}`);
    }
    
    const lookupKeys = Array.isArray(value) ? value : [value];
    if (lookupKeys.length === 0) {
        throw new Error(`Relation "${relation}" requires at least one lookup key.`);
    }

    const consolidatedSet = new Set<TMember>();
    
    for (const key of lookupKeys) {
        const targetSet = this.getTargetSet(key);
        if (targetSet) {
            targetSet.forEach(member => consolidatedSet.add(member));
        } else {
            console.warn(`Set lookup key "${key}" not found for rule type "${this.label}". Skipping.`);
        }
    }

    if (consolidatedSet.size === 0) {
        return () => false;
    }

    return (entity: TEntity): boolean => {
      const memberValue = this.selector(entity);
      const isMember = consolidatedSet.has(memberValue);
      
      if (relation === 'isOneOf') {
        return isMember;
      } else if (relation === 'isNotOneOf') {
        return !isMember;
      }
      
      return false;
    };
  }
}

export class MajorRuleBlueprint extends SetMembershipRuleBlueprint<CurriculaMap, CourseCode, Course> {
  readonly label = 'Major Program';
  readonly field = 'code'; 
  readonly selector = (c: Course): CourseCode => c.code;

  protected getTargetSet(lookupKey: string): Set<CourseCode> | undefined {
    const curriculum = this.dataMap['major'][lookupKey];
    return curriculum ? curriculum.courses : undefined;
  }
}

export class MinorRuleBlueprint extends SetMembershipRuleBlueprint<CurriculaMap, CourseCode, Course> {
  readonly label = 'Minor Program';
  readonly field = 'code';
  readonly selector = (c: Course): CourseCode => c.code;

  protected getTargetSet(lookupKey: string): Set<CourseCode> | undefined {
    const curriculum = this.dataMap['minor'][lookupKey];
    return curriculum ? curriculum.courses : undefined;
  }
}