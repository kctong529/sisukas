import { bench, describe } from "vitest";
import { computeOverlapAnalytics } from "../../../src/domain/analytics/intervalOverlap";

type IntervalInput = { start: string; end: string };

/**
 * Deterministic RNG so benchmark runs are reproducible.
 * (Avoids "it was fast yesterday but slow today" confusion.)
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
 * Generate random intervals within a window.
 *
 * - baseMs: start of the overall window
 * - windowMs: how wide the window is
 * - maxDurMs: max interval duration
 */
function generateRandomIntervals(
  n: number,
  seed: number,
  baseMs: number,
  windowMs: number,
  maxDurMs: number
): IntervalInput[] {
  const rnd = mulberry32(seed);
  const intervals: IntervalInput[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const startOffset = Math.floor(rnd() * windowMs);
    const dur = 1 + Math.floor(rnd() * maxDurMs); // ensure end > start
    const startMs = baseMs + startOffset;
    const endMs = startMs + dur;

    intervals[i] = {
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    };
  }

  return intervals;
}

describe("intervalOverlap benchmark", () => {
  // 1-week window, durations up to 3 hours
  const baseMs = Date.parse("2026-01-01T00:00:00.000Z");
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const maxDurMs = 3 * 60 * 60 * 1000;

  // Prepare once so benchmark measures analytics (not generation).
  const small = generateRandomIntervals(1_000, 123, baseMs, windowMs, maxDurMs);
  const medium = generateRandomIntervals(10_000, 123, baseMs, windowMs, maxDurMs);
  const large = generateRandomIntervals(50_000, 123, baseMs, windowMs, maxDurMs);

  bench("computeOverlapAnalytics (1k intervals)", () => {
    computeOverlapAnalytics(small);
  });

  bench("computeOverlapAnalytics (10k intervals)", () => {
    computeOverlapAnalytics(medium);
  });

  bench("computeOverlapAnalytics (50k intervals)", () => {
    computeOverlapAnalytics(large);
  });
});
