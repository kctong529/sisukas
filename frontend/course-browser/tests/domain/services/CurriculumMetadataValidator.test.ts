import { describe, expect, it } from 'vitest';
import { validateCurriculumMetadata } from '../../../src/domain/services/CurriculumMetadataValidator';
import type { CurriculumType } from '../../../src/domain/models/Curriculum';
import type { RawCurriculumData } from '../../../src/domain/parsers/CurriculumParser';

function fixture(codes: string[]): Record<CurriculumType, RawCurriculumData> {
  return {
    major: { curricula: [{ code: 'DSD26', name: 'Digital Systems and Design', courses: codes }] },
    minor: { curricula: [] },
    master: { curricula: [] },
  };
}
const full = {
  mode: 'full' as const,
  activeCodes: new Set(['CS-A1110', 'JOIN.BSC']),
  historicalCodes: new Set(['ELEC-C0302']),
};

describe('CurriculumMetadataValidator', () => {
  it('accepts active references in full mode', () => {
    expect(validateCurriculumMetadata(fixture(['CS-A1110', 'JOIN.bsc']), full)).toEqual([]);
  });
  it('rejects Unicode dashes in either mode', () => {
    for (const mode of [{ mode: 'format-only' as const }, full]) {
      expect(validateCurriculumMetadata(fixture(['ELEC‐C8201']), mode)).toMatchObject([
        { kind: 'invalid-code', suggestion: 'ELEC-C8201' },
      ]);
    }
  });
  it('ignores dataset membership in format-only mode', () => {
    expect(validateCurriculumMetadata(fixture(['CS-A9999']), { mode: 'format-only' })).toEqual([]);
  });
  it('reports unknown courses in full mode', () => {
    expect(validateCurriculumMetadata(fixture(['CS-A9999']), full)[0].kind).toBe('unknown-course');
  });
  it('reports historical-only references in full mode', () => {
    expect(validateCurriculumMetadata(fixture(['ELEC-C0302']), full)[0].kind).toBe('historical-only');
  });
  it('rejects surrounding whitespace in either mode', () => {
    expect(validateCurriculumMetadata(fixture([' CS-A1110 ']), { mode: 'format-only' })[0].kind).toBe('invalid-code');
  });
});
