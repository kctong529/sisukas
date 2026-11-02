import { describe, expect, it } from "vitest";
import type { StudyEvent } from "../../../src/domain/models/StudyEvent";
import {
  deriveCalendarOccurrenceKey,
  identifyCalendarOccurrences,
  type CalendarOccurrenceCandidate,
} from "../../../src/domain/services/CalendarOccurrenceIdentity";

function event(overrides: Partial<StudyEvent> = {}): StudyEvent {
  return {
    id: "legacy:0", start: "2026-11-02T10:00:00", end: "2026-11-02T11:00:00",
    startIso: "2026-11-02T10:00:00+02:00", endIso: "2026-11-02T11:00:00+02:00",
    seriesId: "series-1", cancelled: false, excluded: false,
    notice: null, locationIds: ["room-1"], locations: [], ...overrides,
  };
}
function candidate(
  overrides: Partial<CalendarOccurrenceCandidate> = {},
): CalendarOccurrenceCandidate {
  return {
    courseInstanceId: "offering-1", studyGroupId: "group-1",
    event: event(), interval: { startMs: 1000, endMs: 2000 }, ...overrides,
  };
}

describe("deriveCalendarOccurrenceKey", () => {
  it("is deterministic for equivalent source values", () => {
    expect(deriveCalendarOccurrenceKey(candidate()))
      .toBe(deriveCalendarOccurrenceKey(candidate()));
  });
  it("uses source series and start instant, not frontend positional ID", () => {
    const a = candidate();
    const b = candidate({ event: event({ id: "legacy:999" }) });
    expect(deriveCalendarOccurrenceKey(a)).toBe(deriveCalendarOccurrenceKey(b));
  });
  it("distinguishes offerings, groups, series and occurrence starts", () => {
    const baseline = deriveCalendarOccurrenceKey(candidate());
    const variants = [
      candidate({ courseInstanceId: "offering-2" }),
      candidate({ studyGroupId: "group-2" }),
      candidate({ event: event({ seriesId: "series-2" }) }),
      candidate({ interval: { startMs: 1001, endMs: 2000 } }),
    ];
    for (const variant of variants) {
      expect(deriveCalendarOccurrenceKey(variant)).not.toBe(baseline);
    }
  });
  it("does not confuse ambiguous delimiter-containing identifiers", () => {
    const a = candidate({ courseInstanceId: "a:b", studyGroupId: "c" });
    const b = candidate({ courseInstanceId: "a", studyGroupId: "b:c" });
    expect(deriveCalendarOccurrenceKey(a)).not.toBe(deriveCalendarOccurrenceKey(b));
  });
  it("uses explicit fallback namespace for absent series IDs", () => {
    const fallback = deriveCalendarOccurrenceKey(candidate({event: event({seriesId: null})}));
    const primary = deriveCalendarOccurrenceKey(candidate({event: event({seriesId: ""})}));
    expect(fallback).toBe(primary);
    expect(JSON.parse(fallback)[0]).toBe("fallback");
  });
  it("distinguishes fallback by end instant and source attributes", () => {
    const base = candidate({ event: event({ seriesId: null }) });
    const baseline = deriveCalendarOccurrenceKey(base);
    const variants = [
      candidate({ event: event({ seriesId: null }), interval: { startMs: 1000, endMs: 2001 } }),
      candidate({ event: event({ seriesId: null, locationIds: ["room-2"] }) }),
      candidate({ event: event({ seriesId: null, cancelled: true }) }),
      candidate({ event: event({ seriesId: null, excluded: true }) }),
      candidate({ event: event({ seriesId: null, notice: "Moved" }) }),
    ];
    for (const variant of variants) {
      expect(deriveCalendarOccurrenceKey(variant)).not.toBe(baseline);
    }
  });
  it("ignores fallback room-ID ordering but does not mutate the input", () => {
    const rooms = ["room-2", "room-1"];
    const a = candidate({ event: event({ seriesId: null, locationIds: rooms }) });
    const b = candidate({ event: event({ seriesId: null, locationIds: ["room-1", "room-2"] }) });
    expect(deriveCalendarOccurrenceKey(a)).toBe(deriveCalendarOccurrenceKey(b));
    expect(rooms).toEqual(["room-2", "room-1"]);
  });
});

describe("identifyCalendarOccurrences", () => {
  it("handles zero and one candidate", () => {
    expect(identifyCalendarOccurrences([])).toEqual({ occurrences: [], diagnostics: [] });
    const one = identifyCalendarOccurrences([candidate()]);
    expect(one.occurrences).toHaveLength(1);
    expect(one.occurrences[0].occurrenceKey).not.toBeNull();
    expect(one.diagnostics).toEqual([]);
  });
  it("preserves all distinct source occurrences in their input order", () => {
    const items = [candidate(), candidate({event: event({seriesId: "series-2"})})];
    const result = identifyCalendarOccurrences(items);
    expect(result.occurrences.map(x => x.candidate)).toEqual(items);
    expect(result.occurrences.every(x => x.occurrenceKey !== null)).toBe(true);
  });
  it("reports missing source identity but retains a unique fallback key", () => {
    const result = identifyCalendarOccurrences([candidate({ event: event({seriesId: null}) })]);
    expect(result.occurrences[0].occurrenceKey).not.toBeNull();
    expect(result.diagnostics).toMatchObject([{
      code: "missing_series_identity", severity: "warning",
      source: {courseInstanceId: "offering-1", studyGroupId: "group-1", seriesId: null},
    }]);
  });
  it("reports colliding source series keys without merging or positional IDs", () => {
    const a = candidate({event: event({id: "legacy:0"})});
    const b = candidate({event: event({id: "legacy:1", locationIds: ["other"]})});
    const result = identifyCalendarOccurrences([a, b]);
    expect(result.occurrences).toHaveLength(2);
    expect(result.occurrences.map(x => x.occurrenceKey)).toEqual([null, null]);
    expect(result.diagnostics.map(x => x.code)).toEqual([
      "occurrence_key_collision", "occurrence_key_collision",
    ]);
  });
  it("reports indistinguishable fallback collisions and retains both records", () => {
    const a = candidate({event: event({seriesId: null, id: "legacy:0"})});
    const b = candidate({event: event({seriesId: null, id: "legacy:1"})});
    const result = identifyCalendarOccurrences([a, b]);
    expect(result.occurrences.map(x => x.occurrenceKey)).toEqual([null, null]);
    expect(result.diagnostics.filter(x => x.code === "missing_series_identity")).toHaveLength(2);
    expect(result.diagnostics.filter(x => x.code === "occurrence_key_collision")).toHaveLength(2);
  });
  it("does not invalidate noncolliding occurrences alongside collisions", () => {
    const a = candidate();
    const b = candidate();
    const c = candidate({event: event({seriesId: "series-3"})});
    const result = identifyCalendarOccurrences([a, b, c]);
    expect(result.occurrences.map(x => x.occurrenceKey === null)).toEqual([true, true, false]);
  });
  it("does not mutate nested input events", () => {
    const input = candidate({ event: event({ seriesId: null, locationIds: ["b", "a"] }) });
    const snapshot = JSON.stringify(input);
    identifyCalendarOccurrences([input]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
