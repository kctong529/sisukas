// tests/domain/loaders/AcademicPeriods.test.ts
import { describe, it, expect } from 'vitest';
import { loadAcademicPeriods } from '../../../src/infrastructure/loaders/AcademicPeriodLoader';
import type { AcademicPeriod } from '../../../src/domain/models/AcademicPeriod';

// helper to check dates
function expectDate(actual: Date, expected: string) {
  expect(actual.getTime()).toBe(new Date(expected).getTime());
}

describe('loadAcademicPeriods', () => {
  it('should correctly transform valid YAML into AcademicPeriod objects', () => {
    const mockYaml = {
      periods: [
        {
          year: '2024-25',
          periods: [
            { period: 'Period I', start_date: '2024-09-02', end_date: '2024-10-20' },
            { period: 'Period II', start_date: '2024-10-21', end_date: '2024-12-08' },
          ],
        },
        {
          year: '2025-26',
          periods: [
            { period: 'Period I', start_date: '2025-09-01', end_date: '2025-10-19' },
          ],
        },
      ],
    };

    const periods: AcademicPeriod[] = loadAcademicPeriods(mockYaml);

    expect(periods).toHaveLength(3);
    expect(periods[0]).toMatchObject({
      id: '2024-25-Period I',
      name: 'I',
      academicYear: '2024-25',
    });
    expect(periods[1].id).toBe('2024-25-Period II');
    expect(periods[2].id).toBe('2025-26-Period I');

    expectDate(periods[0].dateRange.start, '2024-09-02');
    expectDate(periods[0].dateRange.end, '2024-10-20');
  });

  it('should skip periods with missing fields', () => {
    const mockYaml = {
      periods: [
        {
          year: '2024-25',
          periods: [
            { period: 'Period I', start_date: '2024-09-02', end_date: '2024-10-20' },
            { start_date: '2024-10-21', end_date: '2024-12-08' }, // missing name
          ],
        },
      ],
    };

    const periods = loadAcademicPeriods(mockYaml);
    expect(periods).toHaveLength(1);
    expect(periods[0].name).toBe('I');
  });

  it('should handle years with no periods gracefully', () => {
    const mockYaml = {
      periods: [
        { year: '2026-27', periods: [] },
      ],
    };

    const periods = loadAcademicPeriods(mockYaml);
    expect(periods).toHaveLength(0);
  });
});
