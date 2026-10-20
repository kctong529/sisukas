import type { RawCurriculumData, RawCurriculumEntry } from '../parsers/CurriculumParser';
import type { CurriculumType } from '../models/Curriculum';
import { CourseCode } from '../valueObjects/CourseCode';

export type CurriculumDiagnosticKind =
  | 'invalid-code'
  | 'unknown-course'
  | 'historical-only'
  | 'duplicate-identifier'
  | 'invalid-provenance';

export interface CurriculumDiagnostic {
  kind: CurriculumDiagnosticKind;
  source: CurriculumType;
  curriculum: string;
  code: string;
  message: string;
  suggestion?: string;
}

export type CurriculumValidationOptions =
  | { mode: 'format-only' }
  | {
      mode: 'full';
      activeCodes: ReadonlySet<string>;
      historicalCodes: ReadonlySet<string>;
    };

const SOURCES: readonly CurriculumType[] = ['major', 'minor', 'master'];
const DASH_VARIANTS = /[\u2010-\u2015\u2212]/g;
const MODULE_CODE = /^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*$/;
const PERIOD = /^(\d{4})-(\d{4})$/;

function suggestCode(raw: string): string | undefined {
  const suggested = raw.replace(DASH_VARIANTS, '-').replace(/\u00a0/g, ' ').trim();
  return suggested !== raw ? suggested : undefined;
}

function validateProvenance(
  source: CurriculumType,
  entry: RawCurriculumEntry,
  diagnostics: CurriculumDiagnostic[],
): void {
  const add = (field: string, message: string) => diagnostics.push({
    kind: 'invalid-provenance', source, curriculum: entry.code,
    code: field, message,
  });

  // Legacy entries without a declared curriculum period remain supported.
  // For explicitly declared 2026–2028 entries, require the new metadata contract.
  const period = entry.curriculum_period;
  if (period !== undefined) {
    const match = typeof period === 'string' ? PERIOD.exec(period) : null;
    if (!match || Number(match[2]) !== Number(match[1]) + 2) {
      add('curriculum_period', 'Expected a two-year curriculum period in YYYY-YYYY format');
    }
  }

  const newEntry = period === '2026-2028';
  for (const [field, value] of [
    ['name_en', entry.name_en],
    ['official_code', entry.official_code],
    ['source_url', entry.source_url],
  ] as const) {
    if (newEntry && (typeof value !== 'string' || !value.trim())) {
      add(field, `Required for a 2026-2028 curriculum: ${field}`);
    } else if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
      add(field, `Must be a non-empty string when provided: ${field}`);
    }
  }

  for (const [field, code] of [
    ['official_code', entry.official_code],
    ['basic_studies_code', entry.basic_studies_code],
  ] as const) {
    if (code !== undefined && (typeof code !== 'string' || code !== code.trim() || !MODULE_CODE.test(code))) {
      add(field, `Invalid official module code: ${String(code)}`);
    }
  }

  if (entry.source_url !== undefined && typeof entry.source_url === 'string' && entry.source_url.trim()) {
    try {
      const url = new URL(entry.source_url);
      if (url.protocol !== 'https:' || !(['aalto.fi', 'www.aalto.fi'].includes(url.hostname))) {
        add('source_url', 'Source URL must use HTTPS on aalto.fi');
      }
    } catch {
      add('source_url', 'Source URL is not a valid URL');
    }
  }
}

export function validateCurriculumMetadata(
  curricula: Record<CurriculumType, RawCurriculumData>,
  options: CurriculumValidationOptions,
): CurriculumDiagnostic[] {
  const diagnostics: CurriculumDiagnostic[] = [];

  for (const source of SOURCES) {
    const entries = curricula[source]?.curricula ?? [];
    const identifiers = new Set<string>();

    for (const entry of entries) {
      if (identifiers.has(entry.code)) {
        diagnostics.push({
          kind: 'duplicate-identifier', source, curriculum: entry.code,
          code: entry.code, message: 'Duplicate Sisukas identifier within curriculum type',
        });
      }
      identifiers.add(entry.code);
      validateProvenance(source, entry, diagnostics);

      for (const rawCode of entry.courses) {
        let code: string;
        try {
          if (typeof rawCode !== 'string' || rawCode !== rawCode.trim()) {
            throw new Error('Course code must be a string without surrounding whitespace');
          }
          code = new CourseCode(rawCode).value;
        } catch (error) {
          diagnostics.push({
            kind: 'invalid-code', source, curriculum: entry.code,
            code: String(rawCode),
            message: error instanceof Error ? error.message : String(error),
            suggestion: typeof rawCode === 'string' ? suggestCode(rawCode) : undefined,
          });
          continue;
        }

        if (options.mode === 'format-only' || options.activeCodes.has(code)) continue;
        if (options.historicalCodes.has(code)) {
          diagnostics.push({
            kind: 'historical-only', source, curriculum: entry.code,
            code: rawCode, message: 'Course exists only in historical data',
          });
        } else {
          diagnostics.push({
            kind: 'unknown-course', source, curriculum: entry.code,
            code: rawCode, message: 'Course not found in either dataset',
          });
        }
      }
    }
  }
  return diagnostics;
}
