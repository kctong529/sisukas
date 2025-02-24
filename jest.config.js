export default {
  testEnvironment: 'jsdom',  // Required for browser-like environment
  roots: ['<rootDir>/__test__'], // Point to the tests folder
  transform: {
    '^.+\\.js$': 'babel-jest'  // Use Babel to handle ES Modules
  }
};
