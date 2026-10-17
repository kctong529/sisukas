import type {
  RawCurriculumData,
} from '../parsers/CurriculumParser';
import type { CurriculumType } from '../models/Curriculum';
import { CourseCode } from '../valueObjects/CourseCode';

export type CurriculumDiagnosticKind =
  | 'invalid-code'
  | 'unknown-course'
  | 'historical-only';

export interface CurriculumDiagnostic {
  kind: CurriculumDiagnosticKind;
  source: CurriculumType;
  curriculum: string;
  code: string;
  message: string;
  suggestion?: string;
}

const DASH_VARIANTS = /[\u2010-\u2015\u2212]/g;

function suggestCode(raw: string): string | undefined {
  const suggested = raw
    .replace(DASH_VARIANTS, '-')
    .replace(/\u00a0/g, ' ')
    .trim();

  return suggested !== raw ? suggested : undefined;
}

export function validateCurriculumMetadata(
  curricula: Record<CurriculumType, RawCurriculumData>,
  options: { mode: 'format-only' } | {
    mode: 'full';
    activeCodes: ReadonlySet<string>;
    historicalCodes: ReadonlySet<string>;
  },
): CurriculumDiagnostic[] {
  const diagnostics: CurriculumDiagnostic[] = [];

  for (const source of ['major', 'minor', 'master'] as const) {
    const entries = curricula[source]?.curricula ?? [];

    for (const entry of entries) {
      for (const rawCode of entry.courses) {
        let code: string;

        try {
          // Check the original string before CourseCode normalizes it.
          if (rawCode !== rawCode.trim()) {
            throw new Error('Leading or trailing whitespace');
          }

          code = new CourseCode(rawCode).value;
        } catch (error) {
          diagnostics.push({
            kind: 'invalid-code',
            source,
            curriculum: entry.code,
            code: rawCode,
            message: error instanceof Error
              ? error.message
              : String(error),
            suggestion: suggestCode(rawCode),
          });
          continue;
        }

        if (options.mode === 'format-only') {
          continue;
        }

        if (options.activeCodes.has(code)) {
          continue;
        }

        if (options.historicalCodes.has(code)) {
          diagnostics.push({
            kind: 'historical-only',
            source,
            curriculum: entry.code,
            code: rawCode,
            message: 'Course exists only in historical data',
          });
          continue;
        }

        diagnostics.push({
          kind: 'unknown-course',
          source,
          curriculum: entry.code,
          code: rawCode,
          message: 'Course not found in either dataset',
        });
      }
    }
  }

  return diagnostics;
}
