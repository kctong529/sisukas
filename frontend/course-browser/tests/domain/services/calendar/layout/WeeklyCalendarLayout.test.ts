import { describe, expect, it } from "vitest";
import type { CalendarEntry } from "@domain/models/CalendarEntry";
import { layoutCalendarWeek } from "@domain/services/calendar/layout/WeeklyCalendarLayout";
import { fixed, NORMAL_WEEK } from "./fixtures";

const WEEK = NORMAL_WEEK;

describe("WeeklyCalendarLayout", () => {
  it("positions Helsinki-local entries without modifying source timestamps", () => {
    const entry = fixed("a", "2026-11-02T10:15:30+02:00", "2026-11-02T11:00:00+02:00");
    const before = JSON.stringify(entry);
    const result = layoutCalendarWeek([entry], WEEK);
    expect(result.diagnostics).toEqual([]);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({ dayIndex: 0, startMinute: 615.5, endMinute: 660,
      startUtcOffsetMinutes: 120, endUtcOffsetMinutes: 120, continuesBefore: false, continuesAfter: false });
    expect(JSON.stringify(entry)).toBe(before);
  });

  it("splits midnight-spanning entries, retaining the original association", () => {
    const entry = fixed("overnight", "2026-11-02T23:30:00+02:00", "2026-11-03T01:00:00+02:00");
    const result = layoutCalendarWeek([entry], WEEK);
    expect(result.segments.map(s => [s.dayIndex, s.startMinute, s.endMinute]))
      .toEqual([[0, 1410, 1440], [1, 0, 60]]);
    expect(result.segments.every(s => s.entry === entry)).toBe(true);
    expect(result.segments.map(s => [s.continuesBefore, s.continuesAfter]))
      .toEqual([[false, true], [true, false]]);
  });

  it("clips both week edges, including December/January boundaries", () => {
    const entry = fixed("boundary", "2026-12-27T23:00:00+02:00", "2027-01-04T02:00:00+02:00");
    const result = layoutCalendarWeek([entry], "2026-12-28");
    expect(result.days).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31",
      "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
    expect(result.segments).toHaveLength(7);
    expect(result.segments[0].continuesBefore).toBe(true);
    expect(result.segments[6].continuesAfter).toBe(true);
  });

  it("rejects malformed, non-Monday and impossible week starts", () => {
    expect(() => layoutCalendarWeek([], "2026-11-03")).toThrow(/Monday/);
    expect(() => layoutCalendarWeek([], "2026-02-30")).toThrow(/Invalid ISO date/);
    expect(() => layoutCalendarWeek([], "garbage")).toThrow(/Invalid ISO date/);
  });

  it("treats half-open adjacency as non-overlapping", () => {
    const result = layoutCalendarWeek([
      fixed("a", "2026-11-02T09:00:00+02:00", "2026-11-02T10:00:00+02:00"),
      fixed("b", "2026-11-02T10:00:00+02:00", "2026-11-02T11:00:00+02:00"),
    ], WEEK);
    expect(result.overlapGroups).toHaveLength(2);
    expect(result.segments.map(s => s.columnCount)).toEqual([1, 1]);
  });

  it("preserves four concurrent associations and supports disclosure", () => {
    const entries = ["a", "b", "c", "d"].map(key =>
      fixed(key, "2026-11-02T10:00:00+02:00", "2026-11-02T11:00:00+02:00"));
    const result = layoutCalendarWeek(entries, WEEK);
    expect(result.segments).toHaveLength(4);
    expect(result.overlapGroups).toHaveLength(1);
    expect(result.overlapGroups[0]).toMatchObject({ maxConcurrency: 4, supportsProgressiveDisclosure: true });
    expect(result.segments.map(s => s.columnIndex)).toEqual([0, 1, 2, 3]);
    expect(result.segments.every(s => s.columnCount === 4)).toBe(true);
  });

  it("reuses lanes in transitive overlap components", () => {
    const entries = [
      fixed("a", "2026-11-02T09:00:00+02:00", "2026-11-02T10:30:00+02:00"),
      fixed("b", "2026-11-02T10:00:00+02:00", "2026-11-02T11:30:00+02:00"),
      fixed("c", "2026-11-02T11:00:00+02:00", "2026-11-02T12:00:00+02:00"),
    ];
    const result = layoutCalendarWeek(entries, WEEK);
    expect(result.overlapGroups).toHaveLength(1);
    expect(result.overlapGroups[0].maxConcurrency).toBe(2);
    expect(result.segments.map(s => s.columnIndex)).toEqual([0, 1, 0]);
  });

  it("positions cancelled/excluded occurrences without occupying conflict lanes", () => {
    const entries = [
      fixed("a", "2026-11-02T09:00:00+02:00", "2026-11-02T10:00:00+02:00"),
      fixed("cancelled", "2026-11-02T09:00:00+02:00", "2026-11-02T10:00:00+02:00", { cancelled: true }),
      fixed("excluded", "2026-11-02T09:00:00+02:00", "2026-11-02T10:00:00+02:00", { excluded: true }),
    ];
    const result = layoutCalendarWeek(entries, WEEK);
    expect(result.segments).toHaveLength(3);
    expect(result.overlapGroups).toHaveLength(1);
    expect(result.overlapGroups[0].maxConcurrency).toBe(1);
    expect(result.segments.filter(s => !s.conflictEligible).every(s => s.overlapGroupId === null)).toBe(true);
  });

  it("keeps distinct null-key source associations and is permutation deterministic", () => {
    const a = fixed(null, "2026-11-02T10:00:00+02:00", "2026-11-02T11:00:00+02:00", { group: "group-a" });
    const b = fixed(null, "2026-11-02T10:00:00+02:00", "2026-11-02T11:00:00+02:00", { group: "group-b" });
    const c = fixed("c", "2026-11-03T10:00:00+02:00", "2026-11-03T11:00:00+02:00");
    const normalize = (entries: CalendarEntry[]) => {
      const { segments, overlapGroups, diagnostics } = layoutCalendarWeek(entries, WEEK);
      return {
        segments: segments.map(({ entry, ...segment }) => ({ ...segment, association: entry.source.studyGroupId })),
        overlapGroups, diagnostics,
      };
    };
    expect(normalize([a, b, c])).toEqual(normalize([c, b, a]));
    expect(normalize([a, b, c]).segments).toHaveLength(3);
  });

  it("retains duplicate indistinguishable occurrence associations as separate segments", () => {
    const a = fixed(null, "2026-11-02T09:00:00+02:00", "2026-11-02T10:00:00+02:00");
    const b = structuredClone(a);
    const result = layoutCalendarWeek([a, b], WEEK);
    expect(result.segments).toHaveLength(2);
    expect(new Set(result.segments.map(s => s.id)).size).toBe(2);
  });

  it("accepts very short entries but diagnoses invalid intervals", () => {
    const short = fixed("short", "2026-11-02T10:00:00+02:00", "2026-11-02T10:00:01+02:00");
    const invalid = fixed("bad", "2026-11-02T11:00:00+02:00", "2026-11-02T12:00:00+02:00");
    invalid.interval.endMs = invalid.interval.startMs;
    const result = layoutCalendarWeek([short, invalid], WEEK);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].endMinute - result.segments[0].startMinute).toBeCloseTo(1 / 60);
    expect(result.diagnostics.map(d => d.code)).toEqual(["invalid_interval"]);
  });

  it("splits spring-forward segments at the offset change", () => {
    const event = fixed("spring", "2027-03-28T02:30:00+02:00", "2027-03-28T04:30:00+03:00");
    const result = layoutCalendarWeek([event], "2027-03-22");
    expect(result.segments.map(s => [s.dayIndex, s.startMinute, s.endMinute]))
      .toEqual([[6, 150, 180], [6, 240, 270]]);
    expect(result.segments.map(s => s.startUtcOffsetMinutes)).toEqual([120, 180]);
    expect(result.segments.reduce((n, s) => n + s.interval.endMs - s.interval.startMs, 0))
      .toBe(60 * 60_000);
  });

  it("splits a fall-back event without losing repeated-hour identity", () => {
    const event = fixed("fall", "2026-10-25T03:30:00+03:00", "2026-10-25T03:30:00+02:00");
    const result = layoutCalendarWeek([event], "2026-10-19");
    expect(result.segments.map(s => [s.startMinute, s.endMinute]))
      .toEqual([[210, 240], [180, 210]]);
    expect(result.segments.map(s => s.startUtcOffsetMinutes)).toEqual([180, 120]);
    expect(result.segments.reduce((n, s) => n + s.interval.endMs - s.interval.startMs, 0))
      .toBe(60 * 60_000);
  });

  it("disambiguates repeated autumn wall times with UTC offsets and absolute ordering", () => {
    const first = fixed("first", "2026-10-25T03:15:00+03:00", "2026-10-25T03:45:00+03:00");
    const second = fixed("second", "2026-10-25T03:15:00+02:00", "2026-10-25T03:45:00+02:00");
    const result = layoutCalendarWeek([second, first], "2026-10-19");
    expect(result.segments.map(s => s.startMinute)).toEqual([195, 195]);
    expect(result.segments.map(s => s.startUtcOffsetMinutes)).toEqual([180, 120]);
    expect(result.overlapGroups).toHaveLength(2); // absolute intervals do not overlap
  });

  it("ignores flexible windows while preserving fixed entries", () => {
    const entry = fixed("fixed", "2026-11-02T09:00:00+02:00", "2026-11-02T10:00:00+02:00");
    const result = layoutCalendarWeek([
      entry, { ...entry, kind: "flexible-window", evidence: {
        kind: "verified-source-classification", sourceField: "type", sourceValue: "window",
      } },
    ], WEEK);
    expect(result.segments).toHaveLength(1);
  });
});
