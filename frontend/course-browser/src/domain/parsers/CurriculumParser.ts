// src/domain/parsers/CurriculumParser.ts
import type {
  CurriculaMap,
  CurriculumEntry,
  CurriculumType,
} from '../models/Curriculum';
import { CourseCode } from '../valueObjects/CourseCode';

export interface RawCurriculumEntry {
  code: string;
  name: string;
  name_en?: string;
  official_code?: string;
  basic_studies_code?: string;
  curriculum_period?: string;
  source_url?: string;
  courses: string[];
}

export interface RawCurriculumData {
  curricula: RawCurriculumEntry[];
}

// Helper to process an array of raw curriculum entries
const processCurriculumEntries = (
  entries: RawCurriculumEntry[] | undefined,
  targetMap: Record<string, CurriculumEntry>
) => {
  if (!Array.isArray(entries)) {
    console.warn('Curricula data missing expected array.');
    return;
  }

  for (const entry of entries) {
    if (!entry.code || typeof entry.code !== 'string' || !entry.name || !Array.isArray(entry.courses)) {
      console.warn(`Skipping malformed curriculum entry: ${JSON.stringify(entry)}`);
      continue;
    }

    const validatedCourseCodes = new Set<string>();

    for (const rawCode of entry.courses) {
      try {
        const courseCodeVo = new CourseCode(rawCode);
        validatedCourseCodes.add(courseCodeVo.value);
      } catch (error) {
        console.error(`Skipping invalid course code "${rawCode}" in curriculum "${entry.code}":`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    targetMap[entry.code] = {
      name: entry.name,
      nameEn: entry.name_en,
      officialCode: entry.official_code,
      basicStudiesCode: entry.basic_studies_code,
      curriculumPeriod: entry.curriculum_period,
      sourceUrl: entry.source_url,
      courses: validatedCourseCodes,
    };
  }
};

function sortCurriculumMap(
  map: Record<string, CurriculumEntry>
): Record<string, CurriculumEntry> {
  return Object.fromEntries(
    Object.entries(map).sort(([, a], [, b]) =>
      a.name.localeCompare(b.name)
    )
  );
}

export function parseCurricula(
  rawByType: Record<CurriculumType, RawCurriculumData>
): CurriculaMap {
  const out = {} as CurriculaMap;

  for (const [type, raw] of Object.entries(rawByType) as Array<[CurriculumType, RawCurriculumData]>) {
    const bucket: Record<string, CurriculumEntry> = {};
    processCurriculumEntries(raw.curricula, bucket);
    out[type] = sortCurriculumMap(bucket);
  }

  return out;
}