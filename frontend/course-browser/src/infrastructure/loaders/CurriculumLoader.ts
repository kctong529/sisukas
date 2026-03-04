// src/infrastructure/loaders/CurriculumLoader.ts
import type { CurriculaMap, CurriculumType } from '../../domain/models/Curriculum';
import type { RawCurriculumData } from '../../domain/parsers/CurriculumParser';
import { parseCurricula } from '../../domain/parsers/CurriculumParser';

import majorYaml from '../../data/major.yaml';
import minorYaml from '../../data/minor.yaml';
import masterYaml from '../../data/master.yaml';

/**
 * Loads and processes major and minor curriculum data from YAML files (infrastructure)
 * and uses the domain parser to transform them into the CurriculaMap domain object
 */
export function loadCurricula(
  rawByType: Record<CurriculumType, RawCurriculumData> = {
    major: majorYaml as RawCurriculumData,
    minor: minorYaml as RawCurriculumData,
    master: masterYaml as RawCurriculumData,
  }
): CurriculaMap {
  return parseCurricula(rawByType);
}
