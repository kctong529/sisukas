// src/domain/models/Course.ts
import type { LocalizedString } from '../value-objects/LocalizedString';
import type { DateRange } from '../value-objects/DateRange';
import type { NumericRange } from '../value-objects/NumericRange';
import type { CourseCode, Language, StudyLevel, RawCourseFormat, CourseFormat } from '../value-objects/CourseTypes';
import { normalizeCourseFormat } from '../value-objects/CourseTypes';
import { Prerequisites } from '../value-objects/Prerequisites';

export class Course {
  readonly id: string;
  readonly code: CourseCode;
  readonly name: LocalizedString;
  readonly description?: LocalizedString;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly enrollmentPeriod: DateRange;
  readonly credits: NumericRange;
  readonly level: StudyLevel;
  readonly prerequisites?: Prerequisites;
  readonly organization: string;
  readonly teachers: string[];
  readonly languages: Language[];
  readonly format: CourseFormat;
  readonly tags?: string[];
  readonly lastUpdated: Date;

  constructor(params: {
    id: string;
    code: CourseCode;
    name: LocalizedString;
    description?: LocalizedString;
    startDate: Date;
    endDate: Date;
    enrollmentPeriod: DateRange;
    credits: NumericRange;
    level: StudyLevel;
    prerequisites?: LocalizedString | Prerequisites;
    organization: string;
    teachers: string[];
    languages: Language[];
    format: RawCourseFormat;
    tags?: string[];
    lastUpdated: Date;
  }) {
    this.id = params.id;
    this.code = params.code;
    this.name = params.name;
    this.description = params.description;
    this.startDate = params.startDate;
    this.endDate = params.endDate;
    this.enrollmentPeriod = params.enrollmentPeriod;
    this.credits = params.credits;
    this.level = params.level;
    this.organization = params.organization;
    this.teachers = params.teachers;
    this.languages = params.languages;
    this.format = normalizeCourseFormat(params.format);
    this.tags = params.tags;
    this.lastUpdated = params.lastUpdated;

    // Wrap prerequisites in value object if it's raw LocalizedString
    if (params.prerequisites instanceof Prerequisites) {
      this.prerequisites = params.prerequisites;
    } else if (params.prerequisites) {
      this.prerequisites = new Prerequisites(params.prerequisites);
    }
  }
}