import { describe, expect, it } from "vitest";
import type { StudyGroup } from "@domain/models/StudyGroup";
import { StudyGroupCache } from "@application/studyGroups/StudyGroupCache";

const key = "course-unit-a:offering-a";

function makeGroup(groupId: string): StudyGroup {
  return {
    groupId,
    name: `Group ${groupId}`,
    type: "Lecture",
    studyEvents: [],
  };
}

describe("StudyGroupCache", () => {
  it("returns a missing entry for an unknown offering", () => {
    const cache = new StudyGroupCache();

    expect(cache.get(key)).toEqual({
      groups: null,
      status: "missing",
      fetchedAt: null,
      error: null,
      refreshing: false,
    });
  });

  it("marks an initially unavailable offering as loading", () => {
    const cache = new StudyGroupCache();

    cache.markLoading(key);

    expect(cache.get(key)).toEqual({
      groups: null,
      status: "loading",
      fetchedAt: null,
      error: null,
      refreshing: false,
    });
  });

  it("stores complete study groups and their fetch timestamp", () => {
    const cache = new StudyGroupCache();
    const groups = [makeGroup("lecture-1")];

    cache.markLoading(key);
    cache.markReady(key, groups, 1_000);

    expect(cache.get(key)).toEqual({
      groups,
      status: "ready",
      fetchedAt: 1_000,
      error: null,
      refreshing: false,
    });
  });

  it("treats a successful empty response as available data", () => {
    const cache = new StudyGroupCache();

    cache.markLoading(key);
    cache.markReady(key, [], 2_000);

    expect(cache.get(key)).toEqual({
      groups: [],
      status: "ready",
      fetchedAt: 2_000,
      error: null,
      refreshing: false,
    });

    expect(cache.get(key).groups).not.toBeNull();
  });

  it("records initial retrieval failure without fabricating data", () => {
    const cache = new StudyGroupCache();

    cache.markLoading(key);
    cache.markFailed(key, new Error("Network unavailable"));

    expect(cache.get(key)).toEqual({
      groups: null,
      status: "failed",
      fetchedAt: null,
      error: "Network unavailable",
      refreshing: false,
    });
  });

  it("allows successful retrieval after an initial failure", () => {
    const cache = new StudyGroupCache();
    const groups = [makeGroup("exercise-1")];

    cache.markLoading(key);
    cache.markFailed(key, new Error("Temporary failure"));

    cache.markLoading(key);
    cache.markReady(key, groups, 3_000);

    expect(cache.get(key)).toEqual({
      groups,
      status: "ready",
      fetchedAt: 3_000,
      error: null,
      refreshing: false,
    });
  });

  it("keeps cached groups available during refresh", () => {
    const cache = new StudyGroupCache();
    const groups = [makeGroup("lecture-1")];

    cache.markReady(key, groups, 1_000);
    cache.markRefreshing(key);

    expect(cache.get(key)).toEqual({
      groups,
      status: "ready",
      fetchedAt: 1_000,
      error: null,
      refreshing: true,
    });
  });

  it("retains cached data and timestamp after failed refresh", () => {
    const cache = new StudyGroupCache();
    const groups = [makeGroup("lecture-1")];

    cache.markReady(key, groups, 1_000);
    cache.markRefreshing(key);
    cache.markFailed(key, new Error("HTTP 502"));

    expect(cache.get(key)).toEqual({
      groups,
      status: "ready",
      fetchedAt: 1_000,
      error: "HTTP 502",
      refreshing: false,
    });
  });

  it("replaces cached data and timestamp after successful refresh", () => {
    const cache = new StudyGroupCache();
    const previous = [makeGroup("lecture-1")];
    const updated = [makeGroup("lecture-2")];

    cache.markReady(key, previous, 1_000);
    cache.markRefreshing(key);
    cache.markReady(key, updated, 4_000);

    expect(cache.get(key)).toEqual({
      groups: updated,
      status: "ready",
      fetchedAt: 4_000,
      error: null,
      refreshing: false,
    });
  });

  it("clears cached data and resets availability", () => {
    const cache = new StudyGroupCache();

    cache.markReady(key, [makeGroup("lecture-1")], 1_000);
    cache.clear();

    expect(cache.get(key)).toEqual({
      groups: null,
      status: "missing",
      fetchedAt: null,
      error: null,
      refreshing: false,
    });
  });

  it("isolates state between different offerings", () => {
    const cache = new StudyGroupCache();
    const otherKey = "course-unit-b:offering-b";

    cache.markReady(key, [makeGroup("lecture-1")], 1_000);
    cache.markFailed(otherKey, new Error("Unavailable"));

    expect(cache.get(key).status).toBe("ready");
    expect(cache.get(otherKey).status).toBe("failed");
    expect(cache.get(otherKey).groups).toBeNull();
  });
});
