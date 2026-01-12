/**
 * @module getBuilderFor
 *
 * Provides a type-safe factory function for creating filter rule builders from blueprints.
 *
 * Each blueprint type has a corresponding builder:
 * - TextRuleBlueprint -> TextRuleBuilder
 * - NumericRuleBlueprint -> NumericRuleBuilder
 * - NumericRangeRuleBlueprint -> NumericRangeRuleBuilder
 * - DateRuleBlueprint -> DateRuleBuilder
 * - DateRangeRuleBlueprint -> DateRangeRuleBuilder
 * - CategoricalRuleBlueprint -> CategoricalRuleBuilder
 * - MembershipRuleBlueprint -> MembershipRuleBuilder
 * - PeriodRuleBlueprint -> PeriodRuleBuilder
 *
 * Usage:
 *   const builder = getBuilderFor(RuleBlueprints.name);
 *   builder.setValue('programming');
 *   const rule = builder.build();
 * 
 *
 * The function enforces at compile-time that the correct builder type is returned for each blueprint,
 * which prevents invalid combinations of blueprint and builder.
 */

import { TextRuleBuilder } from "./TextRuleBuilder";
import { NumericRuleBuilder } from "./NumericRuleBuilder";
import { NumericRangeRuleBuilder } from "./NumericRangeRuleBuilder";
import { DateRuleBuilder } from "./DateRuleBuilder";
import { DateRangeRuleBuilder } from "./DateRangeRuleBuilder";
import { CategoricalRuleBuilder } from "./CategoricalRuleBuilder";
import { MembershipRuleBuilder } from "./MembershipRuleBuilder";
import { PeriodRuleBuilder } from './PeriodRuleBuilder';

import type {
  TextRuleBlueprint,
  NumericRuleBlueprint,
  NumericRangeRuleBlueprint,
  DateRuleBlueprint,
  DateRangeRuleBlueprint,
  CategoricalRuleBlueprint,
  MembershipRuleBlueprint,
  PeriodRuleBlueprint
} from "../blueprints";

// Type-safe overloads ensure that each blueprint returns the correct builder type
export function getBuilderFor(blueprint: TextRuleBlueprint): TextRuleBuilder;
export function getBuilderFor(blueprint: NumericRuleBlueprint): NumericRuleBuilder;
export function getBuilderFor(blueprint: NumericRangeRuleBlueprint): NumericRangeRuleBuilder;
export function getBuilderFor(blueprint: DateRuleBlueprint): DateRuleBuilder;
export function getBuilderFor(blueprint: DateRangeRuleBlueprint): DateRangeRuleBuilder;
export function getBuilderFor<T extends string, TEntity>(blueprint: CategoricalRuleBlueprint<T, TEntity>): CategoricalRuleBuilder<T, TEntity>;
export function getBuilderFor<TKey, TEntity>(blueprint: MembershipRuleBlueprint<TKey, TEntity>): MembershipRuleBuilder<TKey, TEntity>;
export function getBuilderFor(blueprint: PeriodRuleBlueprint): PeriodRuleBuilder;

export function getBuilderFor(
  blueprint:
    | TextRuleBlueprint
    | NumericRuleBlueprint
    | NumericRangeRuleBlueprint
    | DateRuleBlueprint
    | DateRangeRuleBlueprint
    | CategoricalRuleBlueprint<string, unknown>
    | MembershipRuleBlueprint<unknown, unknown>
    | PeriodRuleBlueprint
) {
  switch (blueprint.builderType) {
    case 'text': return new TextRuleBuilder(blueprint);
    case 'numericRange': return new NumericRangeRuleBuilder(blueprint);
    case 'numeric': return new NumericRuleBuilder(blueprint);
    case 'date': return new DateRuleBuilder(blueprint);
    case 'dateRange': return new DateRangeRuleBuilder(blueprint);
    case 'categorical': return new CategoricalRuleBuilder(blueprint);
    case 'membership': return new MembershipRuleBuilder(blueprint);
    case 'period': return new PeriodRuleBuilder(blueprint);
    default:
      throw new Error("No builder for unknown blueprint type");
  }
}
