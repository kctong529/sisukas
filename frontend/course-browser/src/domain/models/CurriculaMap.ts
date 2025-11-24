// src/domain/models/Curriculum.ts
import type { CourseCode } from '../value-objects/CourseTypes';

export type CurriculumType = 'major' | 'minor';

export interface Curriculum {
  id: string;
  code: CourseCode;
  name: string;
  type: CurriculumType;
  courseCodes: Set<string>;
}

export interface CurriculaMap {
    major: Record<string, {
        name: string;
        courses: Set<CourseCode>;
    }>;
    minor: Record<string, {
        name: string;
        courses: Set<CourseCode>;
    }>;
}