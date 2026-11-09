import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const sourceRoot = path.join(frontendRoot, 'src');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return sourceFiles(fullPath);
      }

      return /\.(ts|js|svelte)$/.test(entry.name)
        ? [fullPath]
        : [];
    });
}

function relativePath(file) {
  return path.relative(sourceRoot, file).split(path.sep).join('/');
}

const files = sourceFiles(sourceRoot).sort();

function read(relative) {
  return readFileSync(path.join(sourceRoot, relative), 'utf8');
}

describe('study-group retrieval architecture', () => {
  it('constructs the production service only in the runtime', () => {
    const constructors = files
      .filter(file => /\bnew\s+StudyGroupService\s*\(/.test(
        readFileSync(file, 'utf8'),
      ))
      .map(relativePath);

    expect(constructors).toEqual([
      'modules/study-groups/StudyGroupDataRuntime.ts',
    ]);
  });

  it('constructs the coordinator only in the runtime', () => {
    const constructors = files
      .filter(file => /\bnew\s+StudyGroupRequestCoordinator\s*\(/.test(
        readFileSync(file, 'utf8'),
      ))
      .map(relativePath);

    expect(constructors).toEqual([
      'modules/study-groups/StudyGroupDataRuntime.ts',
    ]);
  });

  it('uses the strict service method only from the transport', () => {
    const callers = files
      .filter(file => /\.fetchStudyGroupsChunk\s*\(/.test(
        readFileSync(file, 'utf8'),
      ))
      .map(relativePath);

    expect(callers).toEqual([
      'modules/study-groups/infrastructure/StudyGroupTransport.ts',
    ]);
  });

  it('does not reference obsolete retrieval APIs', () => {
    const obsolete =
      /\b(fetchStudyGroupsBatch|fetchOfferingsBatch|fetchStudyGroups)\s*\(/;

    const matches = files
      .filter(file => obsolete.test(readFileSync(file, 'utf8')))
      .map(relativePath);

    expect(matches).toEqual([]);
  });

  it('keeps the study-group endpoint in its HTTP adapter', () => {
    const endpoint = '/api/courses/batch/study-groups';

    const references = files
      .filter(file => readFileSync(file, 'utf8').includes(endpoint))
      .map(relativePath);

    expect(references).toEqual([
      'modules/study-groups/infrastructure/StudyGroupService.ts',
    ]);
  });

  it('wires the coordinator to the transport and cache loader', () => {
    const runtime = read('modules/study-groups/StudyGroupDataRuntime.ts');
    const transport = read(
      'modules/study-groups/infrastructure/StudyGroupTransport.ts',
    );

    expect(runtime).toContain('new StudyGroupRequestCoordinator(');
    expect(runtime).toContain('createStudyGroupTransport(options.service)');
    expect(runtime).toContain('new StudyGroupCacheLoader(');
    expect(transport).toMatch(/service\.fetchStudyGroupsChunk\s*\(/);
  });
});
