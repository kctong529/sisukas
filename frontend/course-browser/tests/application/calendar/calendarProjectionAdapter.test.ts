import { describe, expect, it } from "vitest";
import {
  projectPlanFromSources,
  readStudyGroupSnapshot,
  type CalendarProjectionSources,
} from "@application/calendar/calendarProjectionAdapter";
import type { Plan } from "@domain/models/Plan";
import type { Course } from "@domain/models/Course";
import type { StudyGroup } from "@domain/models/StudyGroup";

const plan: Plan = {
  id: "p", userId: "u", name: "Plan", isActive: true,
  instanceIds: ["offering"], createdAt: new Date(0), updatedAt: new Date(0),
};

function sources(groups: readonly StudyGroup[] | null, loading = false, stale = false): CalendarProjectionSources {
  return {
    resolveCourse: () => ({ id: "offering", unitId: "unit" }) as Course,
    readGroups: () => groups,
    isLoading: () => loading,
    isStale: () => stale,
  };
}

describe("calendar projection store adapter", () => {
  it("treats successfully empty full data as available", () => {
    expect(readStudyGroupSnapshot(sources([]), "unit", "offering")).toEqual({availability: "available", groups: []});
    const result = projectPlanFromSources(plan, sources([]));
    expect(result.completeness.availableCourses).toBe(1);
    expect(result.entries).toEqual([]);
  });
  it("uses stale full data during refresh", () => {
    expect(readStudyGroupSnapshot(sources([], true, true), "unit", "offering").availability).toBe("stale");
  });
  it("distinguishes missing and loading full data", () => {
    expect(readStudyGroupSnapshot(sources(null), "unit", "offering").availability).toBe("missing");
    expect(readStudyGroupSnapshot(sources(null, true), "unit", "offering").availability).toBe("loading");
  });
  it("does not mutate the plan or request data", () => {
    const frozen = Object.freeze({...plan, instanceIds: Object.freeze(["offering"])}) as unknown as Plan;
    expect(projectPlanFromSources(frozen, sources(null)).completeness.missingCourses).toBe(1);
  });
  it("forwards explicit selection without treating blocks as selection", () => {
    const chosen = projectPlanFromSources(plan, {
      ...sources([{
        groupId: "H01", name: "H01", type: "Exercise",
        studyEvents: [{
          id: "event", seriesId: "series",
          start: "2026-11-02T10:00:00", end: "2026-11-02T11:00:00",
          startIso: "2026-11-02T10:00:00+02:00", endIso: "2026-11-02T11:00:00+02:00",
          cancelled: false, excluded: false, locationIds: [], locations: [],
        }],
      }]),
      readSelection: () => ({ studyGroupIds: ["H01"] }),
    });
    expect(chosen.selectionByOffering.offering).toBe("selected");
    expect(chosen.entries).toHaveLength(1);
    expect(projectPlanFromSources(plan, sources([])).selectionByOffering.offering).toBe("candidate");
  });

  it("reports unresolved offerings as missing", () => {
    const unavailable = {...sources(null), resolveCourse: () => undefined};
    expect(projectPlanFromSources(plan, unavailable).diagnostics[0].code).toBe("missing_course_offering");
  });
});
