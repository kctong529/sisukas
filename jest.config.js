export default {
  testEnvironment: 'jest-environment-jsdom',  // Required for browser-like environment
  roots: ['<rootDir>/__tests__'], // Point to the tests folder
  transform: {
    '^.+\\.js$': 'babel-jest'  // Use Babel to handle ES Modules
  }
};
