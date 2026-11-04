import { describe, expect, it } from "vitest";

import { normalizeComputeSchedulePairsResponse } from
  "@application/analytics/normalizeComputeSchedulePairs";

import type { ComputeSchedulePairsResponse } from
  "@infrastructure/services/AnalyticsService";

function makeResponse(
  overrides: Partial<ComputeSchedulePairsResponse> = {}
): ComputeSchedulePairsResponse {
  return {
    top: [],
    evaluated: 0,
    totalPossible: 0,
    capped: false,
    capCombinations: 0,
    warnings: [],
    ...overrides,
  };
}

type BackendCandidate = ComputeSchedulePairsResponse["top"][number];

function makeCandidate(
  overrides: Partial<BackendCandidate> = {}
): BackendCandidate {
  return {
    score: 0,
    totalOverlapMs: 0,
    maxConcurrent: 1,
    selection: [],
    ...overrides,
  };
}

describe("normalizeComputeSchedulePairsResponse", () => {
  it("normalizes an empty response", () => {
    const result = normalizeComputeSchedulePairsResponse(
      makeResponse()
    );

    expect(result).toEqual({
      top: [],
      evaluated: 0,
      totalPossible: 0,
      capped: false,
      capCombinations: 0,
      warnings: [],
    });
  });

  it("preserves backend response metadata", () => {
    const result = normalizeComputeSchedulePairsResponse(
      makeResponse({
        evaluated: 50,
        totalPossible: 200,
        capped: true,
        capCombinations: 50,
      })
    );

    expect(result).toMatchObject({
      evaluated: 50,
      totalPossible: 200,
      capped: true,
      capCombinations: 50,
    });
  });

  it("uses existing defaults for missing metadata", () => {
    // The runtime response may omit fields even though
    // the TypeScript contract declares them as required.
    const response = {
      top: [
        makeCandidate({ score: 10 }),
        makeCandidate({ score: 20 }),
      ],
    } as ComputeSchedulePairsResponse;

    const result = normalizeComputeSchedulePairsResponse(response);

    expect(result).toMatchObject({
      evaluated: 2,
      totalPossible: 2,
      capped: false,
      capCombinations: 0,
      warnings: [],
    });
  });

  it("preserves candidate metrics and selections", () => {
    const selection = [{
      courseInstanceId: "course-1",
      courseCode: "CS-A1000",
      courseName: "Example Course",
      blockId: "block-1",
      blockName: "Lecture",
      studyGroupId: "group-1",
      studyGroupName: "Lecture A",
    }];

    const candidate = makeCandidate({
      score: 85,
      totalOverlapMs: 3_600_000,
      maxConcurrent: 2,
      selection,
      durationByConcurrentMs: {
        1: 7_200_000,
        2: 3_600_000,
      },
      segments: [{
        startMs: 1_000,
        endMs: 2_000,
        concurrent: 2,
        concurrentIds: ["course-1", "course-2"],
      }],
    });

    const result = normalizeComputeSchedulePairsResponse(
      makeResponse({ top: [candidate] })
    );

    expect(result.top).toEqual([candidate]);
  });

  it("defaults missing optional candidate fields", () => {
    const result = normalizeComputeSchedulePairsResponse(
      makeResponse({
        top: [makeCandidate()],
      })
    );

    expect(result.top[0]).toEqual({
      score: 0,
      totalOverlapMs: 0,
      maxConcurrent: 1,
      selection: [],
      durationByConcurrentMs: {},
      segments: [],
    });
  });

  it("preserves candidate and segment ordering", () => {
    const response = makeResponse({
      top: [
        makeCandidate({
          score: 90,
          segments: [
            {
              startMs: 100,
              endMs: 200,
              concurrent: 1,
              concurrentIds: ["a"],
            },
            {
              startMs: 200,
              endMs: 300,
              concurrent: 2,
              concurrentIds: ["a", "b"],
            },
          ],
        }),
        makeCandidate({ score: 50 }),
      ],
    });

    const result = normalizeComputeSchedulePairsResponse(response);

    expect(result.top.map((candidate) => candidate.score))
      .toEqual([90, 50]);

    expect(result.top[0].segments.map((segment) => segment.startMs))
      .toEqual([100, 200]);
  });

  it("preserves known warning codes and maps unknown codes", () => {
    const result = normalizeComputeSchedulePairsResponse(
      makeResponse({
        warnings: [
          { code: "CAP_REACHED", message: "Limit reached" },
          { code: "EMPTY_INPUT", message: "No courses" },
          { code: "INVALID_INPUT", message: "Invalid request" },
          { code: "FUTURE_CODE", message: "Unexpected warning" },
        ],
      })
    );

    expect(result.warnings).toEqual([
      { code: "CAP_REACHED", message: "Limit reached" },
      { code: "EMPTY_INPUT", message: "No courses" },
      { code: "INVALID_INPUT", message: "Invalid request" },
      { code: "INVALID_INPUT", message: "Unexpected warning" },
    ]);
  });

  it("does not mutate the backend response", () => {
    const response = makeResponse({
      warnings: [
        { code: "FUTURE_CODE", message: "Unknown warning" },
      ],
      top: [
        makeCandidate({
          segments: [{
            startMs: 100,
            endMs: 200,
            concurrent: 1,
            concurrentIds: ["course-1"],
          }],
        }),
      ],
    });

    const original = structuredClone(response);

    normalizeComputeSchedulePairsResponse(response);

    expect(response).toEqual(original);
  });
});
