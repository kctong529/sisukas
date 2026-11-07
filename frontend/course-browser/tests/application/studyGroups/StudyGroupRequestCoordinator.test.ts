import { describe, expect, it, vi } from "vitest";

import {
  StudyGroupRequestCoordinator,
} from "@application/studyGroups/StudyGroupRequestCoordinator";

import {
  studyGroupKey,
  type StudyGroupRequest,
} from "@application/studyGroups/StudyGroupRequest";

import {
  StudyGroupRequestCancelledError,
} from "@application/studyGroups/StudyGroupRequestCancelledError";

import {
  StudyGroupRetrievalError,
} from "@application/studyGroups/StudyGroupRetrievalError";

import type { StudyGroup } from "@domain/models/StudyGroup";

type BatchResult = Map<string, StudyGroup[]>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const offeringA: StudyGroupRequest = {
  courseUnitId: "unit-1",
  courseOfferingId: "offering-a",
};

const offeringB: StudyGroupRequest = {
  courseUnitId: "unit-1",
  courseOfferingId: "offering-b",
};

describe("StudyGroupRequestCoordinator", () => {
  it("deduplicates simultaneous requests for the same offering", async () => {
    const pending = deferred<BatchResult>();
    const transport = vi.fn(() => pending.promise);

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const first = coordinator.load([offeringA]);
    const second = coordinator.load([offeringA]);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    expect(transport).toHaveBeenCalledWith([offeringA]);

    pending.resolve(new Map([
      [studyGroupKey(offeringA), []],
    ]));

    const [firstResult, secondResult] = await Promise.all([
      first,
      second,
    ]);

    expect(firstResult.get(studyGroupKey(offeringA))).toEqual([]);
    expect(secondResult.get(studyGroupKey(offeringA))).toEqual([]);
  });

  it("allows another consumer to join an in-flight request", async () => {
    const pending = deferred<BatchResult>();
    const transport = vi.fn(() => pending.promise);

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const first = coordinator.load([offeringA]);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    // The transport has started but has not completed.
    const second = coordinator.load([offeringA]);

    expect(transport).toHaveBeenCalledTimes(1);

    pending.resolve(new Map([
      [studyGroupKey(offeringA), []],
    ]));

    await Promise.all([first, second]);

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("preserves independent offering results within a shared batch", async () => {
    const transport = vi.fn(async (requests: StudyGroupRequest[]) =>
      new Map(
        requests.map((request) => [
          studyGroupKey(request),
          [] as StudyGroup[],
        ]),
      ),
    );

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const [first, second] = await Promise.all([
      coordinator.load([offeringA]),
      coordinator.load([offeringB]),
    ]);

    expect(first.has(studyGroupKey(offeringA))).toBe(true);
    expect(first.has(studyGroupKey(offeringB))).toBe(false);

    expect(second.has(studyGroupKey(offeringB))).toBe(true);
    expect(second.has(studyGroupKey(offeringA))).toBe(false);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith([
      offeringA,
      offeringB,
    ]);
  });

  it("preserves an empty response as a successful result", async () => {
    const transport = vi.fn(async () => new Map([
      [studyGroupKey(offeringA), [] as StudyGroup[]],
    ]));

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const result = await coordinator.load([offeringA]);

    expect(result.has(studyGroupKey(offeringA))).toBe(true);
    expect(result.get(studyGroupKey(offeringA))).toEqual([]);
  });

  it("coalesces requests from synchronous callers into one batch", async () => {
    const transport = vi.fn(async (requests: StudyGroupRequest[]) =>
      new Map(requests.map((request) => [
        studyGroupKey(request),
        [] as StudyGroup[],
      ])),
    );

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      chunkSize: 20,
      concurrency: 2,
    });

    const first = coordinator.load([offeringA]);
    const second = coordinator.load([offeringB]);

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith([offeringA, offeringB]);
    expect(firstResult.has(studyGroupKey(offeringA))).toBe(true);
    expect(secondResult.has(studyGroupKey(offeringB))).toBe(true);
  });

  it("splits a large request into batches no larger than chunkSize", async () => {
    const offerings: StudyGroupRequest[] = Array.from(
      { length: 5 },
      (_, index) => ({
        courseUnitId: "unit-1",
        courseOfferingId: `offering-${index}`,
      }),
    );

    const transport = vi.fn(async (requests: StudyGroupRequest[]) =>
      new Map(requests.map((request) => [
        studyGroupKey(request),
        [] as StudyGroup[],
      ])),
    );

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      chunkSize: 2,
      concurrency: 2,
    });

    const result = await coordinator.load(offerings);

    expect(transport).toHaveBeenCalledTimes(3);
    expect(transport.mock.calls.map(([requests]) => requests.length)).toEqual([
      2,
      2,
      1,
    ]);
    expect(result.size).toBe(5);
  });

  it("enforces one concurrency limit across separate load calls", async () => {
    const pending: Array<{
      requests: StudyGroupRequest[];
      operation: ReturnType<typeof deferred<BatchResult>>;
    }> = [];

    let active = 0;
    let maximumActive = 0;

    const transport = vi.fn((requests: StudyGroupRequest[]) => {
      active++;
      maximumActive = Math.max(maximumActive, active);

      const operation = deferred<BatchResult>();

      pending.push({ requests, operation });

      return operation.promise.finally(() => {
        active--;
      });
    });

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      chunkSize: 1,
      concurrency: 2,
    });

    // Test-only helper
    function completeBatch(index: number): void {
      const { requests, operation } = pending[index];

      operation.resolve(
        new Map(
          requests.map((request) => [
            studyGroupKey(request),
            [] as StudyGroup[],
          ]),
        ),
      );
    }

    const offerings = Array.from({ length: 5 }, (_, index) => ({
      courseUnitId: "unit-1",
      courseOfferingId: `offering-${index}`,
    }));

    const loads = offerings.map((request) => coordinator.load([request]));

    // Allow the scheduled dispatch to start.
    await vi.waitFor(() => {
      expect(pending).toHaveLength(2);
    });

    expect(maximumActive).toBe(2);
    expect(transport).toHaveBeenCalledTimes(2);

    completeBatch(0);
    completeBatch(1);

    await vi.waitFor(() => {
      expect(pending).toHaveLength(4);
    });

    expect(maximumActive).toBe(2);

    completeBatch(2);
    completeBatch(3);

    await vi.waitFor(() => {
      expect(pending).toHaveLength(5);
    });

    completeBatch(4);

    await Promise.all(loads);

    expect(maximumActive).toBe(2);
    expect(active).toBe(0);
    expect(transport).toHaveBeenCalledTimes(5);
  });

  it("does not let duplicate requests consume additional batch slots", async () => {
    const pending = deferred<BatchResult>();
    const transport = vi.fn(() => pending.promise);

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      chunkSize: 1,
      concurrency: 1,
    });

    const first = coordinator.load([offeringA]);
    const second = coordinator.load([offeringA]);
    const third = coordinator.load([offeringA]);

    // Let dispatch start.
    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    expect(transport).toHaveBeenCalledWith([offeringA]);

    pending.resolve(new Map([
      [studyGroupKey(offeringA), []],
    ]));

    await Promise.all([first, second, third]);

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("starts queued batches when an active batch finishes", async () => {
    const firstBatch = deferred<BatchResult>();
    const secondBatch = deferred<BatchResult>();

    const transport = vi.fn()
      .mockImplementationOnce(() => firstBatch.promise)
      .mockImplementationOnce(() => secondBatch.promise);

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      chunkSize: 1,
      concurrency: 1,
    });

    const first = coordinator.load([offeringA]);
    const second = coordinator.load([offeringB]);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    expect(transport).toHaveBeenCalledWith([offeringA]);

    firstBatch.resolve(new Map([
      [studyGroupKey(offeringA), []],
    ]));

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(2);
    });

    expect(transport).toHaveBeenNthCalledWith(2, [offeringB]);

    secondBatch.resolve(new Map([
      [studyGroupKey(offeringB), []],
    ]));

    await Promise.all([first, second]);
  });

  it("treats an explicitly empty response as successful", async () => {
    const transport = vi.fn(async () => new Map([
      [studyGroupKey(offeringA), [] as StudyGroup[]],
    ]));

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const result = await coordinator.load([offeringA]);

    expect(result.has(studyGroupKey(offeringA))).toBe(true);
    expect(result.get(studyGroupKey(offeringA))).toEqual([]);
  });

  it("rejects when a requested offering is missing from the response", async () => {
    const transport = vi.fn(async () => new Map<string, StudyGroup[]>());

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    await expect(
      coordinator.load([offeringA]),
    ).rejects.toBeInstanceOf(StudyGroupRetrievalError);

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("settles successful offerings independently of omitted offerings", async () => {
    const transport = vi.fn(async () => new Map([
      [studyGroupKey(offeringA), [] as StudyGroup[]],
    ]));

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const [successful, missing] = await Promise.allSettled([
      coordinator.load([offeringA]),
      coordinator.load([offeringB]),
    ]);

    expect(successful.status).toBe("fulfilled");
    if (successful.status === "fulfilled") {
      expect(successful.value.has(studyGroupKey(offeringA))).toBe(true);
    }

    expect(missing.status).toBe("rejected");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith([offeringA, offeringB]);
  });

  it("rejects a failed transport and releases its scheduler slot", async () => {
    const transport = vi.fn()
      .mockRejectedValueOnce(new Error("upstream unavailable"))
      .mockResolvedValueOnce(new Map([
        [studyGroupKey(offeringB), []],
      ]));

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      chunkSize: 1,
      concurrency: 1,
    });

    const first = coordinator.load([offeringA]);
    const second = coordinator.load([offeringB]);

    await expect(first).rejects.toThrow("upstream unavailable");
    await expect(second).resolves.toEqual(
      new Map([[studyGroupKey(offeringB), []]]),
    );

    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("allows retrying an offering after a failed retrieval", async () => {
    const transport = vi.fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(new Map([
        [studyGroupKey(offeringA), []],
      ]));

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    await expect(coordinator.load([offeringA])).rejects.toThrow(
      "temporary failure",
    );

    await expect(coordinator.load([offeringA])).resolves.toEqual(
      new Map([[studyGroupKey(offeringA), []]]),
    );

    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("discards queued requests when cleared before dispatch", async () => {
    const transport = vi.fn(async (requests: StudyGroupRequest[]) =>
      new Map(requests.map((request) => [
        studyGroupKey(request),
        [] as StudyGroup[],
      ])),
    );

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const load = coordinator.load([offeringA]);
    const cancelled = expect(load).rejects.toThrow(/cancel/i);

    coordinator.clear();

    await cancelled;
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects active and queued requests when cleared", async () => {
    const pending = deferred<BatchResult>();
    const transport = vi.fn()
      .mockImplementationOnce(() => pending.promise)
      .mockImplementationOnce(async () => new Map([
        [studyGroupKey(offeringA), []],
      ]));

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      chunkSize: 1,
      concurrency: 1,
    });

    const active = coordinator.load([offeringA]);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    const queued = coordinator.load([offeringB]);

    // Attach rejection handlers before triggering cancellation.
    const activeCancelled = expect(active).rejects.toThrow(/cancel/i);
    const queuedCancelled = expect(queued).rejects.toThrow(/cancel/i);

    coordinator.clear();

    await Promise.all([activeCancelled, queuedCancelled]);

    // Complete the obsolete transport request.
    pending.resolve(new Map([
      [studyGroupKey(offeringA), []],
    ]));

    const next = coordinator.load([offeringA]);

    await expect(next).resolves.toEqual(
      new Map([[studyGroupKey(offeringA), []]]),
    );

    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport).not.toHaveBeenCalledWith([offeringB]);
  });

  it("does not let an obsolete response settle a new request", async () => {
    const oldBatch = deferred<BatchResult>();
    const newBatch = deferred<BatchResult>();

    const transport = vi.fn()
      .mockImplementationOnce(() => oldBatch.promise)
      .mockImplementationOnce(() => newBatch.promise);

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      chunkSize: 1,
      concurrency: 1,
    });

    const oldLoad = coordinator.load([offeringA]);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    const oldCancelled = expect(oldLoad).rejects.toThrow(/cancel/i);

    coordinator.clear();

    await oldCancelled;

    // The same offering can be requested in a new generation.
    const newLoad = coordinator.load([offeringA]);

    // The obsolete HTTP request still occupies the sole slot.
    expect(transport).toHaveBeenCalledTimes(1);

    // A response with an omitted key must not fail the new request.
    oldBatch.resolve(new Map());

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(2);
    });

    expect(transport).toHaveBeenNthCalledWith(2, [offeringA]);

    newBatch.resolve(new Map([
      [studyGroupKey(offeringA), []],
    ]));

    await expect(newLoad).resolves.toEqual(
      new Map([[studyGroupKey(offeringA), []]]),
    );
  });

  it("returns success outcomes for populated and empty results", async () => {
    const groups: StudyGroup[] = [
      {
        groupId: "group-1",
        name: "Lecture 1",
        type: "Lecture",
        studyEvents: [],
      },
    ];

    const transport = vi.fn(async () => new Map([
      [studyGroupKey(offeringA), groups],
      [studyGroupKey(offeringB), [] as StudyGroup[]],
    ]));

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const outcomes = await coordinator.loadSettled([
      offeringA,
      offeringB,
    ]);

    expect(outcomes.get(studyGroupKey(offeringA))).toEqual({
      status: "success",
      groups,
    });

    expect(outcomes.get(studyGroupKey(offeringB))).toEqual({
      status: "success",
      groups: [],
    });

    expect(outcomes.size).toBe(2);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("preserves successes when another offering is omitted", async () => {
    const transport = vi.fn(async () => new Map([
      [studyGroupKey(offeringA), [] as StudyGroup[]],
    ]));

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const outcomes = await coordinator.loadSettled([
      offeringA,
      offeringB,
    ]);

    expect(outcomes.get(studyGroupKey(offeringA))).toEqual({
      status: "success",
      groups: [],
    });

    const missing = outcomes.get(studyGroupKey(offeringB));

    expect(missing?.status).toBe("failure");

    if (missing?.status === "failure") {
      expect(missing.error).toBeInstanceOf(StudyGroupRetrievalError);
    }

    expect(outcomes.size).toBe(2);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith([
      offeringA,
      offeringB,
    ]);
  });

  it("reports transport failures per offering and allows retries", async () => {
    const transport = vi.fn()
      .mockRejectedValueOnce(new Error("upstream unavailable"))
      .mockResolvedValueOnce(new Map([
        [studyGroupKey(offeringA), [] as StudyGroup[]],
        [studyGroupKey(offeringB), [] as StudyGroup[]],
      ]));

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const first = await coordinator.loadSettled([
      offeringA,
      offeringB,
    ]);

    for (const request of [offeringA, offeringB]) {
      const outcome = first.get(studyGroupKey(request));

      expect(outcome?.status).toBe("failure");

      if (outcome?.status === "failure") {
        expect(outcome.error.message).toBe("upstream unavailable");
      }
    }

    const retried = await coordinator.loadSettled([
      offeringA,
      offeringB,
    ]);

    expect(retried.get(studyGroupKey(offeringA))).toEqual({
      status: "success",
      groups: [],
    });

    expect(retried.get(studyGroupKey(offeringB))).toEqual({
      status: "success",
      groups: [],
    });

    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("shares pending retrieval with the existing load API", async () => {
    const pending = deferred<BatchResult>();
    const transport = vi.fn(() => pending.promise);

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const original = coordinator.load([offeringA]);
    const settled = coordinator.loadSettled([offeringA]);

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    pending.resolve(new Map([
      [studyGroupKey(offeringA), []],
    ]));

    const [originalResult, settledResult] = await Promise.all([
      original,
      settled,
    ]);

    expect(originalResult.get(studyGroupKey(offeringA))).toEqual([]);

    expect(settledResult.get(studyGroupKey(offeringA))).toEqual({
      status: "success",
      groups: [],
    });

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("rejects cancellation instead of reporting a retrieval failure", async () => {
    const pending = deferred<BatchResult>();
    const transport = vi.fn(() => pending.promise);

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
    });

    const load = coordinator.loadSettled([offeringA]);

    // Attach the rejection assertion before cancellation.
    const cancelled = expect(load).rejects.toBeInstanceOf(
      StudyGroupRequestCancelledError,
    );

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalledTimes(1);
    });

    coordinator.clear();

    await cancelled;

    // The obsolete transport can finish without affecting new work.
    pending.resolve(new Map([
      [studyGroupKey(offeringA), []],
    ]));
  });
});
