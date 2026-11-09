import { describe, expect, it, vi } from "vitest";

import { StudyGroupCache } from "@modules/study-groups/cache/StudyGroupCache";
import { StudyGroupCacheLoader } from "@modules/study-groups/cache/StudyGroupCacheLoader";
import {
  studyGroupKey,
  type StudyGroupRequest,
} from "@modules/study-groups/retrieval/StudyGroupRequest";
import { StudyGroupRequestCancelledError } from "@modules/study-groups/retrieval/StudyGroupRequestCancelledError";
import {
  type StudyGroupBatchResult,
  StudyGroupRequestCoordinator,
} from "@modules/study-groups/retrieval/StudyGroupRequestCoordinator";
import { StudyGroupRetrievalError } from "@modules/study-groups/retrieval/StudyGroupRetrievalError";

import type { StudyGroup } from "@modules/study-groups";

const offeringA: StudyGroupRequest = {
  courseUnitId: "course-unit-a",
  courseOfferingId: "offering-a",
};

const offeringB: StudyGroupRequest = {
  courseUnitId: "course-unit-b",
  courseOfferingId: "offering-b",
};

const keyA = studyGroupKey(offeringA);
const keyB = studyGroupKey(offeringB);

function makeGroup(groupId: string): StudyGroup {
  return {
    groupId,
    name: `Group ${groupId}`,
    type: "Lecture",
    studyEvents: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("StudyGroupCacheLoader", () => {
  it("loads missing offerings and preserves successful emptiness", async () => {
    const groups = [makeGroup("lecture-1")];

    const transport = vi.fn(async () => new Map([
      [keyA, groups],
      [keyB, [] as StudyGroup[]],
    ]));

    const cache = new StudyGroupCache();
    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 1_000,
    });

    await loader.ensure([offeringA, offeringB]);

    expect(cache.get(keyA)).toEqual({
      groups,
      status: "ready",
      fetchedAt: 1_000,
      error: null,
      refreshing: false,
    });

    expect(cache.get(keyB)).toEqual({
      groups: [],
      status: "ready",
      fetchedAt: 1_000,
      error: null,
      refreshing: false,
    });

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("reuses cached full data without another transport request", async () => {
    const transport = vi.fn(async () => new Map([
      [keyA, [makeGroup("lecture-1")]],
    ]));

    const cache = new StudyGroupCache();
    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 1_000,
    });

    await loader.ensure([offeringA]);
    await loader.ensure([offeringA]);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(cache.get(keyA).status).toBe("ready");
  });

  it("joins shared in-flight retrieval across callers", async () => {
    const pending = deferred<StudyGroupBatchResult>();
    const transport = vi.fn(() => pending.promise);

    const cache = new StudyGroupCache();
    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 1_000,
    });

    const first = loader.ensure([offeringA]);
    const second = loader.ensure([offeringA]);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    expect(cache.get(keyA).status).toBe("loading");

    pending.resolve(new Map([
      [keyA, [makeGroup("lecture-1")]],
    ]));

    await Promise.all([first, second]);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(cache.get(keyA).status).toBe("ready");
  });

  it("updates successful offerings before other offerings settle", async () => {
    const firstBatch = deferred<StudyGroupBatchResult>();
    const secondBatch = deferred<StudyGroupBatchResult>();

    const transport = vi.fn()
      .mockImplementationOnce(() => firstBatch.promise)
      .mockImplementationOnce(() => secondBatch.promise);

    const cache = new StudyGroupCache();
    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      chunkSize: 1,
      concurrency: 2,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 1_000,
    });

    const load = loader.ensure([offeringA, offeringB]);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(2);
    });

    firstBatch.resolve(new Map([
      [keyA, [makeGroup("lecture-1")]],
    ]));

    await vi.waitFor(() => {
      expect(cache.get(keyA).status).toBe("ready");
    });

    expect(cache.get(keyB).status).toBe("loading");

    // Omitted offering B must become a failure, not empty success.
    secondBatch.resolve(new Map());

    await load;

    expect(cache.get(keyA).groups).toEqual([
      makeGroup("lecture-1"),
    ]);

    expect(cache.get(keyB)).toMatchObject({
      groups: null,
      status: "failed",
      fetchedAt: null,
      error: new StudyGroupRetrievalError().message,
      refreshing: false,
    });
  });

  it("retains cached data and timestamp when refresh fails", async () => {
    const pending = deferred<StudyGroupBatchResult>();
    const transport = vi.fn(() => pending.promise);

    const cache = new StudyGroupCache();
    const previous = [makeGroup("lecture-1")];

    cache.markReady(keyA, previous, 1_000);

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 2_000,
    });

    const refresh = loader.refresh([offeringA]);

    expect(cache.get(keyA)).toEqual({
      groups: previous,
      status: "ready",
      fetchedAt: 1_000,
      error: null,
      refreshing: true,
    });

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    pending.reject(new Error("HTTP 502"));

    await refresh;

    expect(cache.get(keyA)).toEqual({
      groups: previous,
      status: "ready",
      fetchedAt: 1_000,
      error: "HTTP 502",
      refreshing: false,
    });
  });

  it("retries a failed initial load and stores recovered data", async () => {
    const transport = vi.fn()
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce(new Map([
        [keyA, [makeGroup("lecture-1")]],
      ]));

    const cache = new StudyGroupCache();
    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 3_000,
    });

    await loader.ensure([offeringA]);

    expect(cache.get(keyA)).toMatchObject({
      groups: null,
      status: "failed",
      error: "Temporary failure",
    });

    await loader.ensure([offeringA]);

    expect(transport).toHaveBeenCalledTimes(2);
    expect(cache.get(keyA)).toEqual({
      groups: [makeGroup("lecture-1")],
      status: "ready",
      fetchedAt: 3_000,
      error: null,
      refreshing: false,
    });
  });

  it("prevents obsolete completions from restoring cleared data", async () => {
    const pending = deferred<StudyGroupBatchResult>();
    const transport = vi.fn(() => pending.promise);

    const cache = new StudyGroupCache();
    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 1_000,
    });

    const load = loader.ensure([offeringA]);

    // Attach the rejection assertion before triggering cancellation.
    const cancelled = expect(load).rejects.toBeInstanceOf(
      StudyGroupRequestCancelledError,
    );

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    loader.clear();

    await cancelled;

    expect(cache.get(keyA).status).toBe("missing");

    // The physical transport is still allowed to finish.
    pending.resolve(new Map([
      [keyA, [makeGroup("obsolete")]],
    ]));

    await Promise.resolve();
    await Promise.resolve();

    expect(cache.get(keyA)).toEqual({
      groups: null,
      status: "missing",
      fetchedAt: null,
      error: null,
      refreshing: false,
    });
  });

  it("shares pending work across overlapping ensure and refresh calls", async () => {
    const pending = deferred<StudyGroupBatchResult>();
    const transport = vi.fn(() => pending.promise);

    const cache = new StudyGroupCache();
    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 1_000,
    });

    const first = loader.ensure([offeringA]);
    const second = loader.refresh([offeringA]);
    const third = loader.ensure([offeringA]);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    expect(cache.get(keyA)).toMatchObject({
      groups: null,
      status: "loading",
      refreshing: false,
    });

    pending.resolve(new Map([
      [keyA, [makeGroup("lecture-1")]],
    ]));

    await Promise.all([first, second, third]);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(cache.get(keyA)).toEqual({
      groups: [makeGroup("lecture-1")],
      status: "ready",
      fetchedAt: 1_000,
      error: null,
      refreshing: false,
    });
  });

  it("deduplicates repeated offerings within a loader invocation", async () => {
    const transport = vi.fn(
      async (requests: StudyGroupRequest[]): Promise<StudyGroupBatchResult> => {
        expect(requests).toEqual([offeringA, offeringB]);

        return new Map([
          [keyA, [makeGroup("lecture-1")]],
          [keyB, []],
        ]);
      },
    );

    const cache = new StudyGroupCache();
    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 1_000,
    });

    await loader.ensure([
      offeringA,
      offeringA,
      offeringB,
      offeringA,
      offeringB,
    ]);

    expect(transport).toHaveBeenCalledTimes(1);

    const dispatched = transport.mock.calls[0][0];

    expect(dispatched).toEqual([offeringA, offeringB]);

    expect(cache.get(keyA).groups).toEqual([
      makeGroup("lecture-1"),
    ]);
    expect(cache.get(keyB).groups).toEqual([]);
  });

  it("loads missing and failed offerings through explicit refresh", async () => {
    const transport = vi.fn(async () => new Map([
      [keyA, [] as StudyGroup[]],
      [keyB, [makeGroup("lecture-1")]],
    ]));

    const cache = new StudyGroupCache();
    cache.markFailed(keyB, new Error("Previous failure"));

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 2_000,
    });

    await loader.refresh([offeringA, offeringB]);

    expect(transport).toHaveBeenCalledTimes(1);

    expect(cache.get(keyA)).toEqual({
      groups: [],
      status: "ready",
      fetchedAt: 2_000,
      error: null,
      refreshing: false,
    });

    expect(cache.get(keyB)).toEqual({
      groups: [makeGroup("lecture-1")],
      status: "ready",
      fetchedAt: 2_000,
      error: null,
      refreshing: false,
    });
  });

  it("updates successful refreshes without discarding failed refresh data", async () => {
    const transport = vi.fn(async () => new Map([
      [keyA, [makeGroup("updated-lecture")]],
      // Offering B intentionally omitted.
    ]));

    const cache = new StudyGroupCache();
    const previousA = [makeGroup("old-lecture")];
    const previousB = [makeGroup("old-exercise")];

    cache.markReady(keyA, previousA, 1_000);
    cache.markReady(keyB, previousB, 1_500);

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 3_000,
    });

    await loader.refresh([offeringA, offeringB]);

    expect(cache.get(keyA)).toEqual({
      groups: [makeGroup("updated-lecture")],
      status: "ready",
      fetchedAt: 3_000,
      error: null,
      refreshing: false,
    });

    expect(cache.get(keyB)).toEqual({
      groups: previousB,
      status: "ready",
      fetchedAt: 1_500,
      error: new StudyGroupRetrievalError().message,
      refreshing: false,
    });

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("does not let an obsolete completion overwrite a reload", async () => {
    const oldBatch = deferred<StudyGroupBatchResult>();
    const newBatch = deferred<StudyGroupBatchResult>();

    const transport = vi.fn()
      .mockImplementationOnce(() => oldBatch.promise)
      .mockImplementationOnce(() => newBatch.promise);

    const cache = new StudyGroupCache();
    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      concurrency: 1,
      chunkSize: 1,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => 2_000,
    });

    const obsoleteLoad = loader.ensure([offeringA]);
    const cancelled = expect(obsoleteLoad).rejects.toBeInstanceOf(
      StudyGroupRequestCancelledError,
    );

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    loader.clear();
    await cancelled;

    const freshLoad = loader.ensure([offeringA]);

    // The obsolete physical transport still occupies the only slot.
    expect(transport).toHaveBeenCalledTimes(1);
    expect(cache.get(keyA).status).toBe("loading");

    oldBatch.resolve(new Map([
      [keyA, [makeGroup("obsolete")]],
    ]));

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(2);
    });

    // Old results must not populate the new cache generation.
    expect(cache.get(keyA)).toMatchObject({
      groups: null,
      status: "loading",
    });

    newBatch.resolve(new Map([
      [keyA, [makeGroup("fresh")]],
    ]));

    await freshLoad;

    expect(cache.get(keyA)).toEqual({
      groups: [makeGroup("fresh")],
      status: "ready",
      fetchedAt: 2_000,
      error: null,
      refreshing: false,
    });
  });

  it("does not leave entries loading when outcome application throws", async () => {
    const transport = vi.fn(async () => new Map([
      [keyA, [makeGroup("lecture-1")]],
    ]));

    const cache = new StudyGroupCache();
    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });
    const loader = new StudyGroupCacheLoader({
      cache,
      coordinator,
      now: () => {
        throw new Error("Clock unavailable");
      },
    });

    await loader.ensure([offeringA]);

    expect(transport).toHaveBeenCalledTimes(1);

    expect(cache.get(keyA)).toMatchObject({
      groups: null,
      status: "failed",
      error: "Clock unavailable",
      refreshing: false,
    });
  });
});
