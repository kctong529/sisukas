import type { Curriculum, CurriculumType } from '../../domain/models/Curriculum';
import majorYaml from '../../data/major.yaml';
import minorYaml from '../../data/minor.yaml';

interface RawCurriculumEntry {
  code: string;
  name: string;
  courses: string[];
}

interface RawCurriculaData {
  curricula: RawCurriculumEntry[];
}

/**
 * Helper to validate and transform a single raw curriculum entry
 */
function parseRawCurriculum(raw: RawCurriculumEntry, type: CurriculumType): Curriculum | null {
  const { code, name, courses } = raw;

  // Basic validation for required fields
  if (!code || !name || !Array.isArray(courses)) {
    console.warn(`Skipping malformed ${type} curriculum entry: ${JSON.stringify(raw)}`);
    return null;
  }

  const id = `${type}-${name}`;

  return {
    id,
    code,
    name,
    type,
    courseCodes: new Set(courses.map(c => c.toUpperCase())),
  };
}

/**
 * Loads and processes major and minor curriculum data from YAML files
 * Validates entries and transforms them into Curriculum domain objects
 */
export function loadCurricula(
  majorData: RawCurriculaData = majorYaml as RawCurriculaData,
  minorData: RawCurriculaData = minorYaml as RawCurriculaData
): Curriculum[] {
  const allCurricula: Curriculum[] = [];

  // Function to process a category of curricula
  const processCurricula = (data: RawCurriculaData, type: CurriculumType) => {
    if (data && Array.isArray(data.curricula)) {
      data.curricula.forEach(raw => {
        const curriculum = parseRawCurriculum(raw, type);
        if (curriculum) {
          allCurricula.push(curriculum);
        }
      });
    } else {
      console.error(`Curricula data for type '${type}' is missing or invalid.`);
    }
  };

  processCurricula(majorData, 'major');
  processCurricula(minorData, 'minor');

  return allCurricula;
}