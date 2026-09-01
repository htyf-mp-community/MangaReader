module.exports = {
  preset: '@react-native/jest-preset',
  watchman: false,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
