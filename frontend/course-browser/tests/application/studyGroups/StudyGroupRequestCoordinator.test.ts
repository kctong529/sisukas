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
});
