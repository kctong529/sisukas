import { describe, expect, it } from "vitest";
import type { CalendarEntry } from "@domain/models/CalendarEntry";
import { segmentWeek } from "@domain/services/calendar/layout/WeeklyCalendarSegmentation";
import { resolveHelsinkiWeek } from "@domain/services/calendar/layout/WeeklyCalendarTime";
import { at, fixed, instant, mondaySegments, NORMAL_WEEK } from "./fixtures";

const monday = () => resolveHelsinkiWeek(NORMAL_WEEK);

describe("WeeklyCalendarSegmentation — interval equivalence classes", () => {
  it("positions an ordinary fixed occurrence without changing its source", () => {
    const entry = fixed("ordinary", at(9), at(10));
    const original = structuredClone(entry);
    const { segments, diagnostics } = mondaySegments([entry]);
    expect(diagnostics).toEqual([]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      entry, dayIndex: 0, localDate: NORMAL_WEEK,
      startMinute: 540, endMinute: 600,
      continuesBefore: false, continuesAfter: false,
      conflictEligible: true, overlapGroupId: null, columnIndex: 0, columnCount: 1,
    });
    expect(segments[0].entry).toBe(entry);
    expect(entry).toEqual(original);
  });

  it.each([1, 1_000, 60_000])("retains a valid %i ms occurrence", duration => {
    const entry = fixed("short", at(10), at(11));
    entry.interval.endMs = entry.interval.startMs + duration;
    const { segments, diagnostics } = mondaySegments([entry]);
    expect(segments).toHaveLength(1);
    expect(segments[0].interval.endMs - segments[0].interval.startMs).toBe(duration);
    expect(diagnostics).toEqual([]);
  });

  it.each([
    ["zero length", (start: number) => start],
    ["negative length", (start: number) => start - 1],
    ["noninteger", (start: number) => start + 0.5],
    ["NaN", () => Number.NaN],
    ["infinity", () => Number.POSITIVE_INFINITY],
    ["unsafe integer", () => Number.MAX_SAFE_INTEGER + 1],
  ])("diagnoses %s without preventing valid entries", (_label, invalidEnd) => {
    const bad = fixed("bad", at(10), at(11));
    bad.interval.endMs = invalidEnd(bad.interval.startMs);
    const good = fixed("good", at(12), at(13));
    const { segments, diagnostics } = mondaySegments([bad, good]);
    expect(segments).toHaveLength(1);
    expect(segments[0].entry).toBe(good);
    expect(diagnostics).toMatchObject([{ code: "invalid_interval", entry: bad }]);
  });

  it("diagnoses an invalid start boundary", () => {
    const bad = fixed("bad", at(10), at(11));
    bad.interval.startMs = Number.NaN;
    expect(mondaySegments([bad]).diagnostics.map(d => d.code)).toEqual(["invalid_interval"]);
  });

  it("ignores flexible windows without reporting errors", () => {
    const base = fixed("window", at(10), at(11));
    const flexible: CalendarEntry = {
      ...base,
      kind: "flexible-window",
      evidence: { kind: "verified-source-classification", sourceField: "type", sourceValue: "window" },
    };
    const { segments, diagnostics } = segmentWeek([flexible], monday().days, monday().boundaries);
    expect(segments).toEqual([]);
    expect(diagnostics).toEqual([]);
  });
});

describe("WeeklyCalendarSegmentation — half-open day and week boundaries", () => {
  it("excludes an event ending exactly at the week start", () => {
    const before = fixed("before", "2026-11-01T23:00:00+02:00", "2026-11-02T00:00:00+02:00");
    expect(mondaySegments([before]).segments).toEqual([]);
  });

  it("excludes an event beginning exactly at the following week", () => {
    const after = fixed("after", "2026-11-09T00:00:00+02:00", "2026-11-09T01:00:00+02:00");
    expect(mondaySegments([after]).segments).toEqual([]);
  });

  it("includes an event starting exactly at Monday midnight", () => {
    const entry = fixed("first", "2026-11-02T00:00:00+02:00", "2026-11-02T01:00:00+02:00");
    const { segments } = mondaySegments([entry]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ dayIndex: 0, startMinute: 0, endMinute: 60 });
  });

  it("clips an event ending just after Monday midnight", () => {
    const entry = fixed("left", "2026-11-01T23:00:00+02:00", "2026-11-02T01:00:00+02:00");
    const { segments } = mondaySegments([entry]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ dayIndex: 0, startMinute: 0, endMinute: 60,
      continuesBefore: true, continuesAfter: false });
  });

  it("clips an event ending just after the end of Sunday", () => {
    const entry = fixed("right", "2026-11-08T23:00:00+02:00", "2026-11-09T01:00:00+02:00");
    const { segments } = mondaySegments([entry]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ dayIndex: 6, startMinute: 1380, endMinute: 1440,
      continuesBefore: false, continuesAfter: true });
  });

  it("splits at exact midnight without producing a zero-length segment", () => {
    const entry = fixed("midnight", "2026-11-02T23:00:00+02:00", "2026-11-03T00:00:00+02:00");
    const { segments } = mondaySegments([entry]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ dayIndex: 0, startMinute: 1380, endMinute: 1440 });
  });

  it("splits a two-day event while retaining its association and duration", () => {
    const entry = fixed("overnight", "2026-11-02T23:30:00+02:00", "2026-11-03T01:00:00+02:00");
    const { segments } = mondaySegments([entry]);
    expect(segments.map(s => [s.dayIndex, s.startMinute, s.endMinute]))
      .toEqual([[0, 1410, 1440], [1, 0, 60]]);
    expect(segments.map(s => [s.continuesBefore, s.continuesAfter]))
      .toEqual([[false, true], [true, false]]);
    expect(segments.every(s => s.entry === entry)).toBe(true);
    expect(segments.reduce((sum, s) => sum + s.interval.endMs - s.interval.startMs, 0))
      .toBe(entry.interval.endMs - entry.interval.startMs);
  });
});

describe("WeeklyCalendarSegmentation — association identity and status", () => {
  it("preserves two distinct associations with the same occurrence key", () => {
    const a = fixed("shared", at(9), at(10), { group: "A" });
    const b = fixed("shared", at(9), at(10), { group: "B" });
    const { segments } = mondaySegments([b, a]);
    expect(segments).toHaveLength(2);
    expect(new Set(segments.map(s => s.id)).size).toBe(2);
    expect(segments.map(s => s.entry)).toContain(a);
    expect(segments.map(s => s.entry)).toContain(b);
  });

  it("gives distinct snapshot identifiers to identical cloned associations", () => {
    const a = fixed(null, at(9), at(10));
    const b = structuredClone(a);
    const { segments } = mondaySegments([a, b]);
    expect(new Set(segments.map(s => s.id)).size).toBe(2);
    expect(segments.every(s => s.entry === a || s.entry === b)).toBe(true);
  });

  it("has stable IDs when the order of distinguishable entries changes", () => {
    const a = fixed(null, at(9), at(10), { group: "A" });
    const b = fixed(null, at(9), at(10), { group: "B" });
    const ids = (items: typeof a[]) => mondaySegments(items).segments.map(s => s.id).sort();
    expect(ids([a, b])).toEqual(ids([b, a]));
  });

  it.each([
    ["cancelled", { cancelled: true }],
    ["excluded", { excluded: true }],
  ] as const)("retains a %s occurrence as non-conflict-eligible", (_name, options) => {
    const entry = fixed("status", at(9), at(10), options);
    const { segments } = mondaySegments([entry]);
    expect(segments).toHaveLength(1);
    expect(segments[0].conflictEligible).toBe(false);
  });
});

describe("WeeklyCalendarSegmentation — DST boundaries", () => {
  it("splits spring-forward without inventing the missing hour", () => {
    const entry = fixed("spring", "2027-03-28T02:30:00+02:00", "2027-03-28T04:30:00+03:00");
    const { segments } = mondaySegments([entry], "2027-03-22");
    expect(segments.map(s => [s.startMinute, s.endMinute])).toEqual([[150, 180], [240, 270]]);
    expect(segments.map(s => s.startUtcOffsetMinutes)).toEqual([120, 180]);
    expect(segments.reduce((sum, s) => sum + s.interval.endMs - s.interval.startMs, 0)).toBe(3_600_000);
  });

  it("preserves repeated fall-back wall times as separate absolute segments", () => {
    const entry = fixed("fall", "2026-10-25T03:30:00+03:00", "2026-10-25T03:30:00+02:00");
    const { segments } = mondaySegments([entry], "2026-10-19");
    expect(segments.map(s => [s.startMinute, s.endMinute])).toEqual([[210, 240], [180, 210]]);
    expect(segments.map(s => s.startUtcOffsetMinutes)).toEqual([180, 120]);
    expect(segments.reduce((sum, s) => sum + s.interval.endMs - s.interval.startMs, 0)).toBe(3_600_000);
  });

  it("keeps 1 ms immediately on either side of a DST transition", () => {
    const cut = instant("2027-03-28T04:00:00+03:00");
    const entry = fixed("edge", "2027-03-28T02:00:00+02:00", "2027-03-28T04:30:00+03:00");
    entry.interval.startMs = cut - 1;
    entry.interval.endMs = cut + 1;
    const { segments } = mondaySegments([entry], "2027-03-22");
    expect(segments.map(s => s.interval)).toEqual([
      { startMs: cut - 1, endMs: cut },
      { startMs: cut, endMs: cut + 1 },
    ]);
    expect(segments.every(s => s.interval.endMs > s.interval.startMs)).toBe(true);
  });
});
