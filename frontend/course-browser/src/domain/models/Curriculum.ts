// src/domain/models/Curriculum.ts
export type CurriculumType = 'major' | 'minor' | 'master';

export interface CurriculumEntry {
  name: string;
  courses: Set<string>;
}

export type CurriculaMap = Record<CurriculumType, Record<string, CurriculumEntry>>;