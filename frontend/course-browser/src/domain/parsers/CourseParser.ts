// src/domain/parsers/CourseParser.ts
import { Course } from '../models/Course';
import type { DateRange } from '../valueObjects/DateRange';
import type { NumericRange } from '../valueObjects/NumericRange';
import { Prerequisites } from '../valueObjects/Prerequisites';
import type { LocalizedString } from '../valueObjects/LocalizedString';
import type {
  StudyLevel,
  Language,
  RawCourseFormat,
} from '../valueObjects/CourseTypes';

/**
 * Normalized sisukas course catalog record.
 *
 * This describes courses.json and historical.json, not the raw
 * Aalto API response.
 */
export interface RawCourse {
  id: string;
  courseUnitId: string;
  code: string;
  name: LocalizedString;

  startDate: string;
  endDate: string;
  enrolmentStartDate: string | null;
  enrolmentEndDate: string | null;

  credits: NumericRange;
  summary: {
    level: LocalizedString;
    prerequisites?: string | LocalizedString;
  };

  organizationName: LocalizedString;
  teachers: string[];
  languageOfInstructionCodes: string[];
  type: RawCourseFormat;

  tags?: string[];
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SUPPORTED_LANGUAGES = new Set<string>(['en', 'fi', 'sv']);

function parseCourseDate(
  value: string,
  field: string,
  courseId: string,
): Date {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Invalid ${field} found for course ID ${courseId}`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid ${field} found for course ID ${courseId}`);
  }

  return parsed;
}

/**
 * Transform a normalized catalog record into a Course domain model.
 *
 * Missing enrolment boundaries fall back to the corresponding
 * course boundaries for compatibility with the current DateRange
 * model. These fallback values are not actual registration dates.
 */
export function parseRawCourse(raw: RawCourse): Course {
  const startDate = parseCourseDate(raw.startDate, 'primary date', raw.id);
  const endDate = parseCourseDate(raw.endDate, 'primary date', raw.id);

  if (startDate > endDate) {
    throw new Error(`Invalid primary date range for course ID ${raw.id}`);
  }

  const enrolmentStartDate =
    raw.enrolmentStartDate == null
      ? startDate
      : parseCourseDate(raw.enrolmentStartDate, 'enrolment date', raw.id);

  const enrolmentEndDate =
    raw.enrolmentEndDate == null
      ? endDate
      : parseCourseDate(raw.enrolmentEndDate, 'enrolment date', raw.id);

  if (enrolmentStartDate > enrolmentEndDate) {
    throw new Error(`Invalid enrolment date range for course ID ${raw.id}`);
  }

  const courseDate: DateRange = {
    start: startDate,
    end: endDate,
  };

  const enrollmentDate: DateRange = {
    start: enrolmentStartDate,
    end: enrolmentEndDate,
  };

  const prerequisites = raw.summary.prerequisites
    ? raw.summary.prerequisites instanceof Prerequisites
      ? raw.summary.prerequisites
      : new Prerequisites(
          typeof raw.summary.prerequisites === 'string'
            ? { en: raw.summary.prerequisites }
            : raw.summary.prerequisites,
        )
    : undefined;

  const languages: Language[] = raw.languageOfInstructionCodes.filter(
    (code): code is Language => SUPPORTED_LANGUAGES.has(code),
  );

  return new Course({
    id: raw.id,
    unitId: raw.courseUnitId,
    code: raw.code,
    name: raw.name,
    courseDate,
    enrollmentDate,
    credits: raw.credits,
    level: raw.summary.level.en as StudyLevel,
    organization: raw.organizationName.en,
    teachers: raw.teachers,
    languages,
    format: raw.type,
    tags: raw.tags,
    prerequisites,
  });
}
