// src/domain/filters/rules/MembershipFilterRule.ts
import type { FilterRule, FilterRuleJSON } from '../core/FilterRule';

export type MembershipRelation = 
  | 'isMemberOf'
  | 'isNotMemberOf';

export interface MembershipFilterRuleConfig<TKey, TEntity> {
  keySelector: (entity: TEntity) => TKey;
  fieldName: string;
  relation: MembershipRelation;
  identifier: string;
}

export interface MembershipDataSource<TKey> {
  getMembershipSet(category: string, identifier: string): Set<TKey> | undefined;
}

export class MembershipFilterRule<TKey, TEntity> 
  implements FilterRule<TEntity> {
  
  constructor(
    private config: MembershipFilterRuleConfig<TKey, TEntity>,
    private dataSource: MembershipDataSource<TKey>
  ) {
    const set = this.dataSource.getMembershipSet(
      this.config.fieldName, 
      this.config.identifier
    );
    if (!set) {
      throw new Error(
        `Set not found: ${this.config.fieldName}/${this.config.identifier}`
      );
    }
  }

  evaluate(entity: TEntity): boolean {
    const key = this.config.keySelector(entity);
    const set = this.dataSource.getMembershipSet(
      this.config.fieldName, 
      this.config.identifier
    );
    
    if (!set) return false;
    
    const isMember = set.has(key);
    
    switch (this.config.relation) {
      case 'isMemberOf':
        return isMember;
      case 'isNotMemberOf':
        return !isMember;
      default:
        throw new Error(`Unknown membership relation: ${this.config.relation}`);
    }
  }

  describe(): string {
    return `${this.config.fieldName} ${this.config.relation} ${this.config.identifier}`;
  }

  toJSON(): FilterRuleJSON {
    return {
      type: 'membership',
      field: this.config.fieldName,
      relation: this.config.relation,
      value: this.config.identifier,
    };
  }
}