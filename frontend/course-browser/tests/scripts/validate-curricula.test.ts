// @vitest-environment node

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';

import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';

const CLI = path.resolve(
  process.cwd(),
  'scripts/validate-curricula.ts'
);

let fixtureDir: string;

async function writeCurricula(codes: string[]): Promise<void> {
  for (const type of ['major', 'minor', 'master']) {
    const curricula = type === 'major'
      ? [{
          code: 'TEST',
          name: 'Test Curriculum',
          courses: codes,
        }]
      : [];

    await writeFile(
      path.join(fixtureDir, `${type}.yaml`),
      stringifyYaml({ curricula }),
    );
  }
}

async function writeDataset(
  filename: string,
  codes: string[],
): Promise<string> {
  const file = path.join(fixtureDir, filename);

  await writeFile(
    file,
    JSON.stringify(codes.map(code => ({ code }))),
  );

  return file;
}

function runCli(...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      CLI,
      '--curricula-dir',
      fixtureDir,
      ...args,
    ],
    {
      encoding: 'utf8',
      timeout: 10_000,
    },
  );
}

describe('validate-curricula CLI', () => {
  beforeEach(async () => {
    fixtureDir = await mkdtemp(
      path.join(tmpdir(), 'sisukas-curricula-')
    );

    await writeCurricula(['CS-A1110']);
  });

  afterEach(async () => {
    await rm(fixtureDir, {
      recursive: true,
      force: true,
    });
  });

  it('runs format-only validation without datasets', () => {
    const result = runCli('--format-only');

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      'Curriculum validation (format-only)'
    );
    expect(result.stdout).toContain('0 error(s)');
  });

  it('rejects malformed curriculum course codes', async () => {
    await writeCurricula(['CS–A1110']);

    const result = runCli('--format-only');

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('invalid-code');
    expect(result.stdout).toContain('CS-A1110');
  });

  it('requires both datasets in full mode', async () => {
    const active = await writeDataset(
      'courses.json',
      ['CS-A1110']
    );

    const result = runCli('--active', active);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage:');
  });

  it('rejects malformed dataset JSON', async () => {
    const active = path.join(fixtureDir, 'courses.json');
    const historical = await writeDataset(
      'historical.json',
      ['CS-A0000']
    );

    await writeFile(active, '{ invalid json');

    const result = runCli(
      '--active', active,
      '--historical', historical,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Curriculum validation failed'
    );
  });

  it('detects unknown references in full mode', async () => {
    await writeCurricula(['CS-A9999']);

    const active = await writeDataset(
      'courses.json',
      ['CS-A1110']
    );

    const historical = await writeDataset(
      'historical.json',
      ['CS-A0000']
    );

    const result = runCli(
      '--active', active,
      '--historical', historical,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('unknown-course');
    expect(result.stdout).toContain('CS-A9999');
  });

  it('accepts valid references in full mode', async () => {
    const active = await writeDataset(
      'courses.json',
      ['CS-A1110']
    );

    const historical = await writeDataset(
      'historical.json',
      ['CS-A0000']
    );

    const result = runCli(
      '--active', active,
      '--historical', historical,
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('0 error(s)');
  });

  it('normalizes dataset code capitalization', async () => {
    await writeCurricula(['JOIN.bsc']);

    const active = await writeDataset(
      'courses.json',
      ['JOIN.BSC']
    );

    const historical = await writeDataset(
      'historical.json',
      ['CS-A0000']
    );

    const result = runCli(
      '--active', active,
      '--historical', historical,
    );

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('unknown-course');
  });
});
