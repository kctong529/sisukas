const { defineConfig } = require('eslint');

module.exports = defineConfig({
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});