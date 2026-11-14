import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src',
);

function styleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return styleFiles(fullPath);
    return /\.(svelte|css)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('responsive styles', () => {
  it('does not use unitless numeric width/height media breakpoints', () => {
    const violations = [];
    for (const file of styleFiles(sourceRoot)) {
      const contents = readFileSync(file, 'utf8');
      const lines = contents.split('\n');
      lines.forEach((line, index) => {
        // A length in an ordinary min/max-width/height query needs a unit.
        if (/@media\s*\(\s*(?:min|max)-(?:width|height)\s*:\s*\d+(?:\.\d+)?\s*\)/.test(line)) {
          violations.push(`${path.relative(sourceRoot, file)}:${index + 1}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
