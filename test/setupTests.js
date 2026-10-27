import Enzyme from 'enzyme'
import EnzymeAdapter from 'enzyme-adapter-react-16'
import mockTabulator from '../mocks/Tabulator'
import { configure } from '@testing-library/react'

jest.mock('tabulator-tables', () => {
  return {
    ...jest.requireActual('tabulator-tables'),
    TabulatorFull: mockTabulator,
  }
})

Enzyme.configure({ adapter: new EnzymeAdapter() })

configure({ testIdAttribute: 'data-test' })

// jsdom doesn't implement some SVG/CSS browser APIs used by our chart tests.
// Provide small shims to avoid runtime errors (getBBox, CSS.supports) during tests.
if (typeof SVGElement !== 'undefined' && !SVGElement.prototype.getBBox) {
  // minimal getBBox implementation returning zeros so layout math won't produce NaN
  SVGElement.prototype.getBBox = function () {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
}

if (typeof global.CSS === 'undefined') {
  // Some third-party libs call CSS.supports; provide a safe fallback.
  global.CSS = { supports: () => false }
}

// Provide getComputedTextLength used by d3 legend helpers in tests
if (typeof SVGElement !== 'undefined' && !SVGElement.prototype.getComputedTextLength) {
  SVGElement.prototype.getComputedTextLength = function () {
    // crude approximation: character count * average width
    const text = this.textContent || ''
    const avgCharWidth = 8
    return text.length * avgCharWidth
  }
}

// ProseMirror (the report builder's text editor) measures the selection to keep it in view; jsdom lays nothing
// out, so ranges answer with empty boxes, and no element is at any point.
if (typeof Range !== 'undefined') {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = function () {
      return { length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }
    }
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = function () {
      return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
    }
  }
}
if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => null
}

