// src/domain/models/Curriculum.ts
import type { CourseCode } from '../value-objects/CourseCode';

export type CurriculumType = 'major' | 'minor';

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