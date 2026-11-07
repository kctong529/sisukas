import { describe, expect, it, vi } from "vitest";

import {
  StudyGroupRequestCoordinator,
} from "@application/studyGroups/StudyGroupRequestCoordinator";

import {
  studyGroupKey,
  type StudyGroupRequest,
} from "@application/studyGroups/StudyGroupRequest";

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

    expect(transport).toHaveBeenCalledTimes(1);
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

    // Give the first request an opportunity to start.
    await Promise.resolve();

    const second = coordinator.load([offeringA]);

    expect(transport).toHaveBeenCalledTimes(1);

    pending.resolve(new Map([
      [studyGroupKey(offeringA), []],
    ]));

    await Promise.all([first, second]);

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("retrieves different offerings independently", async () => {
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
    expect(second.has(studyGroupKey(offeringB))).toBe(true);

    expect(transport).toHaveBeenCalledTimes(2);
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
    const pending: Array<ReturnType<typeof deferred<BatchResult>>> = [];
    let active = 0;
    let maximumActive = 0;

    const transport = vi.fn((_requests: StudyGroupRequest[]) => {
      active++;
      maximumActive = Math.max(maximumActive, active);

      const operation = deferred<BatchResult>();
      pending.push(operation);

      return operation.promise.finally(() => {
        active--;
      });
    });

    const coordinator = new StudyGroupRequestCoordinator({
      transport,
      chunkSize: 1,
      concurrency: 2,
    });

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

    pending[0].resolve(new Map());
    pending[1].resolve(new Map());

    await vi.waitFor(() => {
      expect(pending).toHaveLength(4);
    });

    expect(maximumActive).toBe(2);

    pending[2].resolve(new Map());
    pending[3].resolve(new Map());

    await vi.waitFor(() => {
      expect(pending).toHaveLength(5);
    });

    pending[4].resolve(new Map());

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

});
