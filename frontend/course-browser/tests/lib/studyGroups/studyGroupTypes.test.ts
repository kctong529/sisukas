import { describe, expect, it } from "vitest";
import {
  studyGroupKey,
  type StudyGroupEntry,
} from "../../../src/lib/studyGroups/studyGroupTypes";

describe("studyGroupKey", () => {
  it("uses the existing wrapper response key format", () => {
    expect(studyGroupKey({
      courseUnitId: "unit-1",
      courseOfferingId: "offering-1",
    })).toBe("unit-1:offering-1");
  });

  it("distinguishes offerings of the same course unit", () => {
    const a = studyGroupKey({ courseUnitId: "unit-1", courseOfferingId: "a" });
    const b = studyGroupKey({ courseUnitId: "unit-1", courseOfferingId: "b" });
    expect(a).not.toBe(b);
  });
});

describe("full-data availability", () => {
  it("distinguishes successful emptiness from missing data", () => {
    const missing: StudyGroupEntry = {
      groups: null, status: "missing", fetchedAt: null,
      error: null, refreshing: false,
    };
    const readyEmpty: StudyGroupEntry = {
      groups: [], status: "ready", fetchedAt: 123,
      error: null, refreshing: false,
    };
    expect(missing.groups).toBeNull();
    expect(readyEmpty.groups).toEqual([]);
  });
});
