import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadCoursesWithCache } from "@infrastructure/loaders/RemoteCourseLoader";
import { courseIndexStore } from "@lib/stores/courseIndexStore.svelte";

import type { Course } from "@domain/models/Course";

vi.mock("@infrastructure/loaders/RemoteCourseLoader", () => ({
  loadCoursesWithCache: vi.fn(),
  loadHistoricalCoursesWithCache: vi.fn(),
}));

const mockedLoad = vi.mocked(loadCoursesWithCache);

function course(id: string): Course {
  return { id, code: { value: "CS-A1000" } } as Course;
}

describe("active course-index readiness", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // The active index starts a new test with no usable data.
    courseIndexStore.actions.setCourses([]);
    courseIndexStore.state.activeReady = false;
  });

  it("distinguishes not-yet-loaded from a successfully empty catalogue", () => {
    expect(courseIndexStore.state.activeReady).toBe(false);
    courseIndexStore.actions.setCourses([]);
    expect(courseIndexStore.state.activeReady).toBe(true);
    expect(courseIndexStore.read.isEmpty()).toBe(true);
  });

  it("marks direct catalogue updates as ready", () => {
    courseIndexStore.actions.setCourses([course("offering-1")]);
    expect(courseIndexStore.state.activeReady).toBe(true);
    expect(courseIndexStore.read.getByInstanceId("offering-1")?.id).toBe("offering-1");
  });

  it("marks successful bootstrap ready even for an empty response", async () => {
    mockedLoad.mockResolvedValueOnce([]);
    await expect(courseIndexStore.actions.bootstrapActive()).resolves.toEqual({ activeCount: 0 });
    expect(courseIndexStore.state.activeReady).toBe(true);
    expect(courseIndexStore.state.loading).toBe(false);
  });

  it("does not claim readiness after a failed bootstrap", async () => {
    mockedLoad.mockRejectedValueOnce(new Error("catalogue unavailable"));
    await expect(courseIndexStore.actions.bootstrapActive()).rejects.toThrow("catalogue unavailable");
    expect(courseIndexStore.state.activeReady).toBe(false);
    expect(courseIndexStore.state.loading).toBe(false);
    expect(courseIndexStore.state.error).toBe("catalogue unavailable");
  });
});
