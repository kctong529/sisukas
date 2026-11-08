import { describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import type { StudyGroup } from "@domain/models/StudyGroup";
import { StudyGroupCache } from "@application/studyGroups/StudyGroupCache";
import type { StudyGroupEntry } from "@application/studyGroups/StudyGroupEntry";
import type { StudyGroupRequest } from "@application/studyGroups/StudyGroupRequest";
import { createStudyGroupEntryStore } from "@lib/stores/studyGroupEntryStore";

const offeringA: StudyGroupRequest = {
  courseUnitId: "unit-a",
  courseOfferingId: "offering-a",
};

const offeringB: StudyGroupRequest = {
  courseUnitId: "unit-b",
  courseOfferingId: "offering-b",
};

const keyA = "unit-a:offering-a";
const keyB = "unit-b:offering-b";

function makeGroup(groupId: string): StudyGroup {
  return {
    groupId,
    name: `Group ${groupId}`,
    type: "Lecture",
    studyEvents: [],
  };
}

describe("study-group entry Svelte adapter", () => {
  it("exposes the current cache state upon subscription", () => {
    const cache = new StudyGroupCache();

    cache.markReady(keyA, [makeGroup("lecture-1")], 1_000);

    const store = createStudyGroupEntryStore(cache, offeringA);

    expect(get(store)).toEqual({
      groups: [makeGroup("lecture-1")],
      status: "ready",
      fetchedAt: 1_000,
      error: null,
      refreshing: false,
    });
  });

  it("reacts to loading, success, refresh, and failure", () => {
    const cache = new StudyGroupCache();
    const store = createStudyGroupEntryStore(cache, offeringA);

    const observed: StudyGroupEntry[] = [];
    const unsubscribe = store.subscribe((entry) => {
      observed.push(entry);
    });

    try {
      cache.markLoading(keyA);
      cache.markReady(keyA, [makeGroup("old")], 1_000);
      cache.markRefreshing(keyA);
      cache.markFailed(keyA, new Error("HTTP 502"));

      expect(observed.map((entry) => ({
        status: entry.status,
        refreshing: entry.refreshing,
        error: entry.error,
      }))).toEqual([
        {
          status: "missing",
          refreshing: false,
          error: null,
        },
        {
          status: "loading",
          refreshing: false,
          error: null,
        },
        {
          status: "ready",
          refreshing: false,
          error: null,
        },
        {
          status: "ready",
          refreshing: true,
          error: null,
        },
        {
          status: "ready",
          refreshing: false,
          error: "HTTP 502",
        },
      ]);

      expect(observed.at(-1)?.groups).toEqual([
        makeGroup("old"),
      ]);
      expect(observed.at(-1)?.fetchedAt).toBe(1_000);
    } finally {
      unsubscribe();
    }
  });

  it("ignores unrelated offering changes", () => {
    const cache = new StudyGroupCache();
    const store = createStudyGroupEntryStore(cache, offeringA);

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    try {
      expect(listener).toHaveBeenCalledTimes(1);

      cache.markLoading(keyB);
      cache.markReady(keyB, [], 1_000);

      expect(listener).toHaveBeenCalledTimes(1);

      cache.markLoading(keyA);

      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
    }
  });

  it("resets its snapshot when the cache is cleared", () => {
    const cache = new StudyGroupCache();
    cache.markReady(keyA, [makeGroup("lecture-1")], 1_000);

    const store = createStudyGroupEntryStore(cache, offeringA);

    const observed: StudyGroupEntry[] = [];
    const unsubscribe = store.subscribe((entry) => {
      observed.push(entry);
    });

    try {
      cache.clear();

      expect(observed.at(-1)).toEqual({
        groups: null,
        status: "missing",
        fetchedAt: null,
        error: null,
        refreshing: false,
      });

      cache.markReady(keyA, [], 2_000);

      expect(observed.at(-1)).toEqual({
        groups: [],
        status: "ready",
        fetchedAt: 2_000,
        error: null,
        refreshing: false,
      });
    } finally {
      unsubscribe();
    }
  });

  it("stops observing cache changes after unsubscription", () => {
    const cache = new StudyGroupCache();
    const store = createStudyGroupEntryStore(cache, offeringA);

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    cache.markLoading(keyA);
    cache.markReady(keyA, [], 1_000);

    expect(listener).toHaveBeenCalledTimes(1);

    // A later subscription must read the authoritative
    // current cache state, rather than the old snapshot.
    expect(get(store)).toMatchObject({
      groups: [],
      status: "ready",
      fetchedAt: 1_000,
    });
  });

  it("does not expose mutable cache-owned group data", () => {
    const cache = new StudyGroupCache();

    cache.markReady(keyA, [makeGroup("lecture-1")], 1_000);

    const store = createStudyGroupEntryStore(cache, offeringA);
    const snapshot = get(store);

    expect(snapshot.groups).not.toBeNull();

    if (snapshot.groups === null) {
      throw new Error("Expected cached groups");
    }

    snapshot.groups[0].name = "Modified externally";

    expect(cache.get(keyA).groups).toEqual([
      makeGroup("lecture-1"),
    ]);
  });
});
