// Small factory to provide the project's Tabulator test mock for per-test mocking
// Returns an object suitable for `jest.mock('tabulator-tables', () => ...)`
let mock
try {
  // Try to load the existing ESM-style mock from /mocks/Tabulator.js
  // require may return an object with a `default` property.
  const loaded = require('../../mocks/Tabulator')
  mock = loaded?.default ?? loaded
} catch (e) {
  // Fallback: create a minimal mock class that won't error in tests
  console.warn('Failed to load Tabulator mock:', e)
  /* eslint-disable no-unused-vars */
  class MinimalTabulator {
    setData(data) {
      return this
    }
    replaceData(data) {
      return this
    }
    redraw() {
      return this
    }
    setColumns(columns) {
      return this
    }
  }
  mock = MinimalTabulator
}

module.exports = () => ({ TabulatorFull: mock, default: mock })
