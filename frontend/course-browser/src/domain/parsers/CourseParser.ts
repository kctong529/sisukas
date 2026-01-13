// src/domain/parsers/CourseParser.ts
import { Course } from '../models/Course';
<<<<<<< HEAD
import type { DateRange } from '../valueObjects/DateRange';
import type { NumericRange } from '../valueObjects/NumericRange';
import { Prerequisites } from '../valueObjects/Prerequisites';
import type { LocalizedString } from '../valueObjects/LocalizedString';
import type { StudyLevel, Language, RawCourseFormat } from '../valueObjects/CourseTypes';
=======
import type { DateRange } from '../value-objects/DateRange';
import type { NumericRange } from '../value-objects/NumericRange';
import { Prerequisites } from '../value-objects/Prerequisites';
import type { LocalizedString } from '../value-objects/LocalizedString';
import type { StudyLevel, Language, RawCourseFormat } from '../value-objects/CourseTypes';
import type { CourseCode } from '../value-objects/CourseCode';
>>>>>>> main

// --- Raw Data Shape (What courses.json looks like) ---
export interface RawCourse {
  id: string;
<<<<<<< HEAD
  courseUnitId: string;
  code: string;
  name: LocalizedString;
=======
  code: string;
  name: LocalizedString;
  description?: LocalizedString;
>>>>>>> main
  startDate: string;
  endDate: string;
  enrolmentStartDate: string;
  enrolmentEndDate: string;
  credits: NumericRange;
<<<<<<< HEAD
  summary: {
    level: LocalizedString,
    prerequisites?: string | LocalizedString
  };
  organizationName: LocalizedString;
  teachers: string[];
  languageOfInstructionCodes: Language[];
=======
  level: StudyLevel;
  prerequisites?: string | LocalizedString;
  organization: string;
  teachers: string[];
  languages: Language[];
>>>>>>> main
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
<<<<<<< HEAD
=======
  const lastUpdated = new Date(raw.lastUpdated);
>>>>>>> main

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

<<<<<<< HEAD
  const prerequisites = raw.summary.prerequisites
    ? (raw.summary.prerequisites instanceof Prerequisites
      ? raw.summary.prerequisites
      : new Prerequisites(typeof raw.summary.prerequisites === 'string'
        ? { en: raw.summary.prerequisites }
        : raw.summary.prerequisites
      )
    )
    : undefined;
  
  return new Course({
    id: raw.id,
    unitId: raw.courseUnitId,
    code: raw.code,
    name: raw.name,
    courseDate,
    enrollmentDate: enrollmentDate,
    credits: raw.credits,
    level: raw.summary.level.en as StudyLevel,
    organization: raw.organizationName.en,
    teachers: raw.teachers,
    languages: raw.languageOfInstructionCodes,
    format: raw.type,
    tags: raw.tags,
=======
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
>>>>>>> main
    prerequisites,
  });
}