import type { CurriculaMap } from '../models/Curriculum';
import type { CourseCode } from '../value-objects/CourseTypes';

interface RawCurriculumEntry {
  code: string;
  name: string;
  courses: CourseCode[];
}

interface RawCurriculumData {
  curricula: RawCurriculumEntry[];
}

// Helper to process an array of raw curriculum entries
const processCurriculumEntries = (
  entries: RawCurriculumEntry[] | undefined,
  targetMap: CurriculaMap['major'] | CurriculaMap['minor']
) => {
  if (!Array.isArray(entries)) {
    console.warn('Curricula data missing expected array for major or minor programs.');
    return;
  }

  for (const entry of entries) {
    if (!entry.code || typeof entry.code !== 'string' || !entry.name || !Array.isArray(entry.courses)) {
      console.warn(`Skipping malformed curriculum entry: ${JSON.stringify(entry)}`);
      continue;
    }

    targetMap[entry.code] = {
      name: entry.name,
      courses: new Set(entry.courses),
    };
  }
};

/**
 * Parses raw curricula data objects (e.g., from YAML files) and transforms it
 * into the optimized CurriculaMap object required by the blueprints.
 *
 * @param majorData Raw data object containing major curricula.
 * @param minorData Raw data object containing minor curricula.
 * @returns A fully processed CurriculaMap instance.
 */
export function parseCurricula(
  majorData: RawCurriculumData,
  minorData: RawCurriculumData): CurriculaMap {

  const curriculaMap: CurriculaMap = {
    major: {},
    minor: {},
  };

  processCurriculumEntries(majorData.curricula, curriculaMap.major);
  processCurriculumEntries(minorData.curricula, curriculaMap.minor);

  return curriculaMap;
}