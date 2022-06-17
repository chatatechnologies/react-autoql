const esModules = ['uuid'].join('|')
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.js'],
  setupFiles: ['<rootDir>/test/globals.js', '<rootDir>/mocks/client.js'],
  verbose: false,
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/mocks/fileMock.js',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/mocks/media.js',
    '\\.(css|scss)$': '<rootDir>/mocks/styles.js',
  },
  testEnvironment: 'jsdom',
  globals: {
    NODE_ENV: 'test',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleDirectories: ['node_modules', 'example/node_modules', 'src'],
  coverageReporters: ['json-summary', 'text', 'lcov'],
  transformIgnorePatterns: ['/node_modules/(?!uuid)/'],
}
