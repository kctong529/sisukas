// src/domain/filters/blueprints/MembershipRuleBlueprint.ts
import type { Course } from '../../models/Course';
import type { CurriculaMap, CurriculumType } from '../../models/Curriculum';
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
    // category is 'major' | 'minor' | 'master' | ...
    const bucket = (this.curriculaMap as Record<string, any>)[category];
    return bucket?.[identifier]?.courses;
  }
}

/**
 * Blueprint for filtering by various curriculum
 */
export class CurriculumMembershipRuleBlueprint
  extends MembershipRuleBlueprint<string, Course> {
  readonly validRelations = ['isMemberOf', 'isNotMemberOf'] as const;
  readonly defaultRelation = 'isMemberOf' as const;
  readonly keySelector = (c: Course) => c.code.value;

  readonly availableSets: readonly string[];
  readonly setLabels: Record<string, string>;

  constructor(
    readonly field: CurriculumType,
    readonly label: string,
    curriculaMap: CurriculaMap
  ) {
    super(new CurriculaMapDataSource(curriculaMap));

    const bucket = curriculaMap[field] ?? {};
    this.availableSets = Object.keys(bucket);
    this.setLabels = Object.fromEntries(
      Object.entries(bucket).map(([id, data]) => [id, data.name])
    );
  }
}
