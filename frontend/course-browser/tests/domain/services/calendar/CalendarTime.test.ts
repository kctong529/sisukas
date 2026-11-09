import { describe, expect, it } from "vitest";

import {
  formatHelsinkiLocal, intervalsOverlap, parseOffsetInstant, resolveCalendarTime,
} from "@domain/services/calendar/CalendarTime";

const valid = {
  startIso: "2026-11-02T10:15:00+02:00",
  endIso: "2026-11-02T12:00:00+02:00",
  start: "2026-11-02T10:15:00",
  end: "2026-11-02T12:00:00",
};

describe("parseOffsetInstant", () => {
  it.each([
    ["2026-11-02T10:15:00+02:00", "2026-11-02T08:15:00.000Z"],
    ["2026-07-01T10:15:00+03:00", "2026-07-01T07:15:00.000Z"],
    ["2026-11-02T08:15:00Z", "2026-11-02T08:15:00.000Z"],
    ["2028-02-29T10:15:00+02:00", "2028-02-29T08:15:00.000Z"],
    ["2026-11-02T10:15:00.125+02:00", "2026-11-02T08:15:00.125Z"],
  ])("parses %s", (value, expected) => {
    expect(new Date(parseOffsetInstant(value)!).toISOString()).toBe(expected);
  });

  it.each([
    "2026-11-02T10:15:00", "2026-11-02", "", "2026-02-29T10:15:00+02:00",
    "2026-13-02T10:15:00+02:00", "2026-11-31T10:15:00+02:00",
    "2026-11-02T24:00:00+02:00", "2026-11-02T10:60:00+02:00",
    "2026-11-02T10:15:60+02:00", "2026-11-02T10:15:00+15:00",
    "2026-11-02T10:15:00+14:30", "2026-11-02T10:15:00+02:99",
    "2026-11-02T10:15:00.1234+02:00", "2026-11-02 10:15:00+02:00",
  ])("rejects invalid or offset-free timestamp %s", value => {
    expect(parseOffsetInstant(value)).toBeNull();
  });
});

describe("resolveCalendarTime", () => {
  it("returns epoch milliseconds without diagnostics for matching Helsinki times", () => {
    const result = resolveCalendarTime(valid);
    expect(result).toEqual({
      interval: {
        startMs: Date.parse("2026-11-02T08:15:00Z"),
        endMs: Date.parse("2026-11-02T10:00:00Z"),
      },
      diagnostics: [],
    });
  });

  it.each(["startIso", "endIso"] as const)("excludes an occurrence missing %s", field => {
    const result = resolveCalendarTime({ ...valid, [field]: undefined });
    expect(result.interval).toBeNull();
    expect(result.diagnostics).toEqual([expect.objectContaining({
      code: "missing_offset_timestamp", severity: "error",
    })]);
  });

  it("does not fall back to offset-free source values", () => {
    const result = resolveCalendarTime({ ...valid, startIso: "2026-11-02T10:15:00" });
    expect(result.interval).toBeNull();
    expect(result.diagnostics[0].code).toBe("invalid_offset_timestamp");
  });

  it.each([
    ["zero duration", "2026-11-02T10:15:00+02:00"],
    ["reversed duration", "2026-11-02T09:15:00+02:00"],
  ])("rejects %s", (_label, endIso) => {
    const result = resolveCalendarTime({ ...valid, endIso });
    expect(result.interval).toBeNull();
    expect(result.diagnostics.map(d => d.code)).toContain("invalid_interval");
  });

  it("keeps authoritative instants when local source time disagrees", () => {
    const source = { courseOfferingId: "offering", studyGroupId: "L01" };
    const result = resolveCalendarTime({ ...valid, start: "2026-11-02T11:15:00" }, source);
    expect(result.interval).not.toBeNull();
    expect(result.diagnostics).toEqual([expect.objectContaining({
      severity: "warning", code: "local_timestamp_mismatch", field: "start", source,
    })]);
  });

  it("warns on malformed local data without excluding authoritative instants", () => {
    const result = resolveCalendarTime({ ...valid, end: "2026-11-31T12:00:00" });
    expect(result.interval).not.toBeNull();
    expect(result.diagnostics[0].code).toBe("invalid_local_timestamp");
  });

  it("supports cross-midnight intervals", () => {
    const result = resolveCalendarTime({
      startIso: "2026-11-02T23:30:00+02:00", endIso: "2026-11-03T00:30:00+02:00",
    });
    expect(result.interval!.endMs - result.interval!.startMs).toBe(60 * 60_000);
  });

  it("distinguishes the two Helsinki fall-back 03:30 occurrences", () => {
    const summer = parseOffsetInstant("2026-10-25T03:30:00+03:00")!;
    const winter = parseOffsetInstant("2026-10-25T03:30:00+02:00")!;
    expect(winter - summer).toBe(60 * 60_000);
    expect(formatHelsinkiLocal(summer)).toBe("2026-10-25T03:30:00");
    expect(formatHelsinkiLocal(winter)).toBe("2026-10-25T03:30:00");
  });

  it("warns when an offset is valid but inconsistent with Helsinki summer time", () => {
    const result = resolveCalendarTime({
      startIso: "2026-07-01T10:00:00+02:00", endIso: "2026-07-01T11:00:00+02:00",
      start: "2026-07-01T10:00:00", end: "2026-07-01T11:00:00",
    });
    expect(result.interval).not.toBeNull();
    expect(result.diagnostics.map(d => d.code)).toEqual([
      "local_timestamp_mismatch", "local_timestamp_mismatch",
    ]);
    expect(formatHelsinkiLocal(result.interval!.startMs)).toBe("2026-07-01T11:00:00");
  });

  it("does not silently interpret a nonexistent Helsinki spring-forward time", () => {
    const result = resolveCalendarTime({
      startIso: "2026-03-29T03:30:00+02:00", endIso: "2026-03-29T04:30:00+03:00",
      start: "2026-03-29T03:30:00", end: "2026-03-29T04:30:00",
    });
    expect(result.interval).toBeNull(); // Both offsets refer to the same instant.
    expect(result.diagnostics.map(d => d.code)).toContain("invalid_interval");
  });
});

describe("intervalsOverlap", () => {
  it.each([
    [{ startMs: 0, endMs: 10 }, { startMs: 10, endMs: 20 }, false],
    [{ startMs: 0, endMs: 10 }, { startMs: 9, endMs: 20 }, true],
    [{ startMs: 0, endMs: 10 }, { startMs: 0, endMs: 10 }, true],
    [{ startMs: 0, endMs: 10 }, { startMs: 11, endMs: 20 }, false],
  ])("evaluates half-open interval boundaries", (a, b, expected) => {
    expect(intervalsOverlap(a, b)).toBe(expected);
    expect(intervalsOverlap(b, a)).toBe(expected);
  });
});
