import { describe, expect, it, expectTypeOf } from "vitest";
import type { StudyEvent } from "@modules/study-groups/models/StudyEvent";
import type { CalendarEntry } from "@domain/models/CalendarEntry";
import type { CalendarIdentifiedOccurrence } from "@domain/services/calendar/CalendarOccurrenceIdentity";
import {
  compareCalendarEntries,
  defineFixedCalendarOccurrence,
  defineFlexibleCalendarWindow,
} from "@domain/services/calendar/CalendarEntryContract";

function identified(
  key: string | null = "key-1",
  overrides: Partial<StudyEvent> = {},
): CalendarIdentifiedOccurrence {
  const event: StudyEvent = {
    id: "legacy:0",
    start: "2026-11-02T10:00:00",
    end: "2026-11-02T11:00:00",
    startIso: "2026-11-02T10:00:00+02:00",
    endIso: "2026-11-02T11:00:00+02:00",
    seriesId: "series-1",
    cancelled: false,
    excluded: false,
    notice: null,
    locationIds: ["room-1"],
    locations: [{ id: "room-1", name: "Test room" }],
    ...overrides,
  };
  return {
    occurrenceKey: key,
    candidate: {
      courseOfferingId: "offering-1",
      studyGroupId: "group-1",
      studyGroupName: "H02",
      studyGroupType: "Exercise",
      event,
      interval: { startMs: 1000, endMs: 2000 },
    },
  };
}

const evidence = {
  kind: "verified-source-classification" as const,
  sourceField: "examAvailabilityKind",
  sourceValue: "window",
};

describe("CalendarEntry contracts", () => {
  it("preserves interval, group, series, source metadata and status", () => {
    const input = identified("unique", { cancelled: true, excluded: true, notice: "Changed" });
    const result = defineFixedCalendarOccurrence(input);
    expect(result).toMatchObject({
      kind: "fixed", occurrenceKey: "unique", interval: { startMs: 1000, endMs: 2000 },
      source: { courseOfferingId: "offering-1", studyGroupId: "group-1", studyGroupName: "H02", studyGroupType: "Exercise", seriesId: "series-1",
        event: { cancelled: true, excluded: true, notice: "Changed", locationIds: ["room-1"] } },
    });
    expect(result.source.event).toBe(input.candidate.event);
  });

  it("preserves null identity after collision rather than inventing a key", () => {
    expect(defineFixedCalendarOccurrence(identified(null)).occurrenceKey).toBeNull();
    expect(defineFlexibleCalendarWindow(identified(null), evidence).occurrenceKey).toBeNull();
  });

  it("supports absent series identity without changing original event", () => {
    const result = defineFixedCalendarOccurrence(identified("fallback", { seriesId: null }));
    expect(result.source.seriesId).toBeNull();
    expect(result.occurrenceKey).toBe("fallback");
  });

  it("requires explicit classification evidence for flexible windows", () => {
    expect(defineFlexibleCalendarWindow(identified(), evidence)).toMatchObject({
      kind: "flexible-window", evidence,
    });
    expect(() => defineFlexibleCalendarWindow(identified(), { ...evidence, sourceField: " " }))
      .toThrow(/verified source evidence/);
    expect(() => defineFlexibleCalendarWindow(identified(), { ...evidence, sourceValue: "" }))
      .toThrow(/verified source evidence/);
  });

  it("does not infer flexible classification from Exam label or long duration", () => {
    const input = identified();
    input.candidate.interval = { startMs: 0, endMs: 604800000 };
    expect(defineFixedCalendarOccurrence(input).kind).toBe("fixed");
  });

  it("does not mutate input while building either entry type", () => {
    const input = identified();
    const before = JSON.stringify(input);
    const fixed = defineFixedCalendarOccurrence(input);
    const flexible = defineFlexibleCalendarWindow(input, evidence);
    fixed.interval.startMs = -1;
    flexible.evidence.sourceField = "edited";
    expect(JSON.stringify(input)).toBe(before);
    expect(evidence.sourceField).toBe("examAvailabilityKind");
  });

  it("uses discriminated union typing for safe classification", () => {
    const entry: CalendarEntry = defineFlexibleCalendarWindow(identified(), evidence);
    if (entry.kind === "flexible-window") {
      expectTypeOf(entry.evidence.sourceField).toEqualTypeOf<string>();
    }
  });

  it("orders by absolute start and then end instants", () => {
    const a = defineFixedCalendarOccurrence(identified("a"));
    const b = defineFixedCalendarOccurrence(identified("b"));
    b.interval = { startMs: 999, endMs: 5000 };
    const c = defineFixedCalendarOccurrence(identified("c"));
    c.interval = { startMs: 1000, endMs: 1500 };
    expect([a, b, c].sort(compareCalendarEntries)).toEqual([b, c, a]);
  });

  it("uses occurrence keys to make equal-interval sorting deterministic", () => {
    const a = defineFixedCalendarOccurrence(identified("a"));
    const b = defineFixedCalendarOccurrence(identified("b"));
    expect([b, a].sort(compareCalendarEntries)).toEqual([a, b]);
  });
});
