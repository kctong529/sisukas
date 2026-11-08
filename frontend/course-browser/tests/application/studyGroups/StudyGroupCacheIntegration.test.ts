import { describe, expect, it, vi } from "vitest";
import type { StudyGroup } from "@domain/models/StudyGroup";
import { StudyGroupCache } from "@modules/study-groups/cache/StudyGroupCache";
import type { StudyGroupCacheChange } from "@modules/study-groups/cache/StudyGroupCache";
import { StudyGroupCacheLoader } from "@application/studyGroups/StudyGroupCacheLoader";
import {
  StudyGroupRequestCoordinator,
  type StudyGroupBatchResult,
} from "@application/studyGroups/StudyGroupRequestCoordinator";
import {
  studyGroupKey,
  type StudyGroupRequest,
} from "@application/studyGroups/StudyGroupRequest";
import { StudyGroupRequestCancelledError } from "@application/studyGroups/StudyGroupRequestCancelledError";

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

function createSystem(
  transport: (
    requests: StudyGroupRequest[],
  ) => Promise<StudyGroupBatchResult>,
  concurrency = 2,
) {
  const cache = new StudyGroupCache();

  const coordinator = new StudyGroupRequestCoordinator({
    transport,
    chunkSize: 1,
    concurrency,
  });

  const loader = new StudyGroupCacheLoader({
    cache,
    coordinator,
    now: () => 2_000,
  });

  return { cache, coordinator, loader };
}

describe("StudyGroupCache application integration", () => {
  it("notifies successful offerings before other batches fail", async () => {
    const batchA = deferred<StudyGroupBatchResult>();
    const batchB = deferred<StudyGroupBatchResult>();

    const transport = vi.fn(
      (requests: StudyGroupRequest[]): Promise<StudyGroupBatchResult> => {
        const key = studyGroupKey(requests[0]);

        if (key === keyA) {
          return batchA.promise;
        }

        if (key === keyB) {
          return batchB.promise;
        }

        throw new Error(`Unexpected offering: ${key}`);
      },
    );

    const { cache, loader } = createSystem(transport);

    const observed: Array<{
      change: StudyGroupCacheChange;
      status?: string;
      groups?: StudyGroup[] | null;
      error?: string | null;
    }> = [];

    cache.subscribe((change) => {
      if (change.type === "clear") {
        observed.push({ change });
        return;
      }

      const entry = cache.get(change.key);

      observed.push({
        change,
        status: entry.status,
        groups: entry.groups,
        error: entry.error,
      });
    });

    const loading = loader.ensure([offeringA, offeringB]);

    // Both entries transition synchronously into loading.
    expect(cache.get(keyA).status).toBe("loading");
    expect(cache.get(keyB).status).toBe("loading");

    expect(observed).toHaveLength(2);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(2);
    });

    // A succeeds while B's physical request remains unresolved.
    batchA.resolve(
      new Map([[keyA, [makeGroup("lecture-1")]]]),
    );

    await vi.waitFor(() => {
      expect(cache.get(keyA).status).toBe("ready");
    });

    expect(cache.get(keyA).groups).toEqual([
      makeGroup("lecture-1"),
    ]);

    expect(cache.get(keyB).status).toBe("loading");

    // A's ready notification has already been published.
    expect(observed).toContainEqual({
      change: { type: "entry", key: keyA },
      status: "ready",
      groups: [makeGroup("lecture-1")],
      error: null,
    });

    // B fails independently.
    batchB.reject(new Error("HTTP 502"));

    await loading;

    expect(cache.get(keyA)).toMatchObject({
      status: "ready",
      fetchedAt: 2_000,
      error: null,
    });

    expect(cache.get(keyB)).toMatchObject({
      groups: null,
      status: "failed",
      error: "HTTP 502",
    });

    expect(observed).toContainEqual({
      change: { type: "entry", key: keyB },
      status: "failed",
      groups: null,
      error: "HTTP 502",
    });

    expect(observed.map(({ change, status }) => ({
      change,
      status,
    }))).toEqual([
      { change: { type: "entry", key: keyA }, status: "loading" },
      { change: { type: "entry", key: keyB }, status: "loading" },
      { change: { type: "entry", key: keyA }, status: "ready" },
      { change: { type: "entry", key: keyB }, status: "failed" },
    ]);
  });

  it("shares one retrieval and one set of cache transitions", async () => {
    const batch = deferred<StudyGroupBatchResult>();

    const transport = vi.fn(
      (requests: StudyGroupRequest[]): Promise<StudyGroupBatchResult> => {
        expect(requests).toEqual([offeringA]);
        return batch.promise;
      },
    );

    const { cache, loader } = createSystem(transport);
    const changes: StudyGroupCacheChange[] = [];

    cache.subscribe((change) => {
      changes.push(change);
    });

    const first = loader.ensure([offeringA]);
    const second = loader.ensure([offeringA]);
    const third = loader.refresh([offeringA]);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    expect(cache.get(keyA).status).toBe("loading");

    batch.resolve(
      new Map([[keyA, [makeGroup("lecture-1")]]]),
    );

    await Promise.all([first, second, third]);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(cache.get(keyA).status).toBe("ready");

    // Shared retrieval must not duplicate cache writes.
    expect(changes).toEqual([
      { type: "entry", key: keyA },
      { type: "entry", key: keyA },
    ]);

    // Subsequent ensure reads the available full data.
    await loader.ensure([offeringA]);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(changes).toHaveLength(2);
  });

  it("broadcasts clear and ignores an obsolete completion", async () => {
    const obsoleteBatch = deferred<StudyGroupBatchResult>();
    const freshBatch = deferred<StudyGroupBatchResult>();

    const transport = vi.fn(
      (requests: StudyGroupRequest[]): Promise<StudyGroupBatchResult> => {
        expect(requests).toEqual([offeringA]);

        return transport.mock.calls.length === 1
          ? obsoleteBatch.promise
          : freshBatch.promise;
      },
    );

    // One active batch slot ensures the obsolete physical
    // request remains relevant to scheduling after clear().
    const { cache, loader } = createSystem(transport, 1);

    const changes: StudyGroupCacheChange[] = [];

    cache.subscribe((change) => {
      changes.push(change);
    });

    const obsoleteLoad = loader.ensure([offeringA]);

    // Attach a rejection handler before cancelling.
    const cancelled = expect(obsoleteLoad).rejects.toBeInstanceOf(
      StudyGroupRequestCancelledError,
    );

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    loader.clear();

    await cancelled;

    expect(cache.get(keyA).status).toBe("missing");

    expect(changes).toContainEqual({
      type: "clear",
    });

    const freshLoad = loader.ensure([offeringA]);

    expect(cache.get(keyA).status).toBe("loading");

    // The old network response arrives after the reset.
    obsoleteBatch.resolve(
      new Map([[keyA, [makeGroup("obsolete")]]]),
    );

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(2);
    });

    // The obsolete result must not restore stale groups.
    expect(cache.get(keyA)).toMatchObject({
      groups: null,
      status: "loading",
    });

    freshBatch.resolve(
      new Map([[keyA, [makeGroup("fresh")]]]),
    );

    await freshLoad;

    expect(cache.get(keyA)).toMatchObject({
      groups: [makeGroup("fresh")],
      status: "ready",
      fetchedAt: 2_000,
    });

    expect(changes).toEqual([
      { type: "entry", key: keyA }, // Initial loading
      { type: "clear" },            // Global reset
      { type: "entry", key: keyA }, // Fresh loading
      { type: "entry", key: keyA }, // Fresh success
    ]);
  });
});
