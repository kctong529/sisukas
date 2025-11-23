// src/domain/models/Curriculum.ts
import type { CourseCode } from '../value-objects/CourseTypes';
import type { LocalizedString } from '../value-objects/LocalizedString';

export type CurriculumType = 'major' | 'minor';

export interface Curriculum {
  id: string;
  code: CourseCode;
  name: LocalizedString;
  type: CurriculumType;
  courseCodes: Set<string>;
}