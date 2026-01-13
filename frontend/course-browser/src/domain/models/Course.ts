// src/domain/models/Course.ts
<<<<<<< HEAD
import type { LocalizedString } from '../valueObjects/LocalizedString';
import type { DateRange } from '../valueObjects/DateRange';
import type { NumericRange } from '../valueObjects/NumericRange';
import { CourseCode } from '../valueObjects/CourseCode'; 
import type { Language, StudyLevel, RawCourseFormat, CourseFormat } from '../valueObjects/CourseTypes';
import { normalizeCourseFormat } from '../valueObjects/CourseTypes';
import { Prerequisites } from '../valueObjects/Prerequisites';

export class Course {
  readonly id: string;
  readonly unitId: string;
  readonly code: CourseCode;
  readonly name: LocalizedString;
  readonly courseDate: DateRange;
  readonly enrollmentDate: DateRange;
=======
import type { LocalizedString } from '../value-objects/LocalizedString';
import type { DateRange } from '../value-objects/DateRange';
import type { NumericRange } from '../value-objects/NumericRange';
import { CourseCode } from '../value-objects/CourseCode'; 
import type { Language, StudyLevel, RawCourseFormat, CourseFormat } from '../value-objects/CourseTypes';
import { normalizeCourseFormat } from '../value-objects/CourseTypes';
import { Prerequisites } from '../value-objects/Prerequisites';

export class Course {
  readonly id: string;
  readonly code: CourseCode;
  readonly name: LocalizedString;
  readonly description?: LocalizedString;
  readonly courseDate: DateRange;
  readonly enrollmentPeriod: DateRange;
>>>>>>> main
  readonly credits: NumericRange;
  readonly level: StudyLevel;
  readonly prerequisites?: Prerequisites;
  readonly organization: string;
  readonly teachers: string[];
  readonly languages: Language[];
  readonly format: CourseFormat;
  readonly tags?: string[];
<<<<<<< HEAD

  constructor(params: {
    id: string;
    unitId: string;
    code: string;
    name: LocalizedString;
=======
  readonly lastUpdated: Date;

  constructor(params: {
    id: string;
    code: string;
    name: LocalizedString;
    description?: LocalizedString;
>>>>>>> main
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
<<<<<<< HEAD
  }) {
    this.id = params.id;
    this.unitId = params.unitId;
    this.code = new CourseCode(params.code);
    this.name = params.name;
    this.courseDate = params.courseDate;
    this.enrollmentDate = params.enrollmentDate;
=======
    lastUpdated: Date;
  }) {
    this.id = params.id;
    this.code = new CourseCode(params.code);
    this.name = params.name;
    this.description = params.description;
    this.courseDate = params.courseDate;
    this.enrollmentPeriod = params.enrollmentDate;
>>>>>>> main
    this.credits = params.credits;
    this.level = params.level;
    this.organization = params.organization;
    this.teachers = params.teachers;
    this.languages = params.languages;
    this.format = normalizeCourseFormat(params.format);
    this.tags = params.tags;
<<<<<<< HEAD
=======
    this.lastUpdated = params.lastUpdated;
>>>>>>> main

    // Wrap prerequisites in value object if it's raw LocalizedString
    if (params.prerequisites instanceof Prerequisites) {
      this.prerequisites = params.prerequisites;
    } else if (params.prerequisites) {
      this.prerequisites = new Prerequisites(params.prerequisites);
    }
  }
}