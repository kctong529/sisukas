import type { MembershipRuleBlueprint } from "../blueprints/MembershipRuleBlueprints";
import type { MembershipRelation } from "../categories/MembershipFilterRule";
import type { FilterRuleBuilder } from "./FilterRuleBuilder";

export class MembershipRuleBuilder<TKey, TEntity> 
  implements FilterRuleBuilder<MembershipRuleBlueprint<TKey, TEntity>> {
  
  relation: MembershipRelation | null = null;
  identifier: string | null = null;

  constructor(readonly blueprint: MembershipRuleBlueprint<TKey, TEntity>) {
    this.relation = blueprint.defaultRelation ?? null;
  }

  setRelation(r: MembershipRelation) {
    if (!this.blueprint.isValidRelation(r)) {
      throw new Error(`Invalid relation: ${r}`);
    }
    this.relation = r;
    return this;
  }

  setIdentifier(identifier: string) {
    // Handle empty string - just don't set the identifier
    if (identifier === '' || identifier === null || identifier === undefined) {
      this.identifier = null;
      return this;
    }

    // Validate the identifier is in the available sets
    if (!this.blueprint.availableSets.includes(identifier)) {
      console.warn(
        `Invalid set identifier "${identifier}" for ${this.blueprint.field}. ` +
        `Valid: ${this.blueprint.availableSets.join(', ')}`
      );
      this.identifier = null;
      return this;
    }
    
    this.identifier = identifier;
    return this;
  }

  isComplete(): boolean {
    if (this.relation === null) {
      return false;
    }

    if (this.identifier === null || this.identifier === undefined || this.identifier === '') {
      return false;
    }

    // Double-check identifier is valid
    return this.blueprint.availableSets.includes(this.identifier);
  }

  build() {
    if (!this.isComplete()) {
      throw new Error(
        `Incomplete membership rule: ${
          !this.relation ? 'missing relation' : 
          !this.identifier ? 'missing identifier' : 
          'invalid identifier'
        }`
      );
    }
    return this.blueprint.createRule(this.relation!, this.identifier!);
  }

  getAvailableSets(): readonly string[] {
    return this.blueprint.availableSets;
  }

  /**
   * Gets available set identifiers with their human-readable labels.
   * Useful for building UI dropdowns.
   */
  getAvailableSetsWithLabels(): Array<{ identifier: string; label: string }> {
    return this.blueprint.availableSets.map(id => ({
      identifier: id,
      label: this.blueprint.getSetLabel(id)
    }));
  }
}