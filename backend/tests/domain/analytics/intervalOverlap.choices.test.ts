import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { ChoiceEntity } from "../../../src/domain/analytics/intervalOverlap/choices";
import {
  enumerateSelections,
  normalizeChoiceEntities,
  flattenSelectionIntervals,
  computeOverlapAnalyticsFromMs,
  searchTopKCombinations,
} from "../../../src/domain/analytics/intervalOverlap/choices";

const MIN = 60_000;
const overlapMinutes = (ms: number) => ms / MIN;

describe("intervalOverlap/choices - enumerateSelections", () => {
  it("enumerates in mixed-radix order (entity0 cycles fastest)", () => {
    const entities = [
      {
        id: "E0",
        options: [
          { id: "E0O0", normalized: [], droppedCount: 0 },
          { id: "E0O1", normalized: [], droppedCount: 0 },
        ],
      },
      {
        id: "E1",
        options: [
          { id: "E1O0", normalized: [], droppedCount: 0 },
          { id: "E1O1", normalized: [], droppedCount: 0 },
        ],
      },
    ];

    const picks = Array.from(enumerateSelections(entities));

    // entity0 cycles fastest:
    // (0,0), (1,0), (0,1), (1,1)
    expect(picks.map(p => p.optionIndexByEntity)).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);

    expect(picks.map(p => p.optionIdByEntity)).toEqual([
      ["E0O0", "E1O0"],
      ["E0O1", "E1O0"],
      ["E0O0", "E1O1"],
      ["E0O1", "E1O1"],
    ]);
  });

  it("respects maxCombinations", () => {
    const entities = [
      { id: "E0", options: [{ id: "a", normalized: [], droppedCount: 0 }, { id: "b", normalized: [], droppedCount: 0 }] },
      { id: "E1", options: [{ id: "c", normalized: [], droppedCount: 0 }, { id: "d", normalized: [], droppedCount: 0 }] },
    ];

    const picks = Array.from(enumerateSelections(entities, 2));
    expect(picks.length).toBe(2);
    expect(picks.map(p => p.optionIndexByEntity)).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it("yields nothing for empty entities or entities with empty options", () => {
    expect(Array.from(enumerateSelections([], 10))).toEqual([]);

    const entitiesWithEmpty = [
      { id: "E0", options: [] as any[] },
    ];
    expect(Array.from(enumerateSelections(entitiesWithEmpty as any, 10))).toEqual([]);
  });
});

describe("intervalOverlap/choices - normalizeChoiceEntities", () => {
  it("normalizes ISO intervals per option and records droppedCount", () => {
    const entities: ChoiceEntity[] = [
      {
        id: "A",
        options: [
          {
            id: "A1",
            intervals: [
              { id: "ev1", start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
              { id: "ev2", start: "bad", end: "2026-01-01T12:00:00Z" }, // dropped
            ],
          },
        ],
      },
    ];

    const normalized = normalizeChoiceEntities(entities);

    expect(normalized).toHaveLength(1);
    expect(normalized[0].id).toBe("A");
    expect(normalized[0].options).toHaveLength(1);

    const opt = normalized[0].options[0];
    expect(opt.id).toBe("A1");
    expect(opt.droppedCount).toBe(1);
    expect(opt.normalized).toHaveLength(1);

    expect(opt.normalized[0].startMs).toBe(Date.parse("2026-01-01T10:00:00Z"));
    expect(opt.normalized[0].endMs).toBe(Date.parse("2026-01-01T11:00:00Z"));
    expect(opt.normalized[0].id).toBe("ev1");
  });
});

describe("intervalOverlap/choices - flattenSelectionIntervals", () => {
  it("flattens selected options in entity order", () => {
    const entities = [
      {
        id: "E0",
        options: [
          {
            id: "E0O0",
            normalized: [{ id: "i1", startMs: 1, endMs: 2 }],
            droppedCount: 0,
          },
          {
            id: "E0O1",
            normalized: [{ id: "i2", startMs: 10, endMs: 20 }],
            droppedCount: 0,
          },
        ],
      },
      {
        id: "E1",
        options: [
          {
            id: "E1O0",
            normalized: [{ id: "i3", startMs: 3, endMs: 4 }],
            droppedCount: 0,
          },
        ],
      },
    ];

    const selection = {
      optionIndexByEntity: [1, 0],
      optionIdByEntity: ["E0O1", "E1O0"],
    };

    const flat = flattenSelectionIntervals(entities as any, selection as any);
    expect(flat).toEqual([
      { id: "i2", startMs: 10, endMs: 20 },
      { id: "i3", startMs: 3, endMs: 4 },
    ]);
  });
});

describe("intervalOverlap/choices - computeOverlapAnalyticsFromMs", () => {
  it("computes overlap from ms intervals (no ISO parsing)", () => {
    // A: [0, 60min), B: [30min, 90min) => overlap 30min
    const t0 = Date.parse("2026-01-01T10:00:00Z");
    const t30 = Date.parse("2026-01-01T10:30:00Z");
    const t60 = Date.parse("2026-01-01T11:00:00Z");
    const t90 = Date.parse("2026-01-01T11:30:00Z");

    const res = computeOverlapAnalyticsFromMs([
      { id: "a", startMs: t0, endMs: t60 },
      { id: "b", startMs: t30, endMs: t90 },
    ]);

    expect(res.maxConcurrent).toBe(2);
    expect(res.totalOverlapMs).toBe(t60 - t30);
    expect(res.segments.map(s => s.concurrent)).toEqual([1, 2, 1]);
  });
});

describe("intervalOverlap/choices - searchTopKCombinations", () => {
  const entities: ChoiceEntity[] = [
    {
      id: "E0",
      options: [
        // E0O0 overlaps with E1O0
        {
          id: "E0O0",
          intervals: [{ id: "ev1", start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" }],
        },
        // E0O1 avoids overlap with E1O0
        {
          id: "E0O1",
          intervals: [{ id: "ev2", start: "2026-01-01T12:00:00Z", end: "2026-01-01T13:00:00Z" }],
        },
      ],
    },
    {
      id: "E1",
      options: [
        // overlaps with E0O0 for 30 mins, does not overlap with E0O1
        {
          id: "E1O0",
          intervals: [{ id: "ev3", start: "2026-01-01T10:30:00Z", end: "2026-01-01T11:30:00Z" }],
        },
        // touches E0O1 at 13:00? actually overlaps if 12:30-13:30 (overlap 30m)
        {
          id: "E1O1",
          intervals: [{ id: "ev4", start: "2026-01-01T12:30:00Z", end: "2026-01-01T13:30:00Z" }],
        },
      ],
    },
  ];

  it("returns top K combinations by default score (min totalOverlapMs)", () => {
    const { top, evaluated } = searchTopKCombinations(entities, {
      k: 4,
      capCombinations: 100,
    });

    expect(evaluated).toBe(4); // 2*2

    // Compute expected overlaps (minutes):
    // (E0O0, E1O0) => 10:30-11:00 => 30m
    // (E0O1, E1O0) => 0m
    // (E0O0, E1O1) => 0m
    // (E0O1, E1O1) => 12:30-13:00 => 30m
    const pickStr = (r: any) => r.selection.optionIdByEntity.join("+");

    // Top is sorted ascending by score
    expect(top.map(pickStr)).toEqual([
      "E0O1+E1O0", // 0 overlap
      "E0O0+E1O1", // 0 overlap
      "E0O0+E1O0", // 30m
      "E0O1+E1O1", // 30m
    ]);

    expect(top[0].score).toBe(0);
    expect(top[1].score).toBe(0);
    expect(top[2].score).toBeGreaterThan(0);
  });

  it("respects maxCombinations budget", () => {
    const { top, evaluated } = searchTopKCombinations(entities, {
      k: 10,
      capCombinations: 2,
    });

    expect(evaluated).toBe(2);
    expect(top.length).toBe(2);
  });

  it("supports custom scoreFn (prefer lower maxConcurrent)", () => {
    const { top } = searchTopKCombinations(entities, {
      k: 2,
      // Score by maxConcurrent first, then overlap (lexicographic)
      scoreFn: (a) => a.maxConcurrent * 1_000_000 + a.totalOverlapMs,
    });

    // With this fixture, there are multiple optimal solutions:
    // any zero-overlap combo has maxConcurrent=1 and overlap=0.
    expect(top).toHaveLength(2);

    expect(top[0].analytics.maxConcurrent).toBe(1);
    expect(top[1].analytics.maxConcurrent).toBe(1);

    expect(top[0].analytics.totalOverlapMs).toBe(0);
    expect(top[1].analytics.totalOverlapMs).toBe(0);

    expect(top[0].score).toBe(1_000_000);
    expect(top[1].score).toBe(1_000_000);
  });
});

describe("intervalOverlap/choices - ISO parsing happens only during normalization", () => {
  const entities: ChoiceEntity[] = [
    {
      id: "E0",
      options: [
        {
          id: "E0O0",
          intervals: [
            { id: "ev1", start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
            { id: "ev2", start: "2026-01-01T12:00:00Z", end: "2026-01-01T13:00:00Z" },
          ],
        },
      ],
    },
    {
      id: "E1",
      options: [
        {
          id: "E1O0",
          intervals: [
            { id: "ev3", start: "2026-01-01T10:30:00Z", end: "2026-01-01T11:30:00Z" },
          ],
        },
      ],
    },
  ];

  let parseSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    parseSpy = vi.spyOn(Date, "parse");
  });

  afterEach(() => {
    parseSpy.mockRestore();
  });

  it("searchTopKCombinations parses ISO only once per interval endpoint", () => {
    // total intervals across all options = 3
    // each interval parses start + end => 6 Date.parse calls expected
    const expectedParseCalls = 3 * 2;

    const { evaluated } = searchTopKCombinations(entities, {
      k: 10,
      capCombinations: 100,
    });

    // 1 option per entity => only 1 combination
    expect(evaluated).toBe(1);

    expect(parseSpy).toHaveBeenCalledTimes(expectedParseCalls);
  });
});

describe("intervalOverlap/choices - end-to-end (more specific fixtures)", () => {
  it("orders top results deterministically when scores are unique (k=4)", () => {
    // Construct a fixture where each combination has a UNIQUE overlap score.
    //
    // E0:
    //  - A: 10:00–11:00
    //  - B: 12:00–13:00
    // E1:
    //  - C: 10:15–10:45 (overlaps A by 30m)
    //  - D: 10:30–11:00 (overlaps A by 30m, but shorter)
    //
    // Combination overlaps:
    //  A+C => 30m
    //  A+D => 30m (still tie!) -> make D overlap 15m instead
    //
    // Let's instead set D: 10:45–11:00 overlap 15m with A.
    //  B+C => 0
    //  B+D => 0
    // Still tie for 0. Make C overlap B by 5m so B+C is unique.
    //
    // New:
    // C: 10:15–10:45 AND 12:55–13:00 (extra 5m overlap with B)
    // D: 10:45–11:00 (15m overlap with A)
    //
    // Overlaps:
    // A+C => 30m
    // A+D => 15m
    // B+C => 5m
    // B+D => 0m
    const entities: ChoiceEntity[] = [
      {
        id: "E0",
        options: [
          { id: "A", intervals: [{ id: "a1", start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" }] },
          { id: "B", intervals: [{ id: "b1", start: "2026-01-01T12:00:00Z", end: "2026-01-01T13:00:00Z" }] },
        ],
      },
      {
        id: "E1",
        options: [
          {
            id: "C",
            intervals: [
              { id: "c1", start: "2026-01-01T10:15:00Z", end: "2026-01-01T10:45:00Z" }, // overlaps A 30m
              { id: "c2", start: "2026-01-01T12:55:00Z", end: "2026-01-01T13:00:00Z" }, // overlaps B 5m
            ],
          },
          { id: "D", intervals: [{ id: "d1", start: "2026-01-01T10:45:00Z", end: "2026-01-01T11:00:00Z" }] }, // overlaps A 15m
        ],
      },
    ];

    const { top, evaluated } = searchTopKCombinations(entities, {
      k: 4,
      capCombinations: 100,
    });

    expect(evaluated).toBe(4);

    const picks = top.map(r => r.selection.optionIdByEntity.join("+"));
    const overlaps = top.map(r => overlapMinutes(r.analytics.totalOverlapMs));

    // Sorted ascending by overlap (default score)
    expect(picks).toEqual([
      "B+D", // 0
      "B+C", // 5
      "A+D", // 15
      "A+C", // 30
    ]);
    expect(overlaps).toEqual([0, 5, 15, 30]);

    // sanity: maxConcurrent should be 1 when overlap=0
    expect(top[0].analytics.maxConcurrent).toBe(1);
    // and 2 for overlap cases
    expect(top[1].analytics.maxConcurrent).toBe(2);
    expect(top[2].analytics.maxConcurrent).toBe(2);
    expect(top[3].analytics.maxConcurrent).toBe(2);
  });

  it("maxCombinations budget returns best among evaluated subset (not global best)", () => {
    // Same fixture as above, but we stop after 2 combinations in enumeration order.
    // Enumeration order for 2x2 is:
    // (E0=0,E1=0) => A+C
    // (E0=1,E1=0) => B+C
    // (E0=0,E1=1) => A+D
    // (E0=1,E1=1) => B+D
    //
    // With maxCombinations=2, we only see:
    //   A+C (30m) and B+C (5m)
    // so best returned should be B+C (5m), even though B+D (0m) exists but is not evaluated.
    const entities: ChoiceEntity[] = [
      {
        id: "E0",
        options: [
          { id: "A", intervals: [{ id: "a1", start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" }] },
          { id: "B", intervals: [{ id: "b1", start: "2026-01-01T12:00:00Z", end: "2026-01-01T13:00:00Z" }] },
        ],
      },
      {
        id: "E1",
        options: [
          {
            id: "C",
            intervals: [
              { id: "c1", start: "2026-01-01T10:15:00Z", end: "2026-01-01T10:45:00Z" },
              { id: "c2", start: "2026-01-01T12:55:00Z", end: "2026-01-01T13:00:00Z" },
            ],
          },
          { id: "D", intervals: [{ id: "d1", start: "2026-01-01T10:45:00Z", end: "2026-01-01T11:00:00Z" }] },
        ],
      },
    ];

    const { top, evaluated } = searchTopKCombinations(entities, {
      k: 1,
      capCombinations: 2,
    });

    expect(evaluated).toBe(2);
    expect(top).toHaveLength(1);
    expect(top[0].selection.optionIdByEntity.join("+")).toBe("B+C");
    expect(overlapMinutes(top[0].analytics.totalOverlapMs)).toBe(5);
  });

  it("invalid intervals in an option are dropped, affecting end-to-end scoring", () => {
    // E0:
    //  - OK: 10:00–11:00
    //  - BAD: invalid interval => dropped => contributes nothing
    //
    // E1: 10:30–11:30
    //
    // OK+E1 => 30m overlap
    // BAD+E1 => 0m overlap (because BAD has no valid intervals)
    const entities: ChoiceEntity[] = [
      {
        id: "E0",
        options: [
          { id: "OK", intervals: [{ id: "ok1", start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" }] },
          { id: "BAD", intervals: [{ id: "bad1", start: "bad", end: "still bad" }] },
        ],
      },
      {
        id: "E1",
        options: [
          { id: "X", intervals: [{ id: "x1", start: "2026-01-01T10:30:00Z", end: "2026-01-01T11:30:00Z" }] },
        ],
      },
    ];

    const { top, normalized } = searchTopKCombinations(entities, { k: 2 });

    // Ensure droppedCount recorded
    const badOpt = normalized[0].options.find(o => o.id === "BAD")!;
    expect(badOpt.droppedCount).toBe(1);
    expect(badOpt.normalized.length).toBe(0);

    // Best should pick BAD because it yields no overlap
    expect(top[0].selection.optionIdByEntity.join("+")).toBe("BAD+X");
    expect(top[0].analytics.totalOverlapMs).toBe(0);

    expect(top[1].selection.optionIdByEntity.join("+")).toBe("OK+X");
    expect(overlapMinutes(top[1].analytics.totalOverlapMs)).toBe(30);
  });

  it("3 entities end-to-end: finds the unique best combination", () => {
    // Goal: make ONLY B + D + F have 0 overlap.
    //
    // E0:
    //  A: 15:15–16:15  (overlaps D and also overlaps C a bit)
    //  B: 14:00–15:00  (touches D at 15:00, no overlap)
    //
    // E1:
    //  C: 14:30–15:30  (overlaps B 30m; overlaps A 15m)
    //  D: 15:00–16:00  (touches B; overlaps A 45m; overlaps E 45m)
    //
    // E2:
    //  E: 15:15–16:15  (overlaps A 60m; overlaps D 45m; overlaps C 15m)
    //  F: 12:00–13:00  (does not overlap B or D)
    //
    // Unique best:
    //  B + D + F => 0 overlap (B touches D, F is separate)
    const entities: ChoiceEntity[] = [
      {
        id: "E0",
        options: [
          { id: "A", intervals: [{ id: "a1", start: "2026-01-01T15:15:00Z", end: "2026-01-01T16:15:00Z" }] },
          { id: "B", intervals: [{ id: "b1", start: "2026-01-01T14:00:00Z", end: "2026-01-01T15:00:00Z" }] },
        ],
      },
      {
        id: "E1",
        options: [
          { id: "C", intervals: [{ id: "c1", start: "2026-01-01T14:30:00Z", end: "2026-01-01T15:30:00Z" }] },
          { id: "D", intervals: [{ id: "d1", start: "2026-01-01T15:00:00Z", end: "2026-01-01T16:00:00Z" }] },
        ],
      },
      {
        id: "E2",
        options: [
          { id: "E", intervals: [{ id: "e1", start: "2026-01-01T15:15:00Z", end: "2026-01-01T16:15:00Z" }] },
          { id: "F", intervals: [{ id: "f1", start: "2026-01-01T12:00:00Z", end: "2026-01-01T13:00:00Z" }] },
        ],
      },
    ];

    const cleanedEntities: ChoiceEntity[] = JSON.parse(JSON.stringify(entities));

    const { top, evaluated } = searchTopKCombinations(cleanedEntities, { k: 1 });

    expect(evaluated).toBe(8); // 2*2*2
    expect(top).toHaveLength(1);
    expect(top[0].selection.optionIdByEntity.join("+")).toBe("B+D+F");
    expect(top[0].analytics.totalOverlapMs).toBe(0);
    expect(top[0].analytics.maxConcurrent).toBe(1);
  });
});

it("many options: returns several top-K combinations (k=5) from a larger search space", () => {
  // 3 entities x 3 options => 27 combinations
  //
  // We create three "time buckets" that align across entities:
  // - Morning bucket:    08:00–09:00
  // - Midday bucket:     12:00–13:00
  // - Afternoon bucket:  16:00–17:00
  //
  // For each entity, option 0/1/2 maps to morning/midday/afternoon.
  // Any combination where all chosen options are from DIFFERENT buckets is overlap-free.
  // There are plenty of 0-overlap solutions, so top-K should be multiple entries with score=0.
  const entities: ChoiceEntity[] = [
    {
      id: "E0",
      options: [
        { id: "E0-M", intervals: [{ id: "e0m1", start: "2026-01-01T08:00:00Z", end: "2026-01-01T09:00:00Z" }] },
        { id: "E0-N", intervals: [{ id: "e0n1", start: "2026-01-01T12:00:00Z", end: "2026-01-01T13:00:00Z" }] },
        { id: "E0-A", intervals: [{ id: "e0a1", start: "2026-01-01T16:00:00Z", end: "2026-01-01T17:00:00Z" }] },
      ],
    },
    {
      id: "E1",
      options: [
        // Slightly shifted windows so overlaps are unambiguous
        { id: "E1-M", intervals: [{ id: "e1m1", start: "2026-01-01T08:15:00Z", end: "2026-01-01T09:15:00Z" }] },
        { id: "E1-N", intervals: [{ id: "e1n1", start: "2026-01-01T12:15:00Z", end: "2026-01-01T13:15:00Z" }] },
        { id: "E1-A", intervals: [{ id: "e1a1", start: "2026-01-01T16:15:00Z", end: "2026-01-01T17:15:00Z" }] },
      ],
    },
    {
      id: "E2",
      options: [
        { id: "E2-M", intervals: [{ id: "e2m1", start: "2026-01-01T08:30:00Z", end: "2026-01-01T09:30:00Z" }] },
        { id: "E2-N", intervals: [{ id: "e2n1", start: "2026-01-01T12:30:00Z", end: "2026-01-01T13:30:00Z" }] },
        { id: "E2-A", intervals: [{ id: "e2a1", start: "2026-01-01T16:30:00Z", end: "2026-01-01T17:30:00Z" }] },
      ],
    },
  ];

  const { top, evaluated } = searchTopKCombinations(entities, { k: 5 });

  expect(evaluated).toBe(27);
  expect(top).toHaveLength(5);

  // Top-K should be sorted by ascending score (default: totalOverlapMs)
  for (let i = 1; i < top.length; i++) {
    expect(top[i - 1].score).toBeLessThanOrEqual(top[i].score);
  }

  // We expect plenty of zero-overlap solutions, so all top 5 should be 0 overlap.
  top.forEach((r) => {
    expect(r.analytics.totalOverlapMs).toBe(0);
    expect(r.analytics.maxConcurrent).toBe(1);
    expect(r.selection.optionIdByEntity).toHaveLength(3);
  });

  // Additional sanity: each returned selection should pick 3 distinct buckets
  // based on the suffix "-M", "-N", "-A".
  const bucket = (id: string) => id.split("-").pop(); // M/N/A
  top.forEach((r) => {
    const buckets = r.selection.optionIdByEntity.map(bucket);
    expect(new Set(buckets).size).toBe(3); // all different => no overlap
  });
});