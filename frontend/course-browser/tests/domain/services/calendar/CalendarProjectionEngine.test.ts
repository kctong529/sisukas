import { describe, expect, it, vi } from "vitest";
import { projectActivePlan, type StudyGroupSnapshot, type StudyGroupSelection } from
  "@domain/services/calendar/CalendarProjection";
import type { Plan } from "@domain/models/Plan";
import type { Course } from "@domain/models/Course";
import type { StudyGroup } from "@domain/models/StudyGroup";
import type { StudyEvent } from "@domain/models/StudyEvent";

const plan = (ids: string[]): Plan => ({
  id: "plan", userId: "user", name: "Plan", isActive: true,
  instanceIds: ids, createdAt: new Date(0), updatedAt: new Date(0),
});
const course = (id: string): Course => ({ id, unitId: `unit-${id}` }) as Course;
const event = (overrides: Partial<StudyEvent> = {}): StudyEvent => ({
  id: "legacy:0", seriesId: "series-1",
  start: "2026-11-02T10:00:00", end: "2026-11-02T11:00:00",
  startIso: "2026-11-02T10:00:00+02:00",
  endIso: "2026-11-02T11:00:00+02:00",
  cancelled: false, excluded: false, locationIds: [], locations: [],
  ...overrides,
});
const group = (id: string, events: StudyEvent[]): StudyGroup => ({
  groupId: id, name: id, type: "Lecture", studyEvents: events,
});
function project(ids: string[], snapshots: Record<string, StudyGroupSnapshot>,
  found: Record<string, Course | undefined> = Object.fromEntries(ids.map(id => [id, course(id)]))) {
  const getCourseForOffering = vi.fn((id: string) => found[id]);
  const getStudyGroups = vi.fn((_unit: string, offering: string) => snapshots[offering]);
  const result = projectActivePlan({ plan: plan(ids), getCourseForOffering, getStudyGroups });
  return { result, getCourseForOffering, getStudyGroups };
}

const available = (groups: StudyGroup[]): StudyGroupSnapshot => ({ availability: "available", groups });

describe("projectActivePlan stage 2", () => {
  it("handles an empty plan without performing lookups", () => {
    const { result, getCourseForOffering, getStudyGroups } = project([], {});
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.completeness.status).toBe("complete");
    expect(getCourseForOffering).not.toHaveBeenCalled();
    expect(getStudyGroups).not.toHaveBeenCalled();
  });

  it("projects a source occurrence with its association and validated interval", () => {
    const source = event();
    const { result, getStudyGroups } = project(["off-1"], { "off-1": available([group("L01", [source])]) });
    expect(getStudyGroups).toHaveBeenCalledWith("unit-off-1", "off-1");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: "fixed", occurrenceKey: expect.any(String),
      source: { courseOfferingId: "off-1", studyGroupId: "L01", seriesId: "series-1", event: source },
    });
    expect(result.entries[0].interval).toEqual({
      startMs: Date.parse("2026-11-02T08:00:00Z"),
      endMs: Date.parse("2026-11-02T09:00:00Z"),
    });
  });

  it("sorts entries by absolute start time, independent of source order", () => {
    const late = event({ start: "2026-11-02T14:00:00", end: "2026-11-02T15:00:00", startIso: "2026-11-02T14:00:00+02:00", endIso: "2026-11-02T15:00:00+02:00" });
    const early = event({ seriesId: "series-2" });
    const { result } = project(["off-1"], { "off-1": available([group("L01", [late, early])]) });
    expect(result.entries.map(e => e.source.event)).toEqual([early, late]);
  });

  it("retains valid entries and reports invalid intervals with source context", () => {
    const invalid = event({ seriesId: "bad", startIso: undefined });
    const { result } = project(["off-1"], { "off-1": available([group("L01", [invalid, event()])]) });
    expect(result.entries).toHaveLength(1);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "missing_offset_timestamp", severity: "error", field: "start",
      source: { courseOfferingId: "off-1", studyGroupId: "L01", seriesId: "bad" },
    }));
  });

  it("keeps stale cached entries and reports partial completeness", () => {
    const { result } = project(["off-1"], { "off-1": { availability: "stale", groups: [group("L01", [event()])] } });
    expect(result.entries).toHaveLength(1);
    expect(result.completeness).toMatchObject({ status: "partial", staleCourses: 1 });
    expect(result.diagnostics.map(d => d.code)).toContain("study_groups_stale");
  });

  it.each(["missing", "loading", "failed"] as const)("skips %s data without fabricating events", status => {
    const { result } = project(["off-1"], { "off-1": { availability: status, groups: null } });
    expect(result.entries).toEqual([]);
    expect(result.completeness.status).toBe("partial");
    expect(result.diagnostics).toHaveLength(1);
  });

  it("treats a successful empty response as complete", () => {
    const { result } = project(["off-1"], { "off-1": available([]) });
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.completeness).toMatchObject({ status: "complete", availableCourses: 1 });
  });

  it("reports course offerings absent from the index without a study-group lookup", () => {
    const { result, getStudyGroups } = project(["off-1"], {}, { "off-1": undefined });
    expect(result.completeness).toMatchObject({ status: "partial", missingCourses: 1 });
    expect(result.diagnostics[0].code).toBe("missing_course_offering");
    expect(getStudyGroups).not.toHaveBeenCalled();
  });

  it("counts duplicate plan IDs once", () => {
    const { result, getStudyGroups } = project(["off-1", "off-1"], { "off-1": available([group("L01", [event()])]) });
    expect(result.entries).toHaveLength(1);
    expect(result.completeness.totalCourses).toBe(1);
    expect(getStudyGroups).toHaveBeenCalledTimes(1);
  });

  it("does not mutate frozen source records", () => {
    const source = Object.freeze(event({ locationIds: Object.freeze(["room-1"]) as unknown as string[] }));
    const groups = Object.freeze([Object.freeze(group("L01", [source]))]);
    const { result } = project(["off-1"], { "off-1": { availability: "available", groups } });
    expect(result.entries).toHaveLength(1);
    expect(source.locationIds).toEqual(["room-1"]);
  });

  it("preserves identity collisions for stage 3 policy handling", () => {
    const first = event();
    const second = event({ id: "legacy:1" });
    const { result } = project(["off-1"], { "off-1": available([group("L01", [first, second])]) });
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every(entry => entry.occurrenceKey === null)).toBe(true);
    expect(result.diagnostics.filter(d => d.code === "occurrence_key_collision")).toHaveLength(2);
  });
});


describe("projectActivePlan stage 3 policies", () => {
  const withSelection = (
    groups: StudyGroup[],
    selection: StudyGroupSelection | null | undefined,
  ) => projectActivePlan({
    plan: plan(["off-1"]),
    getCourseForOffering: () => course("off-1"),
    getStudyGroups: () => available(groups),
    ...(selection === undefined ? {} : { getSelection: () => selection }),
  });

  it("uses all groups as candidates when selection is absent or null", () => {
    const groups = [group("L01", [event()]), group("L02", [event()])];
    expect(withSelection(groups, undefined).entries).toHaveLength(2);
    expect(withSelection(groups, null).entries).toHaveLength(2);
  });

  it("restricts projection to explicitly selected groups", () => {
    const result = withSelection([
      group("L01", [event()]), group("L02", [event()]),
    ], { studyGroupIds: ["L02"] });
    expect(result.entries.map(e => e.source.studyGroupId)).toEqual(["L02"]);
    expect(result.completeness.status).toBe("complete");
  });

  it("treats explicit empty selection differently from absent selection", () => {
    const result = withSelection([group("L01", [event()])], { studyGroupIds: [] });
    expect(result.entries).toEqual([]);
    expect(result.completeness.availableCourses).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it("reports unknown selected groups without falling back", () => {
    const result = withSelection([group("L01", [event()])], { studyGroupIds: ["L99"] });
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "selected_study_group_missing",
      source: { courseOfferingId: "off-1", studyGroupId: "L99" },
    }));
  });

  it("does not duplicate repeated selected IDs", () => {
    const result = withSelection([group("L01", [event()])], { studyGroupIds: ["L01", "L01"] });
    expect(result.entries).toHaveLength(1);
  });

  it("retains cancelled occurrences, which cannot occupy conflict time", () => {
    const result = withSelection([group("L01", [event({ cancelled: true })])], null);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].source.event.cancelled).toBe(true);
  });

  it("omits excluded occurrences and records a trace diagnostic", () => {
    const result = withSelection([group("L01", [event({ excluded: true })])], null);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      severity: "warning", code: "excluded_occurrence",
      source: { courseOfferingId: "off-1", studyGroupId: "L01", seriesId: "series-1" },
    }));
    expect(result.completeness.status).toBe("complete");
  });

  it("gives exclusion precedence over cancellation and invalid timestamps", () => {
    const result = withSelection([group("L01", [event({ cancelled: true, excluded: true, startIso: undefined })])], null);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics.map(d => d.code)).toEqual(["excluded_occurrence"]);
  });

  it("deduplicates repeated event object references inside one association", () => {
    const source = event();
    const result = withSelection([group("L01", [source, source])], null);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].occurrenceKey).not.toBeNull();
    expect(result.diagnostics.filter(d => d.code === "occurrence_key_collision")).toHaveLength(0);
  });

  it("preserves the same event across distinct study groups", () => {
    const source = event();
    const result = withSelection([group("L01", [source]), group("L02", [source])], null);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map(e => e.source.studyGroupId)).toEqual(["L01", "L02"]);
  });

  it("keeps distinct records with colliding keys unresolved", () => {
    const result = withSelection([group("L01", [event(), event({ id: "different-legacy-id" })])], null);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every(e => e.occurrenceKey === null)).toBe(true);
    expect(result.diagnostics.filter(d => d.code === "occurrence_key_collision")).toHaveLength(2);
  });

  it("preserves distinct occurrences from duplicate group IDs and diagnoses them", () => {
    const first = event({ seriesId: "series-1" });
    const second = event({ seriesId: "series-2" });
    const result = withSelection([
      group("L01", [first]), group("L01", [second]),
    ], null);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map(e => e.source.event)).toEqual([first, second]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      severity: "warning", code: "duplicate_study_group_id",
      source: { courseOfferingId: "off-1", studyGroupId: "L01" },
    }));
    expect(result.completeness.status).toBe("complete");
  });

  it("deduplicates event references across duplicate group objects", () => {
    const source = event();
    const result = withSelection([
      group("L01", [source]), group("L01", [source]),
    ], null);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].occurrenceKey).not.toBeNull();
    expect(result.diagnostics.filter(d => d.code === "duplicate_study_group_id")).toHaveLength(1);
    expect(result.diagnostics.filter(d => d.code === "occurrence_key_collision")).toHaveLength(0);
  });

  it("preserves distinct colliding records across duplicate group objects", () => {
    const result = withSelection([
      group("L01", [event()]), group("L01", [event({ id: "another-id" })]),
    ], null);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every(e => e.occurrenceKey === null)).toBe(true);
    expect(result.diagnostics.filter(d => d.code === "occurrence_key_collision")).toHaveLength(2);
  });

  it("emits one exclusion diagnostic for a repeated event reference", () => {
    const excluded = event({ excluded: true });
    const result = withSelection([group("L01", [excluded, excluded])], null);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics.filter(d => d.code === "excluded_occurrence")).toHaveLength(1);
  });

  it("does not repeat exclusion diagnostics across duplicate group objects", () => {
    const excluded = event({ excluded: true });
    const result = withSelection([
      group("L01", [excluded]), group("L01", [excluded]),
    ], null);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics.filter(d => d.code === "excluded_occurrence")).toHaveLength(1);
    expect(result.diagnostics.filter(d => d.code === "duplicate_study_group_id")).toHaveLength(1);
  });

  it("does not emit duplicate-group warnings for unselected groups", () => {
    const result = withSelection([
      group("L01", [event()]), group("L01", [event()]), group("L02", [event()]),
    ], { studyGroupIds: ["L02"] });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].source.studyGroupId).toBe("L02");
    expect(result.diagnostics.filter(d => d.code === "duplicate_study_group_id")).toHaveLength(0);
  });

  it("does not mutate frozen selections or events", () => {
    const source = Object.freeze(event());
    const selection = Object.freeze({ studyGroupIds: Object.freeze(["L01"]) });
    const result = withSelection([group("L01", [source])], selection);
    expect(result.entries).toHaveLength(1);
    expect(selection.studyGroupIds).toEqual(["L01"]);
  });
});
