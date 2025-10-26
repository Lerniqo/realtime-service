/**
 * Jest configuration for the realtime-service
 * Adds path mapping so imports like `src/...` resolve correctly in tests.
 */
module.exports = {
  rootDir: '.',
  testRegex: '.*\\.spec\\.(t|j)s$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
  coverageDirectory: 'coverage',
  maxWorkers: 1,
  workerIdleMemoryLimit: '512MB',
};
