import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import type { Course } from "../../../src/domain/models/Course";
import type { Plan } from "../../../src/domain/models/Plan";
import { plansStore } from "../../../src/lib/stores/plansStore.svelte";
import { courseIndexStore } from "../../../src/lib/stores/courseIndexStore.svelte";
import { studyGroupStore } from "../../../src/lib/stores/studyGroupStore.svelte";
import { calendarProjectionStore } from "../../../src/lib/stores/calendarProjectionStore.svelte";
import { observeProjection } from "./projectionObserver.svelte";

const key = (id: string) => `unit-${id}:${id}`;
const course = (id: string) => ({
  id,
  unitId: `unit-${id}`,
  code: { value: `TEST-${id}` },
}) as Course;
const plan = (id: string, instanceIds: string[]): Plan => ({
  id, userId: "test-user", name: id, isActive: true, instanceIds,
  createdAt: new Date(0), updatedAt: new Date(0),
});

function activate(p: Plan) {
  plansStore.state.byId = new Map([[p.id, p]]);
  plansStore.state.ids = [p.id];
  plansStore.state.activePlanId = p.id;
  flushSync();
}

function setFull(id: string, groups: [] = []) {
  studyGroupStore.state.cache = { ...studyGroupStore.state.cache, [key(id)]: groups };
  flushSync();
}

function counts() {
  const result = calendarProjectionStore.projection;
  if (!result) throw new Error("Expected an active projection");
  return result.completeness;
}

beforeEach(() => {
  plansStore.actions.clear();
  courseIndexStore.actions.setCourses([]);
  courseIndexStore.actions.setHistoricalCourses([]);
  studyGroupStore.state.cache = {};
  studyGroupStore.state.summaryCache = {};
  studyGroupStore.state.fallbackSummaries = {};
  studyGroupStore.state.loadingKeys = [];
  studyGroupStore.state.staleKeys = new Set();
  studyGroupStore.state.error = null;
  flushSync();
});

afterEach(() => {
  plansStore.actions.clear();
  flushSync();
});

describe("calendar projection reactive store", () => {
  it("reacts to active-plan switching and offering edits", () => {
    courseIndexStore.actions.setCourses([course("a"), course("b")]);
    setFull("a");
    setFull("b");
    activate(plan("first", ["a"]));
    const observer = observeProjection();
    try {
      expect(counts().totalCourses).toBe(1);
      activate(plan("second", ["a", "b"]));
      expect(counts().totalCourses).toBe(2);
      expect(counts().availableCourses).toBe(2);
      expect(observer.seen.at(-1)?.completeness.totalCourses).toBe(2);
      expect(observer.seen.length).toBeGreaterThan(1);
      activate(plan("third", ["b"]));
      expect(counts().totalCourses).toBe(1);
    } finally {
      observer.dispose();
    }
  });

  it("reacts to missing, loading and available full-data transitions", () => {
    courseIndexStore.actions.setCourses([course("a")]);
    activate(plan("p", ["a"]));
    const observer = observeProjection();
    try {
      expect(counts().missingCourses).toBe(1);
      studyGroupStore.state.loadingKeys = [key("a")];
      flushSync();
      expect(counts().loadingCourses).toBe(1);
      setFull("a");
      expect(counts().availableCourses).toBe(1);
      expect(counts().loadingCourses).toBe(0);
      expect(observer.seen.at(-1)?.completeness.availableCourses).toBe(1);
    } finally {
      observer.dispose();
    }
  });

  it("does not mistake summary-only fallback for full data", () => {
    courseIndexStore.actions.setCourses([course("a")]);
    activate(plan("p", ["a"]));
    studyGroupStore.state.fallbackSummaries = {
      [key("a")]: [{ groupId: "g", name: "Lecture", type: "Lecture", schedule: "", eventCount: 1 }],
    };
    studyGroupStore.state.loadingKeys = [key("a")];
    flushSync();
    expect(counts().loadingCourses).toBe(1);
    expect(counts().availableCourses).toBe(0);
  });

  it("keeps stale full data usable during refresh", () => {
    courseIndexStore.actions.setCourses([course("a")]);
    activate(plan("p", ["a"]));
    setFull("a");
    studyGroupStore.state.staleKeys = new Set([key("a")]);
    studyGroupStore.state.loadingKeys = [key("a")];
    flushSync();
    expect(counts().staleCourses).toBe(1);
    expect(counts().loadingCourses).toBe(0);
    studyGroupStore.state.staleKeys = new Set();
    studyGroupStore.state.loadingKeys = [];
    flushSync();
    expect(counts().availableCourses).toBe(1);
  });

  it("ignores cache updates for a previously active plan", () => {
    courseIndexStore.actions.setCourses([course("a"), course("b")]);
    activate(plan("old", ["a"]));
    const observer = observeProjection();
    try {
      activate(plan("new", ["b"]));
      setFull("a"); // Simulate a late response for the old plan.
      expect(counts().totalCourses).toBe(1);
      expect(counts().missingCourses).toBe(1);
      setFull("b");
      expect(counts().availableCourses).toBe(1);
      expect(observer.seen.at(-1)?.completeness.availableCourses).toBe(1);
    } finally {
      observer.dispose();
    }
  });

  it("reacts when a previously unresolved course appears in the index", () => {
    activate(plan("p", ["a"]));
    expect(counts().missingCourses).toBe(1);
    courseIndexStore.actions.setCourses([course("a")]);
    setFull("a");
    expect(counts().availableCourses).toBe(1);
  });
});
