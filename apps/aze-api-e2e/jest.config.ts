export default {
  displayName: 'aze-api-e2e',
  preset: '../../jest.preset.js',
  globalSetup: '<rootDir>/src/support/global-setup.ts',
  globalTeardown: '<rootDir>/src/support/global-teardown.ts',
  setupFiles: ['<rootDir>/src/support/test-setup.ts'],
  // Every spec here drives one running API over one database and one Redis.
  // Parallel workers share that state: a product created by one file bumps
  // the cached list's generation, which is a MISS the file asserting a HIT
  // never asked for. Run them one at a time.
  maxWorkers: 1,
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/aze-api-e2e',
};
