import type { CurriculaMap, Curriculum, CurriculumType } from '../../domain/models/CurriculaMap';
import type { CourseCode } from '../../domain/value-objects/CourseTypes';
import majorYaml from '../../data/major.yaml';
import minorYaml from '../../data/minor.yaml';

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
    if (!entry.code || !entry.name || !Array.isArray(entry.courses)) {
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
 * Parses raw curricula data (e.g. from a YAML file) and transforms it
 * into the optimized CurriculaMap object required by the blueprints
 */
function parseCurricula(
  majorData: RawCurriculumData = majorYaml as RawCurriculumData,
  minorData: RawCurriculumData = minorYaml as RawCurriculumData)
  : CurriculaMap {
  const curriculaMap: CurriculaMap = {
    major: {},
    minor: {},
  };

  processCurriculumEntries(majorData.curricula, curriculaMap.major);
  processCurriculumEntries(minorData.curricula, curriculaMap.minor);

  return curriculaMap;
}

/**
 * Loads and processes major and minor curriculum data from YAML files
 * Validates entries and transforms them into Curriculum domain objects
 */
export function loadCurricula(
  majorData: RawCurriculumData = majorYaml as RawCurriculumData,
  minorData: RawCurriculumData = minorYaml as RawCurriculumData)
  : CurriculaMap {
    return parseCurricula(majorData, minorData);
}