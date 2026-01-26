// src/domain/analytics/intervalOverlap/choices/normalizeChoices.ts
import type { ChoiceEntity, NormalizedChoiceEntity } from "./types";
import { normalizeIntervals } from "../normalize";

/**
 * Normalize all entities/options once (ISO parsing happens here).
 * Returns ms intervals per option so the hot loop never parses ISO.
 */
export function normalizeChoiceEntities(
  entities: ChoiceEntity[]
): NormalizedChoiceEntity[] {
  return entities.map((entity) => ({
    id: entity.id,
    options: entity.options.map((opt) => {
      const { normalized, dropped } = normalizeIntervals(opt.intervals);
      return {
        id: opt.id,
        normalized,
        droppedCount: dropped.length,
      };
    }),
  }));
}
