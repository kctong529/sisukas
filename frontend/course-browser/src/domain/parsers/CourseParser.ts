// src/domain/parsers/CourseParser.ts
import { Course } from '../models/Course';
import type { DateRange } from '../value-objects/DateRange';
import type { NumericRange } from '../value-objects/NumericRange';
import { Prerequisites } from '../value-objects/Prerequisites';
import type {
  LocalizedString
} from '../value-objects/LocalizedString';
import type {
  CourseCode,
  StudyLevel,
  Language,
  RawCourseFormat
} from '../value-objects/CourseTypes';

// --- Raw Data Shape (What courses.json looks like) ---
export interface RawCourse {
  id: string;
  code: CourseCode;
  name: LocalizedString;
  description?: LocalizedString;
  startDate: string;
  endDate: string;
  enrolmentStartDate: string;
  enrolmentEndDate: string;
  credits: NumericRange;
  level: StudyLevel;
  prerequisites?: string | LocalizedString;
  organization: string;
  teachers: string[];
  languages: Language[];
  type: RawCourseFormat;
  tags?: string[];
  lastUpdated: string;
}

/**
 * Transforms a raw JSON object into a Course domain model instance.
 * Handles date parsing, range validation, and value object instantiation.
 * * @param raw The raw object received from the Infrastructure layer.
 * @returns A fully constructed Course model.
 * @throws {Error} if critical data (like dates) is invalid.
 */
export function parseRawCourse(raw: RawCourse): Course {
  const startDate = new Date(raw.startDate);
  const endDate = new Date(raw.endDate);
  const enrolmentStartDate = new Date(raw.enrolmentStartDate);
  const enrolmentEndDate = new Date(raw.enrolmentEndDate);
  const lastUpdated = new Date(raw.lastUpdated);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error(`Invalid primary date found for course ID ${raw.id}`);
  }

  if (isNaN(enrolmentStartDate.getTime()) || isNaN(enrolmentEndDate.getTime())) {
    throw new Error(`Invalid enrolment date found for course ID ${raw.id}`);
  }

  const courseDate: DateRange = {
    start: new Date(raw.startDate),
    end: new Date(raw.endDate),
  }

  const enrollmentDate: DateRange = {
    start: new Date(raw.enrolmentStartDate),
    end: new Date(raw.enrolmentEndDate),
  };

  const prerequisites = raw.prerequisites
    ? (raw.prerequisites instanceof Prerequisites
      ? raw.prerequisites
      : new Prerequisites(typeof raw.prerequisites === 'string'
        ? { en: raw.prerequisites }
        : raw.prerequisites
      )
    )
    : undefined;

  return new Course({
    id: raw.id,
    code: raw.code,
    name: raw.name,
    description: raw.description,
    courseDate,
    enrollmentDate: enrollmentDate,
    credits: raw.credits,
    level: raw.level,
    organization: raw.organization,
    teachers: raw.teachers,
    languages: raw.languages,
    format: raw.type,
    tags: raw.tags,
    lastUpdated,
    prerequisites,
  });
}