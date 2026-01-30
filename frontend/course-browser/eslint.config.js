import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

export default [
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
    ignores: ['dist/', 'node_modules/', '.svelte-kit/'],
  },
];
