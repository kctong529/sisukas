import { describe, it, expect } from "vitest";

import {
  computeOverlapAnalytics,
  computeTotalOverlapMs,
  msToMinutes,
} from "../../../src/domain/analytics/intervalOverlap";

import { normalizeIntervals } from "../../../src/domain/analytics/intervalOverlap/normalize";
import {
  buildBoundaries,
  getSpan,
  sweepBoundaries,
} from "../../../src/domain/analytics/intervalOverlap/sweep";

/**
 * These tests are structured to mirror the module architecture:
 * - normalize → boundaries → sweep → aggregation
 * - then end-to-end via computeOverlapAnalytics
 */

describe("intervalOverlap / normalizeIntervals", () => {
  it("parses valid ISO intervals and drops invalid ones", () => {
    const { normalized, dropped } = normalizeIntervals([
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
      { start: "not-a-date", end: "2026-01-01T12:00:00Z" },
      { start: "2026-01-01T13:00:00Z", end: "2026-01-01T13:00:00Z" },
    ]);

    expect(normalized.length).toBe(1);
    expect(dropped.length).toBe(2);
    expect(dropped.map(d => d.reason).sort()).toEqual([
      "end<=start",
      "invalid-iso",
    ]);
  });
});

describe("intervalOverlap / buildBoundaries + getSpan", () => {
  it("builds correctly ordered boundary events and computes span", () => {
    const normalized = [
      {
        startMs: Date.parse("2026-01-01T10:00:00Z"),
        endMs: Date.parse("2026-01-01T11:00:00Z"),
      },
      {
        startMs: Date.parse("2026-01-01T10:30:00Z"),
        endMs: Date.parse("2026-01-01T12:00:00Z"),
      },
    ];

    const boundaries = buildBoundaries(normalized);
    const span = getSpan(normalized);

    // 2 intervals → 4 boundary points
    expect(boundaries.length).toBe(4);

    // Boundaries sorted by time, end before start on ties
    expect(boundaries.map(b => b.d)).toEqual([1, 1, -1, -1]);

    expect(span.minStartMs).toBe(
      Date.parse("2026-01-01T10:00:00Z")
    );
    expect(span.maxEndMs).toBe(
      Date.parse("2026-01-01T12:00:00Z")
    );
  });
});

describe("intervalOverlap / sweepBoundaries", () => {
  it("produces correct segments and histogram for simple overlap", () => {
    // A: 10:00–11:00
    // B: 10:30–11:30
    const normalized = [
      {
        startMs: Date.parse("2026-01-01T10:00:00Z"),
        endMs: Date.parse("2026-01-01T11:00:00Z"),
      },
      {
        startMs: Date.parse("2026-01-01T10:30:00Z"),
        endMs: Date.parse("2026-01-01T11:30:00Z"),
      },
    ];

    const boundaries = buildBoundaries(normalized);
    const span = getSpan(normalized);

    const sweep = sweepBoundaries(boundaries, span, {
      dropZeroLengthSegments: true,
      includeGapsWithinSpan: false,
    });

    // Concurrency timeline:
    // 10:00–10:30 → 1
    // 10:30–11:00 → 2
    // 11:00–11:30 → 1
    expect(sweep.segments.map(s => s.concurrent)).toEqual([1, 2, 1]);
    expect(sweep.maxConcurrent).toBe(2);

    expect(msToMinutes(sweep.durationByConcurrentMs[1])).toBe(60);
    expect(msToMinutes(sweep.durationByConcurrentMs[2])).toBe(30);
  });

  it("optionally emits concurrency=0 gaps within the span", () => {
    const normalized = [
      {
        startMs: Date.parse("2026-01-01T10:00:00Z"),
        endMs: Date.parse("2026-01-01T10:30:00Z"),
      },
      {
        startMs: Date.parse("2026-01-01T11:00:00Z"),
        endMs: Date.parse("2026-01-01T11:30:00Z"),
      },
    ];

    const boundaries = buildBoundaries(normalized);
    const span = getSpan(normalized);

    const sweep = sweepBoundaries(boundaries, span, {
      dropZeroLengthSegments: true,
      includeGapsWithinSpan: true,
    });

    // 10:00–10:30 → 1
    // 10:30–11:00 → 0
    // 11:00–11:30 → 1
    expect(sweep.segments.map(s => s.concurrent)).toEqual([1, 0, 1]);
    expect(msToMinutes(sweep.durationByConcurrentMs[0])).toBe(30);
  });
});

describe("intervalOverlap / computeTotalOverlapMs", () => {
  it("sums duration at or above a given concurrency threshold", () => {
    const histogram = {
      0: 10_000,
      1: 20_000,
      2: 30_000,
      3: 40_000,
    };

    expect(computeTotalOverlapMs(histogram, 2)).toBe(70_000);
    expect(computeTotalOverlapMs(histogram, 3)).toBe(40_000);
  });
});

describe("intervalOverlap / computeOverlapAnalytics (end-to-end)", () => {
  it("computes full analytics for a 3-way overlap scenario", () => {
    // A: 10:00–12:00
    // B: 10:30–11:30
    // C: 11:00–13:00
    const res = computeOverlapAnalytics([
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T12:00:00Z" },
      { start: "2026-01-01T10:30:00Z", end: "2026-01-01T11:30:00Z" },
      { start: "2026-01-01T11:00:00Z", end: "2026-01-01T13:00:00Z" },
    ]);

    expect(res.maxConcurrent).toBe(3);

    // overlap >= 2:
    // 10:30–11:00 (30)
    // 11:00–11:30 (30)
    // 11:30–12:00 (30)
    expect(msToMinutes(res.totalOverlapMs)).toBe(90);

    expect(msToMinutes(res.durationByConcurrentMs[1])).toBe(90);
    expect(msToMinutes(res.durationByConcurrentMs[2])).toBe(60);
    expect(msToMinutes(res.durationByConcurrentMs[3])).toBe(30);

    expect(res.segments.map(s => s.concurrent)).toEqual([1, 2, 3, 2, 1]);
  });

  it("handles empty or fully invalid input gracefully", () => {
    const res = computeOverlapAnalytics([
      { start: "bad", end: "bad" },
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T10:00:00Z" },
    ]);

    expect(res.intervalCountInput).toBe(2);
    expect(res.intervalCountUsed).toBe(0);
    expect(res.segments.length).toBe(0);
    expect(res.totalOverlapMs).toBe(0);
  });
});

describe("intervalOverlap edge cases", () => {
  it("single interval: no overlap, maxConcurrent=1, one segment", () => {
    const res = computeOverlapAnalytics([
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
    ]);

    expect(res.maxConcurrent).toBe(1);
    expect(res.totalOverlapMs).toBe(0);
    expect(res.segments.length).toBe(1);
    expect(res.segments[0].concurrent).toBe(1);
    expect(msToMinutes(res.durationByConcurrentMs[1])).toBe(60);
  });

  it("duplicate intervals: overlap equals full duration, maxConcurrent=2", () => {
    const res = computeOverlapAnalytics([
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
    ]);

    expect(res.maxConcurrent).toBe(2);
    expect(msToMinutes(res.totalOverlapMs)).toBe(60);
    expect(res.segments.map(s => s.concurrent)).toEqual([2]);
    expect(msToMinutes(res.durationByConcurrentMs[2])).toBe(60);
  });

  it("nested intervals: peak concurrency occurs only inside the nested range", () => {
    // Outer: 10:00–12:00
    // Inner: 10:30–11:00
    // Overlap >=2: 10:30–11:00 = 30m
    const res = computeOverlapAnalytics([
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T12:00:00Z" },
      { start: "2026-01-01T10:30:00Z", end: "2026-01-01T11:00:00Z" },
    ]);

    expect(res.maxConcurrent).toBe(2);
    expect(msToMinutes(res.totalOverlapMs)).toBe(30);
    expect(res.segments.map(s => s.concurrent)).toEqual([1, 2, 1]);
  });

  it("many intervals with the same start time: tie-handling should not break", () => {
    // All start at 10:00, end at different times:
    // concurrency decreases as each ends.
    const res = computeOverlapAnalytics([
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T10:10:00Z" },
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T10:20:00Z" },
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T10:30:00Z" },
    ]);

    expect(res.maxConcurrent).toBe(3);
    // segments: 10:00–10:10 => 3, 10:10–10:20 => 2, 10:20–10:30 => 1
    expect(res.segments.map(s => s.concurrent)).toEqual([3, 2, 1]);

    // overlap>=2: 10:00–10:20 = 20m
    expect(msToMinutes(res.totalOverlapMs)).toBe(20);
  });

  it("many intervals with the same end time: tie-handling should not break", () => {
    // All end at 11:00, start at different times.
    const res = computeOverlapAnalytics([
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
      { start: "2026-01-01T10:15:00Z", end: "2026-01-01T11:00:00Z" },
      { start: "2026-01-01T10:30:00Z", end: "2026-01-01T11:00:00Z" },
    ]);

    expect(res.maxConcurrent).toBe(3);
    // segments: 10:00–10:15 =>1, 10:15–10:30 =>2, 10:30–11:00 =>3
    expect(res.segments.map(s => s.concurrent)).toEqual([1, 2, 3]);

    // overlap>=2: 10:15–11:00 = 45m
    expect(msToMinutes(res.totalOverlapMs)).toBe(45);
  });

  it("touching chain: A touches B touches C => no overlap", () => {
    const res = computeOverlapAnalytics([
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T10:30:00Z" },
      { start: "2026-01-01T10:30:00Z", end: "2026-01-01T11:00:00Z" },
      { start: "2026-01-01T11:00:00Z", end: "2026-01-01T11:30:00Z" },
    ]);

    expect(res.maxConcurrent).toBe(1);
    expect(res.totalOverlapMs).toBe(0);
  });

  it("end and start at same timestamp: end should be processed before start (no false overlap spike)", () => {
    // A: 10:00–11:00
    // B: 11:00–12:00
    // There should NOT be a moment with concurrency=2.
    const res = computeOverlapAnalytics([
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
      { start: "2026-01-01T11:00:00Z", end: "2026-01-01T12:00:00Z" },
    ]);

    expect(res.maxConcurrent).toBe(1);
    expect(res.durationByConcurrentMs[2]).toBeUndefined();
  });

  it("intervals out of order in input: should not matter", () => {
    const res1 = computeOverlapAnalytics([
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
      { start: "2026-01-01T10:30:00Z", end: "2026-01-01T11:30:00Z" },
    ]);

    const res2 = computeOverlapAnalytics([
      { start: "2026-01-01T10:30:00Z", end: "2026-01-01T11:30:00Z" },
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
    ]);

    expect(res1.totalOverlapMs).toBe(res2.totalOverlapMs);
    expect(res1.maxConcurrent).toBe(res2.maxConcurrent);
    expect(res1.segments.map(s => s.concurrent)).toEqual(
      res2.segments.map(s => s.concurrent)
    );
  });

  it("fractional seconds in ISO timestamps: should handle sub-minute overlap", () => {
    // Overlap: 10:00:00.500Z–10:00:01.000Z => 500ms
    const res = computeOverlapAnalytics([
      { start: "2026-01-01T10:00:00.000Z", end: "2026-01-01T10:00:01.000Z" },
      { start: "2026-01-01T10:00:00.500Z", end: "2026-01-01T10:00:01.500Z" },
    ]);

    expect(res.maxConcurrent).toBe(2);
    expect(res.totalOverlapMs).toBe(500);
  });

  it("includeGapsWithinSpan emits 0-concurrency segments only inside [minStart, maxEnd]", () => {
    const res = computeOverlapAnalytics(
      [
        { start: "2026-01-01T10:00:00Z", end: "2026-01-01T10:10:00Z" },
        { start: "2026-01-01T10:20:00Z", end: "2026-01-01T10:30:00Z" },
      ],
      { includeGapsWithinSpan: true }
    );

    // segments should include a middle gap with concurrent=0
    expect(res.segments.map(s => s.concurrent)).toEqual([1, 0, 1]);
    expect(msToMinutes(res.durationByConcurrentMs[0])).toBe(10);

    // NOTE: we don't emit anything before minStart or after maxEnd
    // (by design of includeGapsWithinSpan)
  });

  it("all invalid => analytics are empty and dropped is populated", () => {
    const res = computeOverlapAnalytics([
      { start: "bad", end: "still bad" },
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T09:00:00Z" }, // end < start
      { start: "2026-01-01T10:00:00Z", end: "2026-01-01T10:00:00Z" }, // end == start
    ]);

    expect(res.intervalCountUsed).toBe(0);
    expect(res.totalOverlapMs).toBe(0);
    expect(res.maxConcurrent).toBe(0);
    expect(res.segments.length).toBe(0);
    expect(res.dropped.length).toBe(3);
  });
});