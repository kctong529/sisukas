// src/infrastructure/loaders/AcademicPeriods.ts
import type { AcademicPeriod } from '../../domain/models/AcademicPeriod';
import type { DateRange } from '../../domain/value-objects/DateRange';
import periodsYaml from '../../data/periods.yaml';

/**
 * Transforms YAML periods data into AcademicPeriod objects
 * Validates each entry and skips malformed ones
 */
export function loadAcademicPeriods(yamlData = periodsYaml): AcademicPeriod[] {
  if (!yamlData || !Array.isArray(yamlData.periods)) {
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
