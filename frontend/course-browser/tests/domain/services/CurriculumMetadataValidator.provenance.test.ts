import { describe, expect, it } from 'vitest';
import { validateCurriculumMetadata } from '../../../src/domain/services/CurriculumMetadataValidator';
import type { RawCurriculumEntry, RawCurriculumData } from '../../../src/domain/parsers/CurriculumParser';
import type { CurriculumType } from '../../../src/domain/models/Curriculum';

const valid = (): RawCurriculumEntry => ({
  code: 'DSD26', name: 'Digital Systems and Design',
  name_en: 'Digital Systems and Design', official_code: 'ELEC3056',
  basic_studies_code: 'SCI.123', curriculum_period: '2026-2028',
  source_url: 'https://www.aalto.fi/en/example', courses: ['CS-A1110'],
});
function fixture(...entries: RawCurriculumEntry[]): Record<CurriculumType, RawCurriculumData> {
  return { major: { curricula: entries }, minor: { curricula: [] }, master: { curricula: [] } };
}
const format = { mode: 'format-only' as const };
const full = {
  mode: 'full' as const,
  activeCodes: new Set(['CS-A1110', 'JOIN.BSC']),
  historicalCodes: new Set(['ELEC-C0302']),
};

describe('CurriculumMetadataValidator provenance', () => {
  it('accepts valid new metadata in both validation modes', () => {
    expect(validateCurriculumMetadata(fixture(valid()), format)).toEqual([]);
    expect(validateCurriculumMetadata(fixture(valid()), full)).toEqual([]);
  });

  it('allows legacy records without provenance fields', () => {
    const legacy = { code: 'DSD24', name: 'Legacy', courses: ['CS-A1110'] };
    expect(validateCurriculumMetadata(fixture(legacy), format)).toEqual([]);
  });

  it.each(['name_en', 'official_code', 'source_url'] as const)(
    'requires %s for declared 2026-2028 records', (field) => {
      const entry = valid();
      delete entry[field];
      expect(validateCurriculumMetadata(fixture(entry), format))
        .toEqual(expect.arrayContaining([expect.objectContaining({
          kind: 'invalid-provenance', code: field,
        })]));
    },
  );

  it('rejects invalid periods, including nonconsecutive years', () => {
    const entry = { ...valid(), curriculum_period: '2026-2030' };
    expect(validateCurriculumMetadata(fixture(entry), format).some(
      d => d.code === 'curriculum_period',
    )).toBe(true);
  });

  it('rejects unofficial, insecure or malformed source URLs', () => {
    for (const source_url of [
      'http://www.aalto.fi/en/example',
      'https://example.com/curriculum',
      'https://aalto.fi.evil.example/curriculum',
      'not-a-url',
    ]) {
      expect(validateCurriculumMetadata(fixture({ ...valid(), source_url }), format))
        .toEqual(expect.arrayContaining([expect.objectContaining({
          kind: 'invalid-provenance', code: 'source_url',
        })]));
    }
  });

  it('rejects malformed official codes without restricting them to ELEC1234-style codes', () => {
    expect(validateCurriculumMetadata(fixture({ ...valid(), official_code: 'SCI‐3166' }), format))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        kind: 'invalid-provenance', code: 'official_code',
      })]));
    expect(validateCurriculumMetadata(fixture({ ...valid(), official_code: 'CHEM10.A' }), format))
      .toEqual([]);
  });

  it('detects duplicate Sisukas IDs inside a type but not across types', () => {
    expect(validateCurriculumMetadata(fixture(valid(), valid()), format))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        kind: 'duplicate-identifier', code: 'DSD26',
      })]));
    const across = fixture(valid());
    across.minor.curricula = [valid()];
    expect(validateCurriculumMetadata(across, format)).toEqual([]);
  });

  it('does not treat shared official codes across periods as duplicate Sisukas IDs', () => {
    expect(validateCurriculumMetadata(fixture(
      valid(), { ...valid(), code: 'DSD24', curriculum_period: '2024-2026' },
    ), format)).toEqual([]);
  });

  it('preserves existing course-code validation and full-mode dataset checks', () => {
    expect(validateCurriculumMetadata(fixture({ ...valid(), courses: ['ELEC‐C8201'] }), format))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        kind: 'invalid-code', suggestion: 'ELEC-C8201',
      })]));
    expect(validateCurriculumMetadata(fixture({ ...valid(), courses: ['ELEC-C0302'] }), full))
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'historical-only' })]));
    expect(validateCurriculumMetadata(fixture({ ...valid(), courses: ['CS-A9999'] }), full))
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'unknown-course' })]));
  });
});
