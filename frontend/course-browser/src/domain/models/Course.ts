// src/domain/models/Course.ts
import type { LocalizedString } from '../valueObjects/LocalizedString';
import type { DateRange } from '../valueObjects/DateRange';
import type { NumericRange } from '../valueObjects/NumericRange';
import { CourseCode } from '../valueObjects/CourseCode'; 
import type { Language, StudyLevel, RawCourseFormat, CourseFormat } from '../valueObjects/CourseTypes';
import { normalizeCourseFormat } from '../valueObjects/CourseTypes';
import { Prerequisites } from '../valueObjects/Prerequisites';

export class Course {
  readonly id: string;
  readonly code: CourseCode;
  readonly name: LocalizedString;
  readonly courseDate: DateRange;
  readonly enrollmentDate: DateRange;
  readonly credits: NumericRange;
  readonly level: StudyLevel;
  readonly prerequisites?: Prerequisites;
  readonly organization: string;
  readonly teachers: string[];
  readonly languages: Language[];
  readonly format: CourseFormat;
  readonly tags?: string[];

  constructor(params: {
    id: string;
    code: string;
    name: LocalizedString;
    courseDate: DateRange;
    enrollmentDate: DateRange;
    credits: NumericRange;
    level: StudyLevel;
    prerequisites?: LocalizedString | Prerequisites;
    organization: string;
    teachers: string[];
    languages: Language[];
    format: RawCourseFormat;
    tags?: string[];
  }) {
    this.id = params.id;
    this.code = new CourseCode(params.code);
    this.name = params.name;
    this.courseDate = params.courseDate;
    this.enrollmentDate = params.enrollmentDate;
    this.credits = params.credits;
    this.level = params.level;
    this.organization = params.organization;
    this.teachers = params.teachers;
    this.languages = params.languages;
    this.format = normalizeCourseFormat(params.format);
    this.tags = params.tags;

    // Wrap prerequisites in value object if it's raw LocalizedString
    if (params.prerequisites instanceof Prerequisites) {
      this.prerequisites = params.prerequisites;
    } else if (params.prerequisites) {
      this.prerequisites = new Prerequisites(params.prerequisites);
    }
  }
}