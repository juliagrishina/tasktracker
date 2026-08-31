module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['<rootDir>/.worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.worktrees/'],
  moduleNameMapper: {
    '^\\.\\./data/data-source$': '<rootDir>/src/data/data-source.web.ts',
    '^expo-modules-core$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core/src/index.ts',
    '^expo-modules-core/(.*)$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core/$1',
  },
};
