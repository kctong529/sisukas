// src/domain/models/Curriculum.ts
export type CurriculumType = 'major' | 'minor';

export interface CurriculaMap {
    major: Record<string, {
        name: string;
        courses: Set<string>;
    }>;
    minor: Record<string, {
        name: string;
        courses: Set<string>;
    }>;
}