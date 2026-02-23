import Enzyme from 'enzyme'
import EnzymeAdapter from 'enzyme-adapter-react-16'
// Per-test Tabulator mocks are preferred; do not install a global mock here.
import { configure } from '@testing-library/react'

// If a test needs a Tabulator mock, call `jest.mock('tabulator-tables', () => require('<path-to-factory>')())` in that test.

Enzyme.configure({ adapter: new EnzymeAdapter() })

configure({ testIdAttribute: 'data-test' })

// jsdom doesn't implement some SVG/CSS browser APIs used by our chart tests.
// Provide small shims to avoid runtime errors (getBBox, CSS.supports) during tests.
// NOTE: We previously installed a global getBBox shim here. Tests now opt-in
// to the getBBox mock by importing `test/utils/getBBoxShim.js` so we can avoid
// a global, test-only mutation of DOM APIs.

if (typeof global.CSS === 'undefined') {
  // Some third-party libs call CSS.supports; provide a safe fallback.
  global.CSS = { supports: () => false }
}

// JSDOM doesn't implement SVG's getComputedTextLength which some D3 helpers call.
// Provide a small, conservative polyfill that attempts to use getBBox() when
// available, and otherwise estimates length from character count and font size.
try {
  if (typeof SVGElement !== 'undefined' && !SVGElement.prototype.getComputedTextLength) {
    /* eslint-disable no-extend-native */
    SVGElement.prototype.getComputedTextLength = function () {
      try {
        // Prefer getBBox if the test has set up a mocked implementation.
        if (typeof this.getBBox === 'function') {
          const bbox = this.getBBox()
          if (bbox && typeof bbox.width === 'number' && bbox.width > 0) return bbox.width
        }
      } catch (e) {
        // ignore and fall back to estimation
      }

      const text = this.textContent || ''
      // Attempt to derive font-size from style, default to 12px
      let fontSize = 12
      try {
        const fs = (this.style && this.style.fontSize) || ''
        const m = fs.match(/(\d+(?:\.\d+)?)/)
        if (m) fontSize = parseFloat(m[1])
      } catch (e) {
        /* ignore */
      }

      // Estimate width: average char width ~0.6 * fontSize
      return text.length * fontSize * 0.6
    }
    /* eslint-enable no-extend-native */
  }
} catch (e) {
  // In non-browser/test environments, SVGElement may be undefined; ignore.
}

// Provide a basic getBBox shim when missing. Some test environments (older
// jsdom) don't implement getBBox on all SVG nodes, and some D3 helpers call
// getBBox directly on elements. The shim is conservative: if getComputedTextLength
// is present we use it; otherwise we estimate from text length and font size.
try {
  if (typeof SVGElement !== 'undefined' && !SVGElement.prototype.getBBox) {
    /* eslint-disable no-extend-native */
    SVGElement.prototype.getBBox = function () {
      try {
        if (typeof this.getComputedTextLength === 'function') {
          const w = this.getComputedTextLength()
          return { x: 0, y: 0, width: w, height: w ? Math.max(10, w * 0.2) : 10 }
        }
      } catch (e) {
        // fall through to estimation
      }

      const text = this.textContent || ''
      let fontSize = 12
      try {
        const fs = (this.style && this.style.fontSize) || ''
        const m = fs.match(/(\d+(?:\.\d+)?)/)
        if (m) fontSize = parseFloat(m[1])
      } catch (e) {
        /* ignore */
      }

      const width = Math.max(1, text.length * fontSize * 0.6)
      const height = Math.max(8, fontSize)
      return { x: 0, y: 0, width, height }
    }
    /* eslint-enable no-extend-native */
  }
} catch (e) {
  // ignore
}

// Prevent tests from making real network requests via axios and avoid noisy
// unauthenticated console errors during mounts. Tests can override this
// mock per-file when network behavior is required.
try {
  // Jest's runtime exposes `jest` here; guard in case this file is loaded elsewhere.
  if (typeof jest !== 'undefined') {
    jest.mock('axios', () => {
      const mock = {
        create: () => mock,
        get: jest.fn(() => Promise.resolve({ data: {} })),
        post: jest.fn(() => Promise.resolve({ data: {} })),
        put: jest.fn(() => Promise.resolve({ data: {} })),
        delete: jest.fn(() => Promise.resolve({ data: {} })),
        // Provide a minimal CancelToken.source mock so tests that expect
        // `axios.CancelToken.source()` produce an object with a `token`.
        CancelToken: {
          source: () => ({ token: {}, cancel: () => {} }),
        },
      }
      return mock
    })
  }
} catch (e) {
  // ignore in non-jest environments
}

// Some tests import `{ TabulatorFull }` from 'tabulator-tables'. Provide a
// lightweight global mock that maps `TabulatorFull` and default export to
// our test Tabulator implementation in `/mocks/Tabulator.js`.
try {
  if (typeof jest !== 'undefined') {
    jest.mock('tabulator-tables', () => {
      const mockTabulator = require('../mocks/Tabulator').default
      return {
        TabulatorFull: mockTabulator,
        Tabulator: mockTabulator,
        // Some code imports TabulatorFull as a named export; provide it.
        __esModule: true,
        default: mockTabulator,
      }
    })
  }
} catch (e) {
  // ignore when running outside jest
}
