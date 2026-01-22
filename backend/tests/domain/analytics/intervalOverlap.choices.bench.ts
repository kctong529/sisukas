import { bench, describe } from "vitest";
import { searchTopKCombinations } from "../../../src/domain/analytics/intervalOverlap/choices";
import type { ChoiceEntity } from "../../../src/domain/analytics/intervalOverlap/choices";

type IntervalInput = { start: string; end: string };

/**
 * Deterministic RNG so the benchmark is reproducible.
 */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate entities with ISO intervals.
 * Each entity requires picking exactly one option.
 */
function generateChoiceEntities(params: {
  entities: number;
  optionsPerEntity: number;
  intervalsPerOption: number;
  seed: number;
  baseMs: number;
  windowMs: number;
  maxDurMs: number;
}): ChoiceEntity[] {
  const {
    entities,
    optionsPerEntity,
    intervalsPerOption,
    seed,
    baseMs,
    windowMs,
    maxDurMs,
  } = params;

  const rnd = mulberry32(seed);

  const mkInterval = (): IntervalInput => {
    const startOffset = Math.floor(rnd() * windowMs);
    const dur = 1 + Math.floor(rnd() * maxDurMs);
    const startMs = baseMs + startOffset;
    const endMs = startMs + dur;
    return {
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    };
  };

  const out: ChoiceEntity[] = [];

  for (let e = 0; e < entities; e++) {
    const options = [];
    for (let o = 0; o < optionsPerEntity; o++) {
      const intervals: IntervalInput[] = [];
      for (let k = 0; k < intervalsPerOption; k++) {
        intervals.push(mkInterval());
      }
      options.push({
        id: `E${e}O${o}`,
        intervals,
      });
    }

    out.push({
      id: `E${e}`,
      options,
    });
  }

  return out;
}

describe("intervalOverlap/choices benchmark (full enumeration)", () => {
  // 1-week window, durations up to 3 hours
  const baseMs = Date.parse("2026-01-01T00:00:00.000Z");
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const maxDurMs = 3 * 60 * 60 * 1000;

  // 3^8 = 6,561 combinations
  const entities_3pow8 = generateChoiceEntities({
    entities: 8,
    optionsPerEntity: 3,
    intervalsPerOption: 2,
    seed: 123,
    baseMs,
    windowMs,
    maxDurMs,
  });

  // 3^9 = 19,683 combinations
  const entities_3pow9 = generateChoiceEntities({
    entities: 9,
    optionsPerEntity: 3,
    intervalsPerOption: 2,
    seed: 456,
    baseMs,
    windowMs,
    maxDurMs,
  });

  // 3^10 = 59,049 combinations
  const entities_3pow10 = generateChoiceEntities({
    entities: 10,
    optionsPerEntity: 3,
    intervalsPerOption: 2,
    seed: 789,
    baseMs,
    windowMs,
    maxDurMs,
  });

  bench("choices/searchTopK full (3^8 = 6,561 combos)", () => {
    searchTopKCombinations(entities_3pow8, {
      k: 20,
    });
  });

  bench("choices/searchTopK full (3^9 = 19,683 combos)", () => {
    searchTopKCombinations(entities_3pow9, {
      k: 20,
    });
  });

  bench("choices/searchTopK full (3^10 = 59,049 combos)", () => {
    searchTopKCombinations(entities_3pow10, {
      k: 20,
    });
  });
});
