import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The rule runs from frontend/course-browser; do not depend on process.cwd().
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(frontendRoot, 'src');
const moduleRoot = path.join(sourceRoot, 'modules', 'study-groups');
const testsRoot = path.join(frontendRoot, 'tests');
const toSlash = (value) => value.split(path.sep).join('/');
const inside = (candidate, dir) => candidate === dir || candidate.startsWith(`${dir}${path.sep}`);

const exceptions = new Map([
  ['src/components/courses/StudyGroupsSection.svelte', new Set(['formatters/studyGroupFormatters'])],
]);

function targetPath(importer, specifier) {
  if (specifier === '@modules/study-groups') return moduleRoot;
  if (specifier.startsWith('@modules/study-groups/')) {
    return path.join(moduleRoot, specifier.slice('@modules/study-groups/'.length));
  }
  if (specifier.startsWith('.')) {
    return path.resolve(path.dirname(importer), specifier);
  }
  return null;
}

export const studyGroupBoundaryRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require public imports from the study-group module' },
    schema: [],
    messages: { privateImport: 'Import study-group contracts from @modules/study-groups; private paths are not an external API.' },
  },
  create(context) {
    const importer = path.resolve(context.filename);
    if (!inside(importer, sourceRoot) || inside(importer, moduleRoot)) return {};
    // Focused implementation tests are intentionally outside this production-source policy.
    if (inside(importer, testsRoot)) return {};
    const importerRel = toSlash(path.relative(frontendRoot, importer));
    function check(node, raw) {
      if (typeof raw !== 'string') return;
      const target = targetPath(importer, raw);
      if (!target || !inside(target, moduleRoot) || target === moduleRoot || target === `${moduleRoot}${path.sep}index`) return;
      const internalRel = toSlash(path.relative(moduleRoot, target));
      if (exceptions.get(importerRel)?.has(internalRel)) return;
      context.report({ node, messageId: 'privateImport' });
    }
    return {
      ImportDeclaration(node) { check(node.source, node.source.value); },
      ExportNamedDeclaration(node) { if (node.source) check(node.source, node.source.value); },
      ExportAllDeclaration(node) { check(node.source, node.source.value); },
      ImportExpression(node) { if (node.source.type === 'Literal') check(node.source, node.source.value); },
    };
  },
};
