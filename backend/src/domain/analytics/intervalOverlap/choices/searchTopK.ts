import type { ComputeOptions, OverlapAnalytics } from "../types";
import type {
  ChoiceEntity,
  CombinationResult,
  CombinationSelection,
  NormalizedChoiceEntity,
} from "./types";

import { normalizeChoiceEntities } from "./normalizeChoices";
import { enumerateSelections } from "./enumerate";
import { computeOverlapAnalyticsFromMs, flattenSelectionIntervals } from "./evaluate";

/**
 * Enumerate combinations up to maxCombinations and keep only best K.
 *
 * Default score: totalOverlapMs (lower is better).
 */
export function searchTopKCombinations(
  entitiesRaw: ChoiceEntity[],
  {
    k = 20,
    maxCombinations = Number.POSITIVE_INFINITY,
    overlap = {},
    scoreFn,
  }: {
    k?: number;
    maxCombinations?: number;
    overlap?: ComputeOptions;
    scoreFn?: (analytics: OverlapAnalytics, selection: CombinationSelection) => number;
  } = {}
): {
  top: CombinationResult[];
  evaluated: number;
  normalized: NormalizedChoiceEntity[];
} {
  const normalizedEntities = normalizeChoiceEntities(entitiesRaw);

  const top: CombinationResult[] = [];
  let evaluated = 0;

  for (const selection of enumerateSelections(normalizedEntities, maxCombinations)) {
    evaluated++;

    const flat = flattenSelectionIntervals(normalizedEntities, selection);
    const analytics = computeOverlapAnalyticsFromMs(flat, overlap);
    const score = scoreFn ? scoreFn(analytics, selection) : analytics.totalOverlapMs;

    const result: CombinationResult = { selection, analytics, score };

    // Insert into sorted top-K list (O(K), fine for small K)
    let insertAt = top.findIndex((r) => score < r.score);
    if (insertAt === -1) insertAt = top.length;

    if (top.length < k) {
      top.splice(insertAt, 0, result);
    } else if (insertAt < k) {
      top.splice(insertAt, 0, result);
      top.pop();
    }
  }

  return { top, evaluated, normalized: normalizedEntities };
}
