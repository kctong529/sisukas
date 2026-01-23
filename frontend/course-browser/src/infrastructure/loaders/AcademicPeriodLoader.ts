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

function normalizePeriodName(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (s === 'I' || s === '1' || s === 'P1' || s === 'PERIOD I' || s === 'PERIOD 1') return 'I';
  if (s === 'II' || s === '2' || s === 'P2' || s === 'PERIOD II' || s === 'PERIOD 2') return 'II';
  if (s === 'III' || s === '3' || s === 'P3' || s === 'PERIOD III' || s === 'PERIOD 3') return 'III';
  if (s === 'IV' || s === '4' || s === 'P4' || s === 'PERIOD IV' || s === 'PERIOD 4') return 'IV';
  if (s === 'V' || s === '5' || s === 'P5' || s === 'PERIOD V' || s === 'PERIOD 5') return 'V';
  return raw.trim();
}

/**
 * Transforms YAML periods data into AcademicPeriod objects
 * Validates each entry and skips malformed ones
 */
export function loadAcademicPeriods(
  yamlData: RawPeriodsYaml = periodsYaml as RawPeriodsYaml
): AcademicPeriod[] {
  if (!yamlData || typeof yamlData !== 'object' || !Array.isArray(yamlData.periods)) {
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
        name: normalizePeriodName(periodName),
        academicYear: year,
        dateRange,
      });
    }
  }

  return result;
}
