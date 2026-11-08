// @vitest-environment jsdom
import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuthenticatedDataLifecycle from "@app/auth/AuthenticatedDataLifecycle.svelte";
import { courseGradeStore } from "@lib/stores/courseGradeStore";
import { courseIndexStore } from "@lib/stores/courseIndexStore.svelte";
import { favouritesStore } from "@lib/stores/favouritesStore";
import { plansStore } from "@lib/stores/plansStore.svelte";
import { getStudyGroupDataRuntime } from "@modules/study-groups";

import type { Course } from "@domain/models/Course";
import type { Plan } from "@domain/models/Plan";

const course = (id: string): Course => ({
  id, unitId: `unit-${id}`, code: { value: id },
}) as Course;

const plan = (id: string, instanceIds: string[]): Plan => ({
  id, userId: "account-a", name: id, isActive: true, instanceIds,
  createdAt: new Date(0), updatedAt: new Date(0),
});

let target: HTMLElement;
let component: ReturnType<typeof mount> | null = null;
let ensure: ReturnType<typeof vi.spyOn>;

function activate(value: Plan): void {
  plansStore.state.byId = new Map([[value.id, value]]);
  plansStore.state.ids = [value.id];
  plansStore.state.activePlanId = value.id;
  plansStore.state.loaded = true;
  flushSync();
}

function start(userId: string | null = "account-a", pending = false): void {
  component = mount(AuthenticatedDataLifecycle, {
    target,
    props: { userId, pending },
  });
  flushSync();
}

beforeEach(() => {
  plansStore.actions.clear();
  courseIndexStore.state.activeReady = false;
  courseIndexStore.state.byInstanceId = new Map();
  courseIndexStore.state.historicalByInstanceId = new Map();
  vi.spyOn(plansStore.actions, "ensureDefaultPlan").mockResolvedValue();
  vi.spyOn(favouritesStore, "load").mockResolvedValue([]);
  vi.spyOn(courseGradeStore, "load").mockResolvedValue(undefined);
  ensure = vi.spyOn(getStudyGroupDataRuntime(), "ensure").mockResolvedValue();
  target = document.createElement("div");
  document.body.append(target);
});

afterEach(async () => {
  if (component) await unmount(component);
  component = null;
  target.remove();
  vi.restoreAllMocks();
  plansStore.actions.clear();
  getStudyGroupDataRuntime().clear();
});

describe("authenticated default study-group loading", () => {
  it("waits for catalogue readiness even after the plan loads", () => {
    start();
    activate(plan("first", ["a"]));
    expect(ensure).not.toHaveBeenCalled();

    courseIndexStore.actions.setCourses([course("a")]);
    flushSync();
    expect(ensure).toHaveBeenCalledWith([
      { courseUnitId: "unit-a", courseOfferingId: "a" },
    ]);
  });

  it("requests newly selected plan offerings and later-resolved courses", () => {
    start();
    courseIndexStore.actions.setCourses([course("a")]);
    activate(plan("first", ["a", "b"]));
    expect(ensure).toHaveBeenLastCalledWith([
      { courseUnitId: "unit-a", courseOfferingId: "a" },
    ]);

    courseIndexStore.actions.setHistoricalCourses([course("b")]);
    flushSync();
    expect(ensure).toHaveBeenLastCalledWith([
      { courseUnitId: "unit-a", courseOfferingId: "a" },
      { courseUnitId: "unit-b", courseOfferingId: "b" },
    ]);

    activate(plan("second", ["b"]));
    expect(ensure).toHaveBeenLastCalledWith([
      { courseUnitId: "unit-b", courseOfferingId: "b" },
    ]);
  });

  it("does not load while authentication is pending or signed out", () => {
    start("account-a", true);
    courseIndexStore.actions.setCourses([course("a")]);
    activate(plan("first", ["a"]));
    expect(ensure).not.toHaveBeenCalled();
  });
});
