// src/domain/models/Curriculum.ts
<<<<<<< HEAD
=======
import type { CourseCode } from '../value-objects/CourseCode';

>>>>>>> main
export type CurriculumType = 'major' | 'minor';

export interface CurriculaMap {
    major: Record<string, {
        name: string;
<<<<<<< HEAD
        courses: Set<string>;
    }>;
    minor: Record<string, {
        name: string;
        courses: Set<string>;
=======
        courses: Set<CourseCode>;
    }>;
    minor: Record<string, {
        name: string;
        courses: Set<CourseCode>;
>>>>>>> main
    }>;
}