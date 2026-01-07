// src/domain/filters/blueprints/MembershipRuleBlueprint.ts
import type { Course } from '../../models/Course';
import type { CurriculaMap } from '../../models/Curriculum';
import { 
  MembershipFilterRule, 
  type MembershipRelation,
  type MembershipFilterRuleConfig,
  type MembershipDataSource 
} from '../rules/MembershipFilterRule';
import type { BaseRuleBlueprint } from './BaseRuleBlueprint';

/**
 * Abstract base blueprint for membership-based filtering rules.
 * 
 * Membership blueprints check whether an entity belongs to a predefined set
 * by extracting a key from the entity and looking it up in an external data source.
 * The field name doubles as the category identifier for data source lookups.
 * 
 * @template TKey - The type of key used for membership lookup (e.g. string for course codes)
 * @template TEntity - The type of entity being filtered (e.g. Course)
 */
export abstract class MembershipRuleBlueprint<TKey, TEntity> 
  implements BaseRuleBlueprint {
  
  readonly builderType = 'membership' as const;

  abstract readonly field: string;
  abstract readonly label: string;
  abstract readonly validRelations: readonly MembershipRelation[];
  abstract readonly keySelector: (entity: TEntity) => TKey;
  abstract readonly availableSets: readonly string[];
  abstract readonly setLabels?: Record<string, string>;
  
  readonly defaultRelation?: MembershipRelation;

  /**
   * @param dataSource - External data source providing membership sets for lookup
   */
  constructor(protected dataSource: MembershipDataSource<TKey>) {}

  createRule(
    relation: MembershipRelation,
    identifier: string
  ): MembershipFilterRule<TKey, TEntity> {
    
    if (!this.isValidRelation(relation)) {
      throw new Error(
        `Invalid relation "${relation}" for field "${this.field}". ` +
        `Valid: ${this.validRelations.join(', ')}`
      );
    }

    if (!this.availableSets.includes(identifier)) {
      throw new Error(
        `Invalid set identifier "${identifier}" for ${this.field}. ` +
        `Valid: ${this.availableSets.join(', ')}`
      );
    }

    const config: MembershipFilterRuleConfig<TKey, TEntity> = {
      keySelector: this.keySelector,
      fieldName: this.field,
      relation,
      identifier,
    };

    return new MembershipFilterRule<TKey, TEntity>(config, this.dataSource);
  }

  isValidRelation(relation: MembershipRelation): boolean {
    return (this.validRelations as readonly string[]).includes(relation);
  }

  getSetLabel(identifier: string): string {
    return this.setLabels?.[identifier] ?? identifier;
  }
}

/**
 * Adapter to make CurriculaMap compatible with MembershipDataSource interface
 */
class CurriculaMapDataSource implements MembershipDataSource<string> {
  constructor(private curriculaMap: CurriculaMap) {}

  getMembershipSet(category: string, identifier: string): Set<string> | undefined {
    if (category === 'major') {
      return this.curriculaMap.major[identifier]?.courses;
    }
    if (category === 'minor') {
      return this.curriculaMap.minor[identifier]?.courses;
    }
    return undefined;
  }
}

/**
 * Blueprint for filtering by major curriculum
 */
export class MajorRuleBlueprint extends MembershipRuleBlueprint<string, Course> {
  readonly field = 'major';
  readonly label = 'Major';
  readonly validRelations = ['isMemberOf', 'isNotMemberOf'] as const;
  readonly defaultRelation = 'isMemberOf' as const;
  readonly keySelector = (c: Course) => c.code.value;
  readonly availableSets: readonly string[];
  readonly setLabels: Record<string, string>;

  constructor(curriculaMap: CurriculaMap) {
    super(new CurriculaMapDataSource(curriculaMap));
    this.availableSets = Object.keys(curriculaMap.major);
    this.setLabels = Object.fromEntries(
      Object.entries(curriculaMap.major).map(([id, data]) => [id, data.name])
    );
  }
}

/**
 * Blueprint for filtering by minor curriculum
 */
export class MinorRuleBlueprint extends MembershipRuleBlueprint<string, Course> {
  readonly field = 'minor';
  readonly label = 'Minor';
  readonly validRelations = ['isMemberOf', 'isNotMemberOf'] as const;
  readonly defaultRelation = 'isMemberOf' as const;
  readonly keySelector = (c: Course) => c.code.value;
  readonly availableSets: readonly string[];
  readonly setLabels: Record<string, string>;

  constructor(curriculaMap: CurriculaMap) {
    super(new CurriculaMapDataSource(curriculaMap));
    this.availableSets = Object.keys(curriculaMap.minor);
    this.setLabels = Object.fromEntries(
      Object.entries(curriculaMap.minor).map(([id, data]) => [id, data.name])
    );
  }
}
