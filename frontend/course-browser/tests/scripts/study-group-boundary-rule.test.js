
import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import { studyGroupBoundaryRule } from '../../scripts/study-group-boundary-rule.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

const linter = new Linter();

const config = [
  {
    files: ['**/*.{js,svelte,ts}'],
    plugins: {
      'local-boundaries': {
        rules: {
          'study-groups': studyGroupBoundaryRule,
        },
      },
    },
    rules: {
      'local-boundaries/study-groups': 'error',
    },
  },
];

const check = (file, source) =>
  linter.verify(source, config, {
    filename: path.join(root, file),
  });

describe('study-group import boundary', () => {
  it('permits public imports', () => {
    expect(
      check(
        'src/components/calendar/example.js',
        'import { getStudyGroupDataRuntime } from "@modules/study-groups";'
      )
    ).toHaveLength(0);
  });

  it('rejects aliased deep imports', () => {
    expect(
      check(
        'src/components/calendar/example.js',
        'import { StudyGroupCache } from "@modules/study-groups/cache/StudyGroupCache";'
      )
    ).toHaveLength(1);
  });

  it('rejects relative deep imports', () => {
    expect(
      check(
        'src/components/calendar/example.js',
        'import { StudyGroupCache } from "../../modules/study-groups/cache/StudyGroupCache";'
      )
    ).toHaveLength(1);
  });

  it('permits an import within the owning module', () => {
    expect(
      check(
        'src/modules/study-groups/retrieval/example.js',
        'import { StudyGroupCache } from "../cache/StudyGroupCache";'
      )
    ).toHaveLength(0);
  });

  it('permits the documented formatter exception', () => {
    expect(
      check(
        'src/components/courses/StudyGroupsSection.svelte',
        'import { formatStudyEventTime } from "../../modules/study-groups/formatters/studyGroupFormatters";'
      )
    ).toHaveLength(0);
  });

  it('rejects export-through and dynamic imports', () => {
    expect(
      check(
        'src/components/calendar/example.js',
        'export * from "@modules/study-groups/cache/StudyGroupCache"; import("@modules/study-groups/cache/StudyGroupCache");'
      )
    ).toHaveLength(2);
  });
});
