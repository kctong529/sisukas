import { createHash } from "node:crypto";

/** Storage limits in UTF-8 bytes, matching database CHECK constraints. */
export const CALENDAR_GROUP_ID_MAX_BYTES = 1024;
export const CALENDAR_OCCURRENCE_KEY_MAX_BYTES = 65536;
export const CALENDAR_OFFERING_ID_MAX_CHARACTERS = 100;

export interface OccurrenceKeyScope {
  courseOfferingId: string;
  studyGroupId: string;
  occurrenceKeyVersion: number;
  occurrenceKey: string;
}

export class InvalidOccurrenceKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOccurrenceKeyError";
  }
}

function reject(message: string): never {
  throw new InvalidOccurrenceKeyError(message);
}

function validString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function validInstant(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Validates the current frontend serialization without normalizing it.
 * Ambiguity detection remains the responsibility of the frontend projector.
 */
export function validateOccurrenceKey(scope: OccurrenceKeyScope): void {
  const { courseOfferingId, studyGroupId, occurrenceKeyVersion, occurrenceKey } = scope;
  if (!validString(courseOfferingId) || courseOfferingId.length > CALENDAR_OFFERING_ID_MAX_CHARACTERS) {
    reject("Invalid course offering ID");
  }
  if (!validString(studyGroupId) || Buffer.byteLength(studyGroupId, "utf8") > CALENDAR_GROUP_ID_MAX_BYTES) {
    reject("Invalid study group ID");
  }
  if (occurrenceKeyVersion !== 1) reject("Unsupported occurrence key version");
  if (!validString(occurrenceKey) || Buffer.byteLength(occurrenceKey, "utf8") > CALENDAR_OCCURRENCE_KEY_MAX_BYTES) {
    reject("Invalid occurrence key length");
  }

  let values: unknown;
  try {
    values = JSON.parse(occurrenceKey);
  } catch {
    reject("Occurrence key is not valid JSON");
  }
  if (!Array.isArray(values) || JSON.stringify(values) !== occurrenceKey) {
    reject("Occurrence key must be a canonical JSON array");
  }
  if (values[1] !== courseOfferingId || values[2] !== studyGroupId) {
    reject("Occurrence key does not match offering and group scope");
  }

  if (values[0] === "series") {
    if (values.length !== 5 || !validString(values[3]) || !validInstant(values[4])) {
      reject("Invalid series occurrence key");
    }
    return;
  }
  if (values[0] === "fallback") {
    if (
      values.length !== 9 || !validInstant(values[3]) || !validInstant(values[4]) ||
      values[4] <= values[3] ||
      !Array.isArray(values[5]) || !values[5].every(validString) ||
      !values[5].every((v: string, i: number, a: string[]) => i === 0 || a[i - 1] <= v) ||
      typeof values[6] !== "boolean" || typeof values[7] !== "boolean" ||
      !(values[8] === null || typeof values[8] === "string")
    ) reject("Invalid fallback occurrence key");
    return;
  }
  reject("Unknown occurrence key kind");
}

/** Digest of the exact UTF-8 bytes, never of a parsed/re-serialized key. */
export function hashOccurrenceKey(scope: OccurrenceKeyScope): string {
  validateOccurrenceKey(scope);
  return createHash("sha256").update(scope.occurrenceKey, "utf8").digest("hex");
}
