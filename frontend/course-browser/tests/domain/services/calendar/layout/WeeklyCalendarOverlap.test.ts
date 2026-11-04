import { describe, expect, it } from "vitest";
import { assignOverlapLanes } from "@domain/services/calendar/layout/WeeklyCalendarOverlap";
import { at, fixed, mondaySegments } from "./fixtures";

function grouped(...events: Array<[string, number, number]>) {
  const entries = events.map(([id, start, end]) => fixed(id, at(start), at(end)));
  const { segments, days } = mondaySegments(entries);
  const groups = assignOverlapLanes(segments, days);
  const byKey = (id: string) => {
    const segment = segments.find(s => s.entry.occurrenceKey === id);
    if (!segment) throw new Error(`Missing segment: ${id}`);
    return segment;
  };
  return { segments, groups, byKey, days };
}

describe("WeeklyCalendarOverlap — interval partitioning", () => {
  it("returns no groups for an empty week", () => {
    const { segments, days } = mondaySegments([]);
    expect(assignOverlapLanes(segments, days)).toEqual([]);
  });

  it("assigns a single entry to the first lane", () => {
    const { groups, byKey } = grouped(["A", 9, 10]);
    expect(groups).toMatchObject([{ dayIndex: 0, maxConcurrency: 1,
      supportsProgressiveDisclosure: false }]);
    expect(byKey("A")).toMatchObject({ columnIndex: 0, columnCount: 1,
      overlapGroupId: groups[0].id });
  });

  it("places exactly adjacent half-open intervals in separate groups", () => {
    const { groups, byKey } = grouped(["A", 9, 10], ["B", 10, 11]);
    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.maxConcurrency)).toEqual([1, 1]);
    expect(byKey("A").columnIndex).toBe(0);
    expect(byKey("B").columnIndex).toBe(0);
  });

  it("groups intervals overlapping by exactly one millisecond", () => {
    const a = fixed("A", at(9), at(10));
    const b = fixed("B", at(10), at(11));
    b.interval.startMs = a.interval.endMs - 1;
    const { segments, days } = mondaySegments([a, b]);
    const groups = assignOverlapLanes(segments, days);
    expect(groups).toHaveLength(1);
    expect(groups[0].maxConcurrency).toBe(2);
    expect(segments.map(s => s.columnCount)).toEqual([2, 2]);
  });

  it("assigns simultaneous events to distinct lanes", () => {
    const { groups, segments } = grouped(["A", 9, 10], ["B", 9, 10], ["C", 9, 10]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ maxConcurrency: 3,
      supportsProgressiveDisclosure: false });
    expect(segments.map(s => s.columnIndex).sort()).toEqual([0, 1, 2]);
    expect(segments.every(s => s.columnCount === 3)).toBe(true);
  });

  it("enables disclosure at four simultaneous intervals, not three", () => {
    const { groups } = grouped(["A", 9, 10], ["B", 9, 10], ["C", 9, 10], ["D", 9, 10]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ maxConcurrency: 4,
      supportsProgressiveDisclosure: true });
  });

  it("reuses a freed lane in a connected overlap component", () => {
    const { groups, byKey } = grouped(["A", 9, 11], ["B", 10, 12], ["C", 11, 13]);
    expect(groups).toHaveLength(1);
    expect(groups[0].maxConcurrency).toBe(2);
    expect([byKey("A").columnIndex, byKey("B").columnIndex, byKey("C").columnIndex])
      .toEqual([0, 1, 0]);
  });

  it("counts peak concurrency rather than total component size", () => {
    const { groups, segments } = grouped(["A", 9, 11], ["B", 10, 12], ["C", 11, 13], ["D", 12, 14]);
    expect(groups).toHaveLength(1);
    expect(groups[0].segmentIds).toHaveLength(4);
    expect(groups[0].maxConcurrency).toBe(2);
    expect(groups[0].supportsProgressiveDisclosure).toBe(false);
    expect(segments.every(s => s.columnCount === 2)).toBe(true);
  });

  it("uses deterministic day-scoped group IDs", () => {
    const { groups, days } = grouped(["A", 9, 10], ["B", 11, 12]);
    expect(groups.map(g => g.id)).toEqual([
      `${days[0]}:group:0`, `${days[0]}:group:1`,
    ]);
  });

  it("is deterministic under input permutation", () => {
    const a = fixed("A", at(9), at(11));
    const b = fixed("B", at(9), at(11));
    const c = fixed("C", at(10), at(12));
    const normalize = (entries: typeof a[]) => {
      const { segments, days } = mondaySegments(entries);
      const groups = assignOverlapLanes(segments, days);
      return {
        segments: segments.map(s => [s.id, s.columnIndex, s.columnCount, s.overlapGroupId])
          .sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
        groups,
      };
    };
    expect(normalize([a, b, c])).toEqual(normalize([c, b, a]));
  });
});

describe("WeeklyCalendarOverlap — occupancy policies", () => {
  it("does not give cancelled/excluded occurrences conflict lanes", () => {
    const a = fixed("active", at(9), at(10));
    const cancelled = fixed("cancelled", at(9), at(10), { cancelled: true });
    const excluded = fixed("excluded", at(9), at(10), { excluded: true });
    const { segments, days } = mondaySegments([a, cancelled, excluded]);
    const groups = assignOverlapLanes(segments, days);
    expect(groups).toHaveLength(1);
    expect(groups[0].segmentIds).toHaveLength(1);
    expect(groups[0].maxConcurrency).toBe(1);
    const inactive = segments.filter(s => !s.conflictEligible);
    expect(inactive).toHaveLength(2);
    expect(inactive.every(s => s.overlapGroupId === null &&
      s.columnIndex === 0 && s.columnCount === 1)).toBe(true);
  });

  it("separates overlaps on different days", () => {
    const monday = fixed("monday", at(9), at(10));
    const tuesday = fixed("tuesday", "2026-11-03T09:00:00+02:00", "2026-11-03T10:00:00+02:00");
    const { segments, days } = mondaySegments([monday, tuesday]);
    const groups = assignOverlapLanes(segments, days);
    expect(groups.map(g => g.dayIndex)).toEqual([0, 1]);
    expect(groups.map(g => g.maxConcurrency)).toEqual([1, 1]);
  });

  it("does not mutate source entries", () => {
    const entry = fixed("A", at(9), at(10));
    const snapshot = structuredClone(entry);
    const { segments, days } = mondaySegments([entry]);
    assignOverlapLanes(segments, days);
    expect(entry).toEqual(snapshot);
  });
});
