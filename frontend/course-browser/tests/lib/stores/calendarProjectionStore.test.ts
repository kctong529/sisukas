import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import type { StudyGroup } from "@domain/models/StudyGroup";
import type { Course } from "@domain/models/Course";
import type { Plan } from "@domain/models/Plan";
import { plansStore } from "@lib/stores/plansStore.svelte";
import { courseIndexStore } from "@lib/stores/courseIndexStore.svelte";
import { studyGroupStore } from "@lib/stores/studyGroupStore.svelte";
import { calendarProjectionStore } from "@lib/stores/calendarProjectionStore.svelte";
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

function setFull(id: string, groups: StudyGroup[] = []) {
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
  calendarProjectionStore.setSelectionPreview(null);
  calendarProjectionStore.setAvailabilityPreview(null);
  courseIndexStore.actions.setCourses([]);
  courseIndexStore.actions.setHistoricalCourses([]);
  studyGroupStore.state.cache = {};
  studyGroupStore.state.summaryCache = {};
  studyGroupStore.state.fallbackSummaries = {};
  studyGroupStore.state.loadingKeys = [];
  studyGroupStore.state.staleKeys = new Set();
  studyGroupStore.state.error = null;
  studyGroupStore.state.failedKeys = {};
  flushSync();
});

afterEach(() => {
  calendarProjectionStore.setSelectionPreview(null);
  calendarProjectionStore.setAvailabilityPreview(null);
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

  it("shows per-offering request failures without hiding other available offerings", () => {
    courseIndexStore.actions.setCourses([course("a"), course("b")]);
    setFull("a");
    activate(plan("p", ["a", "b"]));
    studyGroupStore.state.failedKeys = { [key("b")]: "No response" };
    flushSync();
    expect(counts().failedCourses).toBe(1);
    expect(counts().availableCourses).toBe(1);
    studyGroupStore.state.loadingKeys = [key("b")];
    flushSync();
    expect(counts().loadingCourses).toBe(1);
    setFull("b");
    expect(counts().availableCourses).toBe(2);
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


describe("development-only group-choice preview", () => {
  const groups: StudyGroup[] = [
    ["E01", "Exercise"], ["E02", "Exercise"],
    ["L01", "Lecture"], ["KT", "Exam"],
  ].map(([id, type], index) => ({
    groupId: id, name: id, type,
    studyEvents: [{
      id, seriesId: `series-${id}`,
      start: `2026-11-02T${10 + index}:00:00`, end: `2026-11-02T${11 + index}:00:00`,
      startIso: `2026-11-02T${10 + index}:00:00+02:00`,
      endIso: `2026-11-02T${11 + index}:00:00+02:00`,
      cancelled: false, excluded: false, locationIds: [], locations: [],
    }],
  }));

  it("keeps other types and unmentioned groups visible", () => {
    courseIndexStore.actions.setCourses([course("a")]);
    setFull("a", groups);
    activate(plan("p", ["a"]));
    const observer = observeProjection();
    try {
      expect(calendarProjectionStore.projection?.entries).toHaveLength(4);
      calendarProjectionStore.setSelectionPreview({
        planId: "p", choicesByOffering: { a: { E01: "selected", E02: "excluded" } },
      });
      flushSync();
      expect(calendarProjectionStore.projection?.selectionByGroup.a).toEqual({
        E01: "selected", E02: "excluded", L01: "candidate", KT: "candidate",
      });
      expect(calendarProjectionStore.projection?.entries.map(e => e.source.studyGroupId).sort())
        .toEqual(["E01", "KT", "L01"]);
      calendarProjectionStore.setSelectionPreview(null);
      flushSync();
      expect(calendarProjectionStore.projection?.entries).toHaveLength(4);
      expect(observer.seen.length).toBeGreaterThan(1);
    } finally {
      observer.dispose();
    }
  });

  it("retains independent choices across offerings within one plan without mutating the plan", () => {
    courseIndexStore.actions.setCourses([course("a"), course("b")]);
    setFull("a", groups);
    setFull("b", groups);
    const active = plan("p", ["a", "b"]);
    activate(active);
    calendarProjectionStore.setSelectionPreview({
      planId: "p", choicesByOffering: { a: { KT: "excluded" } },
    });
    flushSync();
    expect(calendarProjectionStore.projection?.selectionByGroup.b.KT).toBe("candidate");
    expect(calendarProjectionStore.projection?.selectionByGroup.a.KT).toBe("excluded");
    expect(calendarProjectionStore.projection?.entries).toHaveLength(7);

    calendarProjectionStore.setSelectionPreview({
      planId: "p",
      choicesByOffering: { a: { KT: "excluded" }, b: { E01: "selected", E02: "excluded" } },
    });
    flushSync();
    expect(calendarProjectionStore.selectionPreview?.choicesByOffering.a.KT).toBe("excluded");
    expect(calendarProjectionStore.projection?.selectionByGroup.a.KT).toBe("excluded");
    expect(calendarProjectionStore.projection?.selectionByGroup.b.E01).toBe("selected");
    expect(calendarProjectionStore.projection?.selectionByGroup.b.E02).toBe("excluded");
    expect(calendarProjectionStore.projection?.selectionByGroup.b.KT).toBe("candidate");
    expect(calendarProjectionStore.projection?.entries).toHaveLength(6);
    expect(active.instanceIds).toEqual(["a", "b"]);
    activate(plan("other", ["a"]));
    expect(calendarProjectionStore.selectionPreview).toBeNull();
    expect(calendarProjectionStore.projection?.selectionByGroup.a.KT).toBe("candidate");
  });
});

describe("development-only availability preview", () => {
  it("isolates availability previews from other active plans", () => {
    courseIndexStore.actions.setCourses([course("a")]);
    setFull("a");
    activate(plan("first", ["a"]));
    calendarProjectionStore.setAvailabilityPreview({ planId: "first", offeringId: "a", state: "failed" });
    flushSync();
    expect(counts().failedCourses).toBe(1);
    activate(plan("second", ["a"]));
    expect(counts().availableCourses).toBe(1);
    expect(calendarProjectionStore.availabilityPreview).toBeNull();
  });
  it("simulates loading, failed, missing and stale without altering cached data", () => {
    courseIndexStore.actions.setCourses([course("a"), course("b")]);
    setFull("a");
    setFull("b");
    activate(plan("p", ["a", "b"]));
    for (const [state, property] of [
      ["loading", "loadingCourses"], ["failed", "failedCourses"],
      ["missing", "missingCourses"], ["stale", "staleCourses"],
    ] as const) {
      calendarProjectionStore.setAvailabilityPreview({ planId: "p", offeringId: "a", state });
      flushSync();
      expect(counts()[property]).toBe(1);
      expect(counts().availableCourses).toBe(1);
      expect(studyGroupStore.read.getCached("unit-a", "a")).toEqual([]);
    }
    calendarProjectionStore.setAvailabilityPreview(null);
    flushSync();
    expect(counts().availableCourses).toBe(2);
  });
});
