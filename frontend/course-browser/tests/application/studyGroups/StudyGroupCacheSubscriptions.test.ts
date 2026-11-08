import { describe, expect, it, vi } from "vitest";
import type { StudyGroup } from "@modules/study-groups";
import {
  StudyGroupCache,
  type StudyGroupCacheChange,
} from "@modules/study-groups/cache/StudyGroupCache";

const keyA = "course-unit-a:offering-a";
const keyB = "course-unit-b:offering-b";

function makeGroup(groupId: string): StudyGroup {
  return {
    groupId,
    name: `Group ${groupId}`,
    type: "Lecture",
    studyEvents: [],
  };
}

describe("StudyGroupCache subscriptions", () => {
  it("notifies subscribers after each entry state transition", () => {
    const cache = new StudyGroupCache();
    const changes: StudyGroupCacheChange[] = [];

    cache.subscribe((change) => {
      changes.push(change);
    });

    cache.markLoading(keyA);
    cache.markReady(keyA, [makeGroup("lecture-1")], 1_000);
    cache.markRefreshing(keyA);
    cache.markFailed(keyA, new Error("HTTP 502"));
    cache.markRefreshing(keyA);
    cache.markReady(keyA, [makeGroup("lecture-2")], 2_000);

    expect(changes).toEqual([
      { type: "entry", key: keyA },
      { type: "entry", key: keyA },
      { type: "entry", key: keyA },
      { type: "entry", key: keyA },
      { type: "entry", key: keyA },
      { type: "entry", key: keyA },
    ]);
  });

  it("notifies synchronously after state has been updated", () => {
    const cache = new StudyGroupCache();

    const snapshots: Array<{
      change: StudyGroupCacheChange;
      status: string;
      refreshing: boolean;
    }> = [];

    cache.subscribe((change) => {
      if (change.type !== "entry") {
        return;
      }

      const entry = cache.get(change.key);

      snapshots.push({
        change,
        status: entry.status,
        refreshing: entry.refreshing,
      });
    });

    cache.markLoading(keyA);

    expect(snapshots).toEqual([
      {
        change: { type: "entry", key: keyA },
        status: "loading",
        refreshing: false,
      },
    ]);

    cache.markReady(keyA, [], 1_000);
    cache.markRefreshing(keyA);

    expect(snapshots).toEqual([
      {
        change: { type: "entry", key: keyA },
        status: "loading",
        refreshing: false,
      },
      {
        change: { type: "entry", key: keyA },
        status: "ready",
        refreshing: false,
      },
      {
        change: { type: "entry", key: keyA },
        status: "ready",
        refreshing: true,
      },
    ]);
  });

  it("supports independent subscribers and unsubscription", () => {
    const cache = new StudyGroupCache();
    const first = vi.fn();
    const second = vi.fn();

    const unsubscribeFirst = cache.subscribe(first);
    const unsubscribeSecond = cache.subscribe(second);

    cache.markLoading(keyA);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    unsubscribeFirst();

    cache.markFailed(keyA, new Error("Unavailable"));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);

    unsubscribeSecond();

    cache.markLoading(keyA);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("does not emit notifications for read-only operations", () => {
    const cache = new StudyGroupCache();
    const listener = vi.fn();

    cache.subscribe(listener);

    cache.get(keyA);
    cache.get(keyB);

    expect(listener).not.toHaveBeenCalled();

    cache.markReady(keyA, [], 1_000);

    listener.mockClear();

    cache.get(keyA);
    cache.get(keyA);

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not notify when a state transition is rejected", () => {
    const cache = new StudyGroupCache();
    const listener = vi.fn();

    cache.subscribe(listener);

    expect(() => cache.markRefreshing(keyA)).toThrow();

    expect(listener).not.toHaveBeenCalled();

    cache.markReady(keyA, [], 1_000);
    listener.mockClear();

    expect(() => cache.markLoading(keyA)).toThrow();

    expect(listener).not.toHaveBeenCalled();

    expect(cache.get(keyA)).toMatchObject({
      groups: [],
      status: "ready",
      fetchedAt: 1_000,
      refreshing: false,
    });
  });

  it("isolates listener failures from cache updates and other listeners", () => {
    const cache = new StudyGroupCache();
    const healthy = vi.fn();

    cache.subscribe(() => {
      throw new Error("Listener failed");
    });

    cache.subscribe(healthy);

    expect(() => cache.markLoading(keyA)).not.toThrow();

    expect(healthy).toHaveBeenCalledExactlyOnceWith({
      type: "entry",
      key: keyA,
    });

    expect(cache.get(keyA).status).toBe("loading");
  });

  it("broadcasts clear and leaves every offering missing", () => {
    const cache = new StudyGroupCache();
    const changes: StudyGroupCacheChange[] = [];

    cache.markReady(keyA, [makeGroup("lecture-1")], 1_000);
    cache.markLoading(keyB);

    cache.subscribe((change) => {
      changes.push(change);
    });

    cache.clear();

    expect(changes).toEqual([{ type: "clear" }]);

    expect(cache.get(keyA).status).toBe("missing");
    expect(cache.get(keyB).status).toBe("missing");

    // Notifications continue working after a reset.
    cache.markLoading(keyB);

    expect(changes).toEqual([
      { type: "clear" },
      { type: "entry", key: keyB },
    ]);
  });
});
