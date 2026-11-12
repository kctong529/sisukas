import { describe, expect, it } from "vitest";
import {
  hashOccurrenceKey,
  InvalidOccurrenceKeyError,
  validateOccurrenceKey,
} from "../../../src/domain/calendar/occurrenceKey";

const base = {
  courseOfferingId: "otm-offering",
  studyGroupId: "group-1",
  occurrenceKeyVersion: 1,
};
const series = JSON.stringify(["series", base.courseOfferingId, base.studyGroupId, "series-1", 1790000000000]);
const fallback = (notice: string | null) => JSON.stringify([
  "fallback", base.courseOfferingId, base.studyGroupId,
  1790000000000, 1790003600000, ["room-1", "room-2"], false, false, notice,
]);

const check = (occurrenceKey: string, overrides = {}) =>
  validateOccurrenceKey({ ...base, occurrenceKey, ...overrides });

describe("calendar occurrence key validation", () => {
  it("accepts the current series and fallback formats", () => {
    expect(() => check(series)).not.toThrow();
    expect(() => check(fallback(null))).not.toThrow();
    expect(() => check(fallback("Changed room"))).not.toThrow();
  });
  it("accepts a long, non-ASCII fallback notice without truncation", () => {
    const key = fallback("Siirretty: " + "äö漢字".repeat(1500));
    expect(Buffer.byteLength(key, "utf8")).toBeGreaterThan(3500);
    expect(() => check(key)).not.toThrow();
    expect(hashOccurrenceKey({ ...base, occurrenceKey: key })).toMatch(/^[0-9a-f]{64}$/);
  });
  it("hashes the exact bytes deterministically", () => {
    const scope = { ...base, occurrenceKey: series };
    expect(hashOccurrenceKey(scope)).toBe(hashOccurrenceKey(scope));
    expect(hashOccurrenceKey(scope)).not.toBe(hashOccurrenceKey({ ...base, occurrenceKey: fallback(null) }));
  });
  it("rejects wrong scope and unsupported versions", () => {
    expect(() => check(series, { studyGroupId: "other" })).toThrow(InvalidOccurrenceKeyError);
    expect(() => check(series, { occurrenceKeyVersion: 2 })).toThrow(InvalidOccurrenceKeyError);
  });
  it("rejects invalid structures and noncanonical JSON", () => {
    for (const key of ["not-json", "{}", ` ${series}`, '["series","otm-offering","group-1","s",1.0]',
      JSON.stringify(["series", base.courseOfferingId, base.studyGroupId, "", 42]),
      JSON.stringify(["fallback", base.courseOfferingId, base.studyGroupId, 2, 1, [], false, false, null]),
      JSON.stringify(["fallback", base.courseOfferingId, base.studyGroupId, 1, 2, ["z", "a"], false, false, null]),
    ]) expect(() => check(key)).toThrow(InvalidOccurrenceKeyError);
  });
  it("enforces the database byte bounds", () => {
    expect(() => check(series, { studyGroupId: "漢".repeat(342) })).toThrow();
    expect(() => check(fallback("x".repeat(65536)))).toThrow();
    expect(() => check(series, { courseOfferingId: "x".repeat(101) })).toThrow();
  });
});
