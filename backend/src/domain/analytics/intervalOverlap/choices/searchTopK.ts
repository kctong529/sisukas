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
    capCombinations = 100_000,
    overlap = {},
    scoreFn,
  }: {
    k?: number;
    capCombinations?: number;
    overlap?: ComputeOptions;
    scoreFn?: (analytics: OverlapAnalytics, selection: CombinationSelection) => number;
  } = {}
): {
  top: CombinationResult[];
  evaluated: number;
  capped: boolean;
  capCombinations: number;
  totalPossible: number;
  normalized: NormalizedChoiceEntity[];
} {
  const normalizedEntities = normalizeChoiceEntities(entitiesRaw);

  const totalPossible = normalizedEntities.reduce(
    (acc, e) => acc * e.options.length,
    1
  );

  const top: CombinationResult[] = [];
  let evaluated = 0;
  let capped = false;

  for (const selection of enumerateSelections(normalizedEntities)) {
    evaluated++;
    if (evaluated > capCombinations) {
      capped = true;
      break;
    }

    const flat = flattenSelectionIntervals(normalizedEntities, selection);
    const analytics = computeOverlapAnalyticsFromMs(flat, overlap);
    const score = scoreFn ? scoreFn(analytics, selection) : analytics.totalOverlapMs;

    const result: CombinationResult = { selection, analytics, score };

    let insertAt = top.findIndex((r) => score < r.score);
    if (insertAt === -1) insertAt = top.length;

    if (top.length < k) {
      top.splice(insertAt, 0, result);
    } else if (insertAt < k) {
      top.splice(insertAt, 0, result);
      top.pop();
    }
  }

  return {
    top,
    evaluated: Math.min(evaluated, capCombinations),
    capped,
    capCombinations,
    totalPossible,
    normalized: normalizedEntities,
  };
}
