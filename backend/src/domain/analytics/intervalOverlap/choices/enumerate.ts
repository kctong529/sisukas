// src/domain/analytics/intervalOverlap/choices/enumerate.ts
import type { CombinationSelection, NormalizedChoiceEntity } from "./types";

/**
 * Enumerate selections in mixed-radix order:
 * entity0 option cycles fastest, then entity1, ...
 *
 * This yields selections without storing all combinations.
 */
export function* enumerateSelections(
  entities: NormalizedChoiceEntity[],
  maxCombinations = Number.POSITIVE_INFINITY
): Generator<CombinationSelection> {
  const n = entities.length;
  if (n === 0) return;

  const radices = entities.map((e) => e.options.length);
  if (radices.some((r) => r <= 0)) return;

  const indices = new Array<number>(n).fill(0);
  let produced = 0;

  while (produced < maxCombinations) {
    yield {
      optionIndexByEntity: [...indices],
      optionIdByEntity: indices.map((idx, i) => entities[i].options[idx]!.id),
    };
    produced++;

    // increment mixed-radix counter
    let carry = 0;
    while (carry < n) {
      indices[carry] += 1;
      if (indices[carry] < radices[carry]) break;
      indices[carry] = 0;
      carry += 1;
    }
    if (carry === n) return; // overflow => done
  }
}
