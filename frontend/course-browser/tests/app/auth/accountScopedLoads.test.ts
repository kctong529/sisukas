import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FavouritesService } from "@infrastructure/services/FavouritesService";
import { gradesService } from "@infrastructure/services/GradesService";
import { courseGradeStore } from "@lib/stores/courseGradeStore";
import { favouritesStore } from "@lib/stores/favouritesStore";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  favouritesStore.clear();
  courseGradeStore.clear();
});

afterEach(() => {
  favouritesStore.clear();
  courseGradeStore.clear();
  vi.restoreAllMocks();
});

describe("account-scoped load invalidation", () => {
  it("discards a late favourites response after clear", async () => {
    const pending = deferred<Awaited<ReturnType<typeof FavouritesService.getFavourites>>>();
    vi.spyOn(FavouritesService, "getFavourites").mockReturnValue(pending.promise);
    const loading = favouritesStore.load();
    favouritesStore.clear();
    pending.resolve([{
      id: "old", userId: "previous-user", courseId: "CS-A", notes: null,
      addedAt: "2026-11-01T00:00:00Z",
    }]);
    await loading;
    expect(get(favouritesStore)).toEqual({ favourites: [], loading: false, error: null });
  });

  it("does not let an old favourites failure override a new load", async () => {
    const old = deferred<Awaited<ReturnType<typeof FavouritesService.getFavourites>>>();
    const fresh = deferred<Awaited<ReturnType<typeof FavouritesService.getFavourites>>>();
    vi.spyOn(FavouritesService, "getFavourites")
      .mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const oldLoad = favouritesStore.load();
    favouritesStore.clear();
    const newLoad = favouritesStore.load();
    old.reject(new Error("previous-user failure"));
    await oldLoad;
    expect(get(favouritesStore).loading).toBe(true);
    expect(get(favouritesStore).error).toBeNull();
    fresh.resolve([]);
    await newLoad;
    expect(get(favouritesStore)).toEqual({ favourites: [], loading: false, error: null });
  });

  it("discards a late grades response after clear", async () => {
    const pending = deferred<Awaited<ReturnType<typeof gradesService.loadAll>>>();
    vi.spyOn(gradesService, "loadAll").mockReturnValue(pending.promise);
    const loading = courseGradeStore.load();
    courseGradeStore.clear();
    pending.resolve([{
      userId: "previous-user", courseUnitId: "CS-A", grade: 5,
      createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
    }]);
    await loading;
    expect(get(courseGradeStore).grades.size).toBe(0);
    expect(get(courseGradeStore).loadedOnce).toBe(false);
    expect(get(courseGradeStore).loading).toBe(false);
  });

  it("does not let an old grades failure override a new load", async () => {
    const old = deferred<Awaited<ReturnType<typeof gradesService.loadAll>>>();
    const fresh = deferred<Awaited<ReturnType<typeof gradesService.loadAll>>>();
    vi.spyOn(gradesService, "loadAll")
      .mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const oldLoad = courseGradeStore.load();
    courseGradeStore.clear();
    const newLoad = courseGradeStore.load();
    old.reject(new Error("previous-user failure"));
    await oldLoad;
    expect(get(courseGradeStore).loading).toBe(true);
    expect(get(courseGradeStore).error).toBeNull();
    fresh.resolve([]);
    await newLoad;
    expect(get(courseGradeStore).loading).toBe(false);
    expect(get(courseGradeStore).loadedOnce).toBe(true);
  });
});
