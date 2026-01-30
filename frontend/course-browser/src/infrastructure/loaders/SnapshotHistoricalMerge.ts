// src/infrastructure/loaders/SnapshotHistoricalMerge.ts
import type { Course } from "../../domain/models/Course";
import { parseRawCourse, type RawCourse } from "../../domain/parsers/CourseParser";
import type { LocalizedString } from "../../domain/valueObjects/LocalizedString";
import type { NumericRange } from "../../domain/valueObjects/NumericRange";
import type { Language, RawCourseFormat } from "../../domain/valueObjects/CourseTypes";

import { CourseSnapshotsService } from "../services/CourseSnapshotsService";
import { courseIndexStore } from "../../lib/stores/courseIndexStore";

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function pickString(x: unknown): string | null {
  return typeof x === "string" && x.trim().length > 0 ? x : null;
}

function pickStringArray(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

function pickLocalizedString(x: unknown): LocalizedString | null {
  if (!isRecord(x)) return null;
  const any = x as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(any)) {
    if (typeof v === "string") out[k] = v;
  }
  const hasAny = Object.keys(out).length > 0;
  if (!hasAny) return null;

  // Ensure "en" exists if possible (your parser uses summary.level.en etc.)
  if (!out.en) out.en = out.fi ?? out.sv ?? "";
  return out as unknown as LocalizedString;
}

function pickNumericRange(x: unknown): NumericRange | null {
  if (!isRecord(x)) return null;

  const minVal = x["min"];
  const maxVal = x["max"];

  const minNum =
    typeof minVal === "number"
      ? minVal
      : typeof minVal === "string"
        ? Number(minVal)
        : NaN;

  const maxNum =
    typeof maxVal === "number"
      ? maxVal
      : typeof maxVal === "string"
        ? Number(maxVal)
        : NaN;

  if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) return null;

  return { min: minNum, max: maxNum } as NumericRange;
}

function pickIsoDate(x: unknown): string | null {
  const s = pickString(x);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : s;
}

function pickLanguageCodes(x: unknown): Language[] {
  return Array.isArray(x) ? x.filter((v): v is Language => typeof v === "string") : [];
}

function pickRawFormat(x: unknown): RawCourseFormat | null {
  const s = pickString(x);
  return s ? (s as RawCourseFormat) : null;
}

/**
 * Convert snapshot "payload" into RawCourse (courses.json compatible).
 * Returns null if required fields are missing/unusable.
 */
function snapshotPayloadToRawCourse(payload: Record<string, unknown>): RawCourse | null {
  const id = pickString(payload.id);
  const courseUnitId = pickString(payload.courseUnitId);
  const code = pickString(payload.code);
  const name = pickLocalizedString(payload.name);

  const startDate = pickIsoDate(payload.startDate);
  const endDate = pickIsoDate(payload.endDate);

  const enrolmentStartDate = pickIsoDate(payload.enrolmentStartDate) ?? startDate;
  const enrolmentEndDate = pickIsoDate(payload.enrolmentEndDate) ?? endDate;

  const credits = pickNumericRange(payload.credits);

  const organizationName = pickLocalizedString(payload.organizationName);

  const teachers = pickStringArray(payload.teachers);

  const languageOfInstructionCodes = pickLanguageCodes(payload.languageOfInstructionCodes);

  const type = pickRawFormat(payload.type);

  const summaryObj = isRecord(payload.summary) ? payload.summary : null;
  const level = summaryObj ? pickLocalizedString(summaryObj.level) : null;

  // prerequisites can be string OR LocalizedString in RawCourse
  let prerequisites: string | LocalizedString | undefined = undefined;
  if (summaryObj && "prerequisites" in summaryObj) {
    const p = summaryObj.prerequisites;
    prerequisites = typeof p === "string" ? p : (pickLocalizedString(p) ?? undefined);
  }

  // Required fields (per RawCourse interface + parseRawCourse expectations)
  if (!id || !courseUnitId || !code || !name) return null;
  if (!startDate || !endDate || !enrolmentStartDate || !enrolmentEndDate) return null;
  if (!credits || !organizationName || !type || !level) return null;

  const raw: RawCourse = {
    id,
    courseUnitId,
    code,
    name,
    startDate,
    endDate,
    enrolmentStartDate,
    enrolmentEndDate,
    credits,
    summary: {
      level,
      ...(prerequisites ? { prerequisites } : {}),
    },
    organizationName,
    teachers,
    languageOfInstructionCodes,
    type,
    // optional
    tags: undefined,
    // required by RawCourse
    lastUpdated: new Date().toISOString(),
  };

  return raw;
}

export class SnapshotHistoricalMerge {
  /**
   * Fetch all live snapshots from backend and append into historical index.
   * Assumes course datasets are already loaded into courseIndexStore.
   */
  static async mergeAllLiveSnapshots(): Promise<{ fetched: number; merged: number; skipped: number }> {
    const snaps = await CourseSnapshotsService.listAll({ liveOnly: true });

    const parsed: Course[] = [];
    for (const s of snaps) {
      const payload = s.payload as Record<string, unknown>;
      const raw = snapshotPayloadToRawCourse(payload);
      if (!raw) continue;

      try {
        parsed.push(parseRawCourse(raw));
      } catch {
        // Skip invalid snapshot payloads (bad dates, etc.)
      }
    }

    const { merged, skipped } = courseIndexStore.appendHistoricalCourses(parsed);
    return { fetched: snaps.length, merged, skipped };
  }
}
