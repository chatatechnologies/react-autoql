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

// jsdom lacks getComputedTextLength on SVG text nodes; provide a basic shim used by D3 legend helpers
// Ensure any SVG text node (tspan, text, etc.) has a getComputedTextLength function
if (typeof SVGElement !== 'undefined' && !SVGElement.prototype.getComputedTextLength) {
  SVGElement.prototype.getComputedTextLength = function () {
    // Return a basic character-length based width to make calculations predictable in tests
    return (this.textContent || '').length * 6
  }
}
