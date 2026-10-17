import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { parse as parseYaml } from 'yaml';

import type { CurriculumType } from '../src/domain/models/Curriculum';
import type { RawCurriculumData } from '../src/domain/parsers/CurriculumParser';
import { CourseCode } from '../src/domain/valueObjects/CourseCode';
import { validateCurriculumMetadata } from '../src/domain/services/CurriculumMetadataValidator';

type CliOptions =
  | { mode: 'format-only' }
  | { mode: 'full'; active: string; historical: string };

const TYPES = ['major', 'minor', 'master'] as const satisfies readonly CurriculumType[];
const DATA_DIR = fileURLToPath(new URL('../src/data/', import.meta.url));

function usage(): string {
  return 'Usage: validate-curricula --format-only | --active courses.json --historical historical.json';
}

function parseArgs(args: string[]): CliOptions {
  if (args.length === 1 && args[0] === '--format-only') {
    return { mode: 'format-only' };
  }

  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!['--active', '--historical'].includes(flag) || !value || value.startsWith('--') || flag in options) {
      throw new Error(usage());
    }
    options[flag] = value;
  }
  if (Object.keys(options).length !== 2 || !options['--active'] || !options['--historical']) {
    throw new Error(usage());
  }
  return { mode: 'full', active: options['--active'], historical: options['--historical'] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readCurriculum(type: CurriculumType): Promise<RawCurriculumData> {
  const filename = path.join(DATA_DIR, `${type}.yaml`);
  const parsed: unknown = parseYaml(await readFile(filename, 'utf8'));
  if (!isRecord(parsed) || !Array.isArray(parsed.curricula)) {
    throw new Error(`${filename}: expected { curricula: [...] }`);
  }
  for (const [index, entry] of parsed.curricula.entries()) {
    if (!isRecord(entry) || typeof entry.code !== 'string' || !entry.code.trim() ||
        typeof entry.name !== 'string' || !entry.name.trim() ||
        !Array.isArray(entry.courses) || !entry.courses.every((code: unknown) => typeof code === 'string')) {
      throw new Error(`${filename}: invalid curriculum entry at index ${index}`);
    }
  }
  return parsed as unknown as RawCurriculumData;
}

async function readCourseCodes(filename: string): Promise<Set<string>> {
  const parsed: unknown = JSON.parse(await readFile(filename, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${filename}: expected a nonempty array of course records`);
  }
  const codes = new Set<string>();
  for (const [index, record] of parsed.entries()) {
    if (!isRecord(record) || typeof record.code !== 'string') {
      throw new Error(`${filename}: course at index ${index} has no string code`);
    }
    try {
      codes.add(new CourseCode(record.code).value);
    } catch (error) {
      throw new Error(`${filename}: invalid course code at index ${index}: ${String(error)}`);
    }
  }
  return codes;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const curricula = {} as Record<CurriculumType, RawCurriculumData>;
  for (const type of TYPES) curricula[type] = await readCurriculum(type);

  const validation = options.mode === 'format-only'
    ? { mode: 'format-only' as const }
    : {
        mode: 'full' as const,
        activeCodes: await readCourseCodes(options.active),
        historicalCodes: await readCourseCodes(options.historical),
      };

  const diagnostics = validateCurriculumMetadata(curricula, validation);
  const errors = diagnostics.filter(d => d.kind !== 'historical-only');
  const info = diagnostics.filter(d => d.kind === 'historical-only');

  console.log(`Curriculum validation (${options.mode})`);
  if (validation.mode === 'full') {
    console.log(`Dataset codes: ${validation.activeCodes.size} active, ${validation.historicalCodes.size} historical`);
  }
  for (const diagnostic of diagnostics) {
    const severity = diagnostic.kind === 'historical-only' ? 'INFO' : 'ERROR';
    console.log(`\n${severity} src/data/${diagnostic.source}.yaml [${diagnostic.curriculum}]`);
    console.log(`  ${diagnostic.kind}: ${JSON.stringify(diagnostic.code)}`);
    console.log(`  ${diagnostic.message}`);
    if (diagnostic.suggestion) console.log(`  Suggested correction: ${diagnostic.suggestion}`);
  }
  console.log(`\nSummary: ${errors.length} error(s), ${info.length} historical-only reference(s)`);
  if (errors.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(`Curriculum validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
