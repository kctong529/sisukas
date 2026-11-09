// @vitest-environment jsdom
import { flushSync, mount, unmount } from "svelte";
import { get, writable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getStudyGroupDataRuntime } from "@modules/study-groups";

import StudyGroupsSection from "../../../src/components/courses/StudyGroupsSection.svelte";

import type { Course } from "@domain/models/Course";
import type { StudyGroupEntry } from "@modules/study-groups";

const request = { courseUnitId: "unit-a", courseOfferingId: "offering-a" };
const course = { unitId: request.courseUnitId, id: request.courseOfferingId } as Course;
const missing = (): StudyGroupEntry => ({
  status: "missing", groups: null, fetchedAt: null, error: null, refreshing: false,
});
const ready = (groups: NonNullable<StudyGroupEntry["groups"]>): StudyGroupEntry => ({
  status: "ready", groups, fetchedAt: 123, error: null, refreshing: false,
});
const group = {
  groupId: "lecture-1", name: "Lecture group", type: "Lecture", studyEvents: [],
};

let target: HTMLElement;
let component: ReturnType<typeof mount> | null;
let entries: ReturnType<typeof writable<StudyGroupEntry>>;
let ensure: ReturnType<typeof vi.spyOn>;
let entry: ReturnType<typeof vi.spyOn>;

function render(isExpanded: boolean): void {
  component = mount(StudyGroupsSection, { target, props: { course, isExpanded } });
  flushSync();
}

beforeEach(() => {
  entries = writable(missing());
  const runtime = getStudyGroupDataRuntime();
  entry = vi.spyOn(runtime, "entry").mockImplementation(() => entries);
  ensure = vi.spyOn(runtime, "ensure").mockResolvedValue();
  target = document.createElement("div");
  document.body.append(target);
  component = null;
});

afterEach(async () => {
  if (component) await unmount(component);
  target.remove();
  vi.restoreAllMocks();
});

describe("StudyGroupsSection authoritative runtime integration", () => {
  it("observes a collapsed course without fetching", () => {
    render(false);
    expect(entry).toHaveBeenCalledWith(request);
    expect(ensure).not.toHaveBeenCalled();
    expect(target.textContent).toContain("Study groups not loaded yet");
  });

  it("explicitly ensures expanded course data and displays full groups", () => {
    render(true);
    expect(ensure).toHaveBeenCalledOnce();
    expect(ensure).toHaveBeenCalledWith([request]);
    entries.set(ready([group]));
    flushSync();
    expect(target.textContent).toContain("Lecture group");
    expect(target.textContent).not.toContain("No study groups available");
  });

  it("distinguishes a successfully empty result from missing data", () => {
    render(false);
    entries.set(ready([]));
    flushSync();
    expect(target.textContent).toContain("No study groups available");
    expect(get(entries).groups).toEqual([]);
  });

  it("shows load failures and offers an explicit retry", () => {
    render(true);
    entries.set({ ...missing(), status: "failed", error: "Service unavailable" });
    flushSync();
    expect(target.querySelector('[role="alert"]')?.textContent).toContain("Unable to load");
    target.querySelector<HTMLButtonElement>("button.retry")?.click();
    expect(ensure).toHaveBeenCalledTimes(2);
  });

  it("retains full data during refresh", () => {
    render(false);
    entries.set({ ...ready([group]), refreshing: true });
    flushSync();
    expect(target.textContent).toContain("Lecture group");
    expect(target.textContent).toContain("Refreshing...");
  });
});
