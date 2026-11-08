import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

import type { StudyGroup } from "@modules/study-groups";
import type { StudyGroupRequest } from
  "@modules/study-groups";
import { StudyGroupService } from
  "@modules/study-groups/infrastructure/StudyGroupService";

import {
  createStudyGroupDataRuntime,
  getStudyGroupDataRuntime,
} from "@modules/study-groups/StudyGroupDataRuntime";
import { StudyGroupRequestCancelledError } from "@modules/study-groups/retrieval/StudyGroupRequestCancelledError";

const offeringA: StudyGroupRequest = {
  courseUnitId: "unit-a",
  courseOfferingId: "offering-a",
};

const keyA = "unit-a:offering-a";

function group(id: string): StudyGroup {
  return {
    groupId: id,
    name: `Group ${id}`,
    type: "Lecture",
    studyEvents: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });

  return { promise, resolve };
}

type BatchResult = Map<string, StudyGroup[]>;

function result(groups: StudyGroup[]): BatchResult {
  return new Map([[keyA, groups]]);
}

function setup() {
  const service = new StudyGroupService(
    "https://wrapper.example.test",
  );

  const runtime = createStudyGroupDataRuntime({
    service,
    now: () => 1_000,
  });

  return { service, runtime };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StudyGroupDataRuntime composition", () => {
  it("does not retrieve data when constructed or observed", () => {
    const { service, runtime } = setup();

    const retrieve = vi.spyOn(
      service,
      "fetchStudyGroupsChunk",
    );

    const entry = runtime.entry(offeringA);

    expect(get(entry)).toMatchObject({
      groups: null,
      status: "missing",
    });

    expect(retrieve).not.toHaveBeenCalled();
  });

  it("shares authoritative data across entry stores", () => {
    const { runtime } = setup();

    const first = runtime.entry(offeringA);
    const second = runtime.entry(offeringA);

    const firstStates: string[] = [];
    const secondStates: string[] = [];

    const unsubscribeFirst = first.subscribe((entry) => {
      firstStates.push(entry.status);
    });

    const unsubscribeSecond = second.subscribe((entry) => {
      secondStates.push(entry.status);
    });

    try {
      // Neither entry store should initiate retrieval.
      expect(firstStates).toEqual(["missing"]);
      expect(secondStates).toEqual(["missing"]);

      runtime.clear();

      expect(get(first).status).toBe("missing");
      expect(get(second).status).toBe("missing");
    } finally {
      unsubscribeFirst();
      unsubscribeSecond();
    }
  });

  it("deduplicates retrieval across concurrent consumers", async () => {
    const { service, runtime } = setup();

    const pending = deferred<BatchResult>();

    const retrieve = vi.spyOn(
      service,
      "fetchStudyGroupsChunk",
    ).mockReturnValue(pending.promise);

    const first = runtime.entry(offeringA);
    const second = runtime.entry(offeringA);

    const states: string[] = [];
    const unsubscribe = second.subscribe((entry) => {
      states.push(entry.status);
    });

    try {
      const firstLoad = runtime.ensure([offeringA]);
      const secondLoad = runtime.ensure([offeringA]);

      expect(get(first).status).toBe("loading");

      await vi.waitFor(() => {
        expect(retrieve).toHaveBeenCalledTimes(1);
      });

      expect(retrieve).toHaveBeenCalledWith([offeringA]);

      pending.resolve(result([group("lecture-1")]));

      await Promise.all([firstLoad, secondLoad]);

      expect(get(first)).toEqual({
        groups: [group("lecture-1")],
        status: "ready",
        fetchedAt: 1_000,
        error: null,
        refreshing: false,
      });

      expect(get(second).groups).toEqual([
        group("lecture-1"),
      ]);

      expect(states).toEqual([
        "missing",
        "loading",
        "ready",
      ]);
    } finally {
      unsubscribe();
    }
  });

  it("reuses a successfully empty result", async () => {
    const { service, runtime } = setup();

    const retrieve = vi.spyOn(
      service,
      "fetchStudyGroupsChunk",
    ).mockResolvedValue(result([]));

    await runtime.ensure([offeringA]);
    await runtime.ensure([offeringA]);

    expect(retrieve).toHaveBeenCalledTimes(1);

    expect(get(runtime.entry(offeringA))).toEqual({
      groups: [],
      status: "ready",
      fetchedAt: 1_000,
      error: null,
      refreshing: false,
    });
  });

  it("refreshes shared data without discarding it", async () => {
    const { service, runtime } = setup();

    const pending = deferred<BatchResult>();

    const retrieve = vi.spyOn(
      service,
      "fetchStudyGroupsChunk",
    )
      .mockResolvedValueOnce(
        result([group("old")]),
      )
      .mockReturnValueOnce(pending.promise);

    await runtime.ensure([offeringA]);

    const entry = runtime.entry(offeringA);
    const refresh = runtime.refresh([offeringA]);

    expect(get(entry)).toMatchObject({
      groups: [group("old")],
      status: "ready",
      refreshing: true,
    });

    await vi.waitFor(() => {
      expect(retrieve).toHaveBeenCalledTimes(2);
    });

    pending.resolve(result([group("new")]));
    await refresh;

    expect(get(entry)).toMatchObject({
      groups: [group("new")],
      status: "ready",
      refreshing: false,
      fetchedAt: 1_000,
    });
  });

  it("ignores obsolete results after clearing", async () => {
    const { service, runtime } = setup();

    const oldResult = deferred<BatchResult>();
    const newResult = deferred<BatchResult>();

    const retrieve = vi.spyOn(
      service,
      "fetchStudyGroupsChunk",
    )
      .mockReturnValueOnce(oldResult.promise)
      .mockReturnValueOnce(newResult.promise);

    const entry = runtime.entry(offeringA);

    const obsoleteLoad = runtime.ensure([offeringA]);

    // Attach the rejection handler before clear() cancels the request.
    const obsoleteSettlement = Promise.allSettled([obsoleteLoad]);

    await vi.waitFor(() => {
      expect(retrieve).toHaveBeenCalledTimes(1);
    });

    runtime.clear();

    expect(get(entry).status).toBe("missing");

    const replacementLoad = runtime.ensure([offeringA]);

    await vi.waitFor(() => {
      expect(retrieve).toHaveBeenCalledTimes(2);
    });

    oldResult.resolve(result([group("obsolete")]));

    expect(get(entry).status).toBe("loading");

    newResult.resolve(result([group("current")]));

    const [obsoleteOutcome] = await obsoleteSettlement;
    await replacementLoad;

    expect(obsoleteOutcome.status).toBe("rejected");

    if (obsoleteOutcome.status === "rejected") {
      expect(obsoleteOutcome.reason).toBeInstanceOf(
        StudyGroupRequestCancelledError,
      );
    }

    expect(get(entry)).toMatchObject({
      groups: [group("current")],
      status: "ready",
    });
  });

  it("returns one shared production runtime", () => {
    const first = getStudyGroupDataRuntime();
    const second = getStudyGroupDataRuntime();

    expect(second).toBe(first);
  });
});
