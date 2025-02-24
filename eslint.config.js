import { defineConfig } from 'eslint';

export default defineConfig({
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});