import { describe, expect, it } from "vitest";
import {
  dateFromUtcMs,
  helsinkiMidnight,
  helsinkiOffsetMinutes,
  localMinute,
  resolveHelsinkiWeek,
  splitAtOffsetTransitions,
  utcDateMs,
} from "@domain/services/calendar/layout/WeeklyCalendarTime";
import { instant } from "./fixtures";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("WeeklyCalendarTime — ISO date validation", () => {
  it.each(["2024-02-29", "2026-01-01", "2026-12-31", "9998-12-31"])(
    "round-trips a supported date: %s",
    date => expect(dateFromUtcMs(utcDateMs(date))).toBe(date),
  );

  it.each([
    "2026-2-02", "2026-02-2", "2026/02/02", " 2026-02-02",
    "2026-02-02 ", "2026-02-02T00:00:00Z", "",
    "2026-02-29", "2024-02-30", "2026-04-31", "2026-00-01",
    "2026-13-01", "2026-01-00", "0000-01-01", "0099-01-01", "9999-01-01",
  ])("rejects malformed, impossible, or unsupported date %s", date => {
    expect(() => utcDateMs(date)).toThrow(RangeError);
  });
});

describe("WeeklyCalendarTime — week boundaries", () => {
  it("returns exactly seven ordered dates and eight boundaries", () => {
    const { days, boundaries } = resolveHelsinkiWeek("2026-11-02");
    expect(days).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05",
      "2026-11-06", "2026-11-07", "2026-11-08",
    ]);
    expect(boundaries).toHaveLength(8);
    expect(boundaries.every((value, i) => i === 0 || value > boundaries[i - 1])).toBe(true);
    expect(boundaries.slice(1).map((value, i) => value - boundaries[i])).toEqual(Array(7).fill(DAY));
  });

  it("crosses December/January and the year boundary", () => {
    const { days } = resolveHelsinkiWeek("2026-12-28");
    expect(days).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31",
      "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
  });

  it.each(["2026-11-01", "2026-11-03", "2026-11-08"])(
    "rejects a non-Monday date %s",
    date => expect(() => resolveHelsinkiWeek(date)).toThrow(/Monday/),
  );

  it("uses 23 hours for Helsinki spring-forward Sunday", () => {
    const { boundaries } = resolveHelsinkiWeek("2027-03-22");
    expect(boundaries[7] - boundaries[6]).toBe(23 * HOUR);
  });

  it("uses 25 hours for Helsinki fall-back Sunday", () => {
    const { boundaries } = resolveHelsinkiWeek("2026-10-19");
    expect(boundaries[7] - boundaries[6]).toBe(25 * HOUR);
  });

  it("resolves midnight to its authoritative absolute instant", () => {
    expect(helsinkiMidnight("2026-01-01")).toBe(instant("2026-01-01T00:00:00+02:00"));
    expect(helsinkiMidnight("2026-07-01")).toBe(instant("2026-07-01T00:00:00+03:00"));
  });
});

describe("WeeklyCalendarTime — offsets and wall-clock minutes", () => {
  it.each([
    ["2026-01-01T12:00:00+02:00", 120],
    ["2026-07-01T12:00:00+03:00", 180],
    ["2027-03-28T02:59:59+02:00", 120],
    ["2027-03-28T04:00:00+03:00", 180],
    ["2026-10-25T03:59:59+03:00", 180],
    ["2026-10-25T03:00:00+02:00", 120],
  ] as const)("resolves offset at %s", (iso, offset) => {
    expect(helsinkiOffsetMinutes(instant(iso))).toBe(offset);
  });

  it("preserves seconds and milliseconds in the local minute", () => {
    expect(localMinute(instant("2026-11-02T10:15:30.500+02:00")))
      .toBeCloseTo(10 * 60 + 15 + 30.5 / 60, 8);
  });

  it("maps the two autumn 03:30 instants to the same wall minute", () => {
    const first = instant("2026-10-25T03:30:00+03:00");
    const second = instant("2026-10-25T03:30:00+02:00");
    expect(second - first).toBe(HOUR);
    expect(localMinute(first)).toBe(210);
    expect(localMinute(second)).toBe(210);
    expect(helsinkiOffsetMinutes(first)).not.toBe(helsinkiOffsetMinutes(second));
  });
});

describe("WeeklyCalendarTime — transition splitting", () => {
  it("returns a single half-open interval without a transition", () => {
    const start = instant("2026-11-02T10:00:00+02:00");
    const end = start + HOUR;
    expect(splitAtOffsetTransitions(start, end)).toEqual([{ startMs: start, endMs: end }]);
  });

  it.each([
    ["2027-03-28T04:00:00+03:00", "2027-03-28T02:59:59+02:00"],
    ["2026-10-25T03:00:00+02:00", "2026-10-25T03:59:59+03:00"],
  ] as const)("finds the exact transition cut at %s", (transition, beforeTransition) => {
    const cut = instant(transition);
    expect(instant(beforeTransition)).toBe(cut - 1000);
    const pieces = splitAtOffsetTransitions(cut - HOUR, cut + HOUR);
    expect(pieces).toEqual([
      { startMs: cut - HOUR, endMs: cut },
      { startMs: cut, endMs: cut + HOUR },
    ]);
    expect(pieces.reduce((sum, p) => sum + p.endMs - p.startMs, 0)).toBe(2 * HOUR);
  });

  it("does not create an empty piece when the interval starts at the transition", () => {
    const cut = instant("2027-03-28T04:00:00+03:00");
    expect(splitAtOffsetTransitions(cut, cut + HOUR)).toEqual([
      { startMs: cut, endMs: cut + HOUR },
    ]);
  });

  it("does not create an empty piece when the interval ends at the transition", () => {
    const cut = instant("2027-03-28T04:00:00+03:00");
    expect(splitAtOffsetTransitions(cut - HOUR, cut)).toEqual([
      { startMs: cut - HOUR, endMs: cut },
    ]);
  });

  it("preserves the original interval with no gaps or overlaps across a cut", () => {
    const start = instant("2027-03-28T02:30:00+02:00");
    const end = instant("2027-03-28T04:30:00+03:00");
    const pieces = splitAtOffsetTransitions(start, end);
    expect(pieces[0].startMs).toBe(start);
    expect(pieces.at(-1)?.endMs).toBe(end);
    for (let i = 1; i < pieces.length; i++) {
      expect(pieces[i].startMs).toBe(pieces[i - 1].endMs);
    }
  });
});
