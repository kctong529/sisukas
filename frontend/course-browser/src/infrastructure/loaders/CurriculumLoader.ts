// src/infrastructure/loaders/CurriculumLoader.ts
import type { CurriculaMap, CurriculumType } from '../../domain/models/Curriculum';
import type { CourseCode } from '../../domain/value-objects/CourseTypes';
import majorYaml from '../../data/major.yaml';
import minorYaml from '../../data/minor.yaml';
import { parseCurricula } from '../../domain/parsers/CurriculumParser';

interface RawCurriculumEntry {
  code: string;
  name: string;
  courses: CourseCode[];
}

interface RawCurriculumData {
  curricula: RawCurriculumEntry[];
}

/**
 * Loads and processes major and minor curriculum data from YAML files (infrastructure)
 * and uses the domain parser to transform them into the CurriculaMap domain object
 */
export function loadCurricula(
  majorData: RawCurriculumData = majorYaml as RawCurriculumData,
  minorData: RawCurriculumData = minorYaml as RawCurriculumData)
  : CurriculaMap {
    // Delegation of the parsing task to the domain layer
    return parseCurricula(majorData, minorData);
}