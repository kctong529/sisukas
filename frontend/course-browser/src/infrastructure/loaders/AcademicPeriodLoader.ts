<<<<<<< HEAD
// src/infrastructure/loaders/AcademicPeriodLoader.ts
import type { AcademicPeriod } from '../../domain/models/AcademicPeriod';
import type { DateRange } from '../../domain/valueObjects/DateRange';
import periodsYaml from '../../data/periods.yaml';

type RawPeriodsYaml = {
  periods: Array<{
    year: string;
    periods?: Array<{
      period?: string;
      start_date?: string;
      end_date?: string;
    }>;
  }>;
};

=======
// src/infrastructure/loaders/AcademicPeriods.ts
import type { AcademicPeriod } from '../../domain/models/AcademicPeriod';
import type { DateRange } from '../../domain/value-objects/DateRange';
import periodsYaml from '../../data/periods.yaml';

>>>>>>> main
/**
 * Transforms YAML periods data into AcademicPeriod objects
 * Validates each entry and skips malformed ones
 */
<<<<<<< HEAD
export function loadAcademicPeriods(
  yamlData: RawPeriodsYaml = periodsYaml as RawPeriodsYaml
): AcademicPeriod[] {
  if (!yamlData || typeof yamlData !== 'object' || !Array.isArray(yamlData.periods)) {
=======
export function loadAcademicPeriods(yamlData = periodsYaml): AcademicPeriod[] {
  if (!yamlData || !Array.isArray(yamlData.periods)) {
>>>>>>> main
    throw new Error('Invalid periods data: root must have a "periods" array');
  }

  const result: AcademicPeriod[] = [];

  for (const yearEntry of yamlData.periods) {
    const { year, periods } = yearEntry;

    if (!Array.isArray(periods)) continue;

    for (const period of periods) {
      const { period: periodName, start_date, end_date } = period;

      if (!periodName || !start_date || !end_date) {
        continue;
      }

      const dateRange: DateRange = { start: new Date(start_date), end: new Date(end_date) };
      result.push({
        id: `${year}-${periodName}`,
        name: periodName,
        academicYear: year,
        dateRange,
      });
    }
  }

  return result;
}
