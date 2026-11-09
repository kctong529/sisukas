// @vitest-environment jsdom
import { flushSync, mount, unmount } from "svelte";
import { writable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { courseGradeStore } from "@lib/stores/courseGradeStore";
import { courseIndexStore } from "@lib/stores/courseIndexStore.svelte";
import { favouritesStore } from "@lib/stores/favouritesStore";
import { plansStore } from "@lib/stores/plansStore.svelte";
import { getStudyGroupDataRuntime } from "@modules/study-groups";

import AuthenticatedDataLifecycleHarness from "./AuthenticatedDataLifecycleHarness.svelte";

import type { Course } from "@domain/models/Course";
import type { Plan } from "@domain/models/Plan";

type SessionContext = { pending: boolean; userId: string | null };

const course = (id: string): Course => ({
  id,
  unitId: `unit-${id}`,
  code: { value: id },
}) as Course;

const plan = (id: string, userId: string, instanceIds: string[]): Plan => ({
  id,
  userId,
  name: id,
  isActive: true,
  instanceIds,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

let target: HTMLElement;
let component: ReturnType<typeof mount> | null;
let session: ReturnType<typeof writable<SessionContext>>;
let ensure: ReturnType<typeof vi.spyOn>;
let clearRuntime: ReturnType<typeof vi.spyOn>;

function activate(value: Plan): void {
  plansStore.state.byId = new Map([[value.id, value]]);
  plansStore.state.ids = [value.id];
  plansStore.state.activePlanId = value.id;
  plansStore.state.loaded = true;
  flushSync();
}

function updateSession(next: SessionContext): void {
  session.set(next);
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

  const runtime = getStudyGroupDataRuntime();
  ensure = vi.spyOn(runtime, "ensure").mockResolvedValue();
  clearRuntime = vi.spyOn(runtime, "clear");

  session = writable({ pending: false, userId: "account-a" });
  target = document.createElement("div");
  document.body.append(target);
  component = mount(AuthenticatedDataLifecycleHarness, {
    target,
    props: { session },
  });
  flushSync();
});

afterEach(async () => {
  if (component) await unmount(component);
  component = null;
  target.remove();
  vi.restoreAllMocks();
  plansStore.actions.clear();
  getStudyGroupDataRuntime().clear();
});

describe("authenticated study-group loading integration review", () => {
  it("does not request data again for an unchanged session or unrelated plan state", () => {
    courseIndexStore.actions.setCourses([course("a")]);
    activate(plan("first", "account-a", ["a"]));
    expect(ensure).toHaveBeenCalledTimes(1);

    updateSession({ pending: false, userId: "account-a" });
    expect(ensure).toHaveBeenCalledTimes(1);

    plansStore.state.error = "unrelated state";
    flushSync();
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it("does not clear data or restart loading for a temporary pending session", () => {
    courseIndexStore.actions.setCourses([course("a")]);
    activate(plan("first", "account-a", ["a"]));
    const originalClears = clearRuntime.mock.calls.length;
    const originalLoads = ensure.mock.calls.length;

    updateSession({ pending: true, userId: null });
    expect(clearRuntime).toHaveBeenCalledTimes(originalClears);
    expect(ensure).toHaveBeenCalledTimes(originalLoads);

    updateSession({ pending: false, userId: "account-a" });
    expect(clearRuntime).toHaveBeenCalledTimes(originalClears);
    expect(ensure).toHaveBeenCalledTimes(originalLoads + 1);
  });

  it("clears the old account's cache on logout without loading again", () => {
    courseIndexStore.actions.setCourses([course("a")]);
    activate(plan("first", "account-a", ["a"]));
    const originalClears = clearRuntime.mock.calls.length;
    const originalLoads = ensure.mock.calls.length;

    updateSession({ pending: false, userId: null });
    expect(clearRuntime).toHaveBeenCalledTimes(originalClears + 1);
    expect(plansStore.state.loaded).toBe(false);
    expect(ensure).toHaveBeenCalledTimes(originalLoads);
  });

  it("does not load the previous account's plan during a direct account switch", () => {
    courseIndexStore.actions.setCourses([course("a"), course("b")]);
    activate(plan("first", "account-a", ["a"]));
    const originalClears = clearRuntime.mock.calls.length;
    const originalLoads = ensure.mock.calls.length;

    updateSession({ pending: false, userId: "account-b" });
    expect(clearRuntime).toHaveBeenCalledTimes(originalClears + 1);
    expect(plansStore.state.loaded).toBe(false);
    expect(ensure).toHaveBeenCalledTimes(originalLoads);

    activate(plan("second", "account-b", ["b"]));
    expect(ensure).toHaveBeenLastCalledWith([
      { courseUnitId: "unit-b", courseOfferingId: "b" },
    ]);
    expect(ensure).toHaveBeenCalledTimes(originalLoads + 1);
  });
});
