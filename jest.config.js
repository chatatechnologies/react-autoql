module.exports = {
  setupTestFrameworkScriptFile: '<rootDir>/test/setupTests.js',
  setupFiles: ['<rootDir>/test/globals.js'],
  verbose: false,
  transform: {
    '^.+\\.js$': 'babel-jest',
    '^.+\\.(css|scss|less)$': 'jest-css-modules',
  },
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/mocks/fileMock.js',
  },
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/mocks/media.js',
    '\\.(css|scss)$': '<rootDir>/mocks/styles.js',
  },
  globals: {
    NODE_ENV: 'test',
    React: 'React',
  },
  transform: { '^.+\\.js?$': 'babel-jest' },
  moduleFileExtensions: ['js', 'jsx'],
  moduleDirectories: ['node_modules'],
  coverageReporters: ['json-summary', 'text', 'lcov'],
}
