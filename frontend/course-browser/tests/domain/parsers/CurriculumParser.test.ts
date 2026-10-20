import { describe, expect, it, vi } from 'vitest';
import { parseCurricula, type RawCurriculumData } from '../../../src/domain/parsers/CurriculumParser';
import type { CurriculumType } from '../../../src/domain/models/Curriculum';

function fixture(
  majors: RawCurriculumData['curricula'] = [],
  minors: RawCurriculumData['curricula'] = [],
  masters: RawCurriculumData['curricula'] = [],
): Record<CurriculumType, RawCurriculumData> {
  return {
    major: { curricula: majors },
    minor: { curricula: minors },
    master: { curricula: masters },
  };
}

describe('parseCurricula', () => {
  it('preserves optional provenance fields and the Sisukas identifier', () => {
    const result = parseCurricula(fixture([{
      code: 'DSD26',
      name: 'Digital Systems and Design',
      name_en: 'Digital Systems and Design',
      official_code: 'ELEC3056',
      basic_studies_code: 'EXAMPLE001',
      curriculum_period: '2026-2028',
      source_url: 'https://www.aalto.fi/en/example',
      courses: ['CS-A1110', 'MS-A0111'],
    }]));

    expect(Object.keys(result.major)).toEqual(['DSD26']);
    expect(result.major.DSD26).toMatchObject({
      name: 'Digital Systems and Design',
      nameEn: 'Digital Systems and Design',
      officialCode: 'ELEC3056',
      basicStudiesCode: 'EXAMPLE001',
      curriculumPeriod: '2026-2028',
      sourceUrl: 'https://www.aalto.fi/en/example',
    });
    expect(result.major.DSD26.courses).toEqual(new Set(['CS-A1110', 'MS-A0111']));
  });

  it('supports legacy entries with no provenance fields', () => {
    const result = parseCurricula(fixture([{
      code: 'DSD24', name: 'Digital Systems and Design', courses: ['CS-A1110'],
    }]));
    expect(result.major.DSD24.name).toBe('Digital Systems and Design');
    expect(result.major.DSD24.officialCode).toBeUndefined();
    expect(result.major.DSD24.sourceUrl).toBeUndefined();
    expect(result.major.DSD24.courses).toEqual(new Set(['CS-A1110']));
  });

  it('keeps the three curriculum types isolated', () => {
    const entry = { code: 'SHARED', name: 'Example', courses: ['CS-A1110'] };
    const result = parseCurricula(fixture([entry], [entry], [entry]));
    for (const type of ['major', 'minor', 'master'] as const) {
      expect(result[type].SHARED).toBeDefined();
      expect(result[type].SHARED.courses).toEqual(new Set(['CS-A1110']));
    }
    expect(result.major.SHARED).not.toBe(result.minor.SHARED);
  });

  it('returns empty maps for empty curriculum arrays', () => {
    expect(parseCurricula(fixture())).toEqual({ major: {}, minor: {}, master: {} });
  });

  it('normalizes course-code case and removes duplicates', () => {
    const result = parseCurricula(fixture([{
      code: 'TEST26', name: 'Test', courses: ['cs-a1110', 'CS-A1110', 'JOIN.bsc'],
    }]));
    expect(result.major.TEST26.courses).toEqual(new Set(['CS-A1110', 'JOIN.BSC']));
  });

  it('skips invalid course codes but keeps valid ones and logs the error', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = parseCurricula(fixture([{
        code: 'TEST26', name: 'Test', courses: ['CS-A1110', 'ELEC‐C8201'],
      }]));
      expect(result.major.TEST26.courses).toEqual(new Set(['CS-A1110']));
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('Skipping invalid course code'),
        expect.any(String),
      );
    } finally {
      log.mockRestore();
    }
  });

  it('skips malformed entries while retaining well-formed entries', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = parseCurricula(fixture([
        { code: '', name: 'Missing key', courses: [] },
        { code: 'BAD', name: 'Bad list', courses: null as unknown as string[] },
        { code: 'OK26', name: 'Valid', courses: ['CS-A1110'] },
      ]));
      expect(Object.keys(result.major)).toEqual(['OK26']);
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });

  it('warns and leaves a category empty when its curricula array is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = parseCurricula({
        ...fixture(),
        major: {} as RawCurriculumData,
      });
      expect(result.major).toEqual({});
      expect(warn).toHaveBeenCalledWith('Curricula data missing expected array.');
    } finally {
      warn.mockRestore();
    }
  });

  it('sorts curricula by display name while retaining their stable keys', () => {
    const result = parseCurricula(fixture([
      { code: 'Z26', name: 'Zeta', courses: [] },
      { code: 'A26', name: 'Alpha', courses: [] },
    ]));
    expect(Object.keys(result.major)).toEqual(['A26', 'Z26']);
  });

  it('keeps distinct Sisukas identifiers even when official codes are identical', () => {
    const result = parseCurricula(fixture([
      { code: 'TEST24', name: 'Test 2024', official_code: 'EXAMPLE001', courses: [] },
      { code: 'TEST26', name: 'Test 2026', official_code: 'EXAMPLE001', courses: [] },
    ]));
    expect(Object.keys(result.major)).toHaveLength(2);
    expect(result.major.TEST24.officialCode).toBe('EXAMPLE001');
    expect(result.major.TEST26.officialCode).toBe('EXAMPLE001');
  });
});
