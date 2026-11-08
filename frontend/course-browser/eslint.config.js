import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';
import perfectionist from 'eslint-plugin-perfectionist';

import { studyGroupBoundaryRule } from
  './scripts/study-group-boundary-rule.js';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.svelte-kit/**',
      'src/**/*.js',
      'src/**/*.js.map',
      'src/**/*.d.ts',
    ],
  },
  
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],

  // Browser (Svelte)
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: ts.parser,
      },
      globals: globals.browser,
    },
    rules: {
      "svelte/prefer-svelte-reactivity": "off",
    },
  },

  // Node.js scripts (CLI / tooling)
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: ["**/*.svelte.ts"],
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    rules: {
      "svelte/prefer-svelte-reactivity": "off",
    },
  },

  {
    files: ['src/**/*.{ts,tsx,svelte,js}'],
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

  {
    files: ['**/*.{ts,js,svelte}'],
    plugins: {
      perfectionist,
    },
    rules: {
      'perfectionist/sort-imports': ['error', {
        type: 'alphabetical',
        order: 'asc',
        sortSideEffects: false,

        tsconfig: {
          rootDir: '.',
          filename: 'tsconfig.app.json',
        },

        groups: [
          'side-effect',
          'side-effect-style',
          ['value-builtin', 'value-external'],
          ['value-tsconfig-path', 'value-internal'],
          ['value-parent', 'value-sibling', 'value-index'],
          [
            'type-builtin',
            'type-external',
            'type-tsconfig-path',
            'type-internal',
            'type-parent',
            'type-sibling',
            'type-index',
            'type-import',
          ],
          'unknown',
        ],

        newlinesBetween: 1,
      }],

      'perfectionist/sort-named-imports': ['error', {
        type: 'alphabetical',
        order: 'asc',
      }],

      'no-duplicate-imports': ['error', {
        allowSeparateTypeImports: true,
      }],
    },
  },

  {
    files: ['**/*.{ts,svelte}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
    },
  },
];
