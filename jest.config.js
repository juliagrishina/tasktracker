module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['<rootDir>/.worktrees/'],
  moduleNameMapper: {
    '^\\.\\./data/data-source$': '<rootDir>/src/data/data-source.web.ts',
  },
};
