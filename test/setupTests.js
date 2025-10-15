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

// jsdom doesn't define the global CSS object used by some libraries (e.g., react-tooltip)
// Provide a minimal stub so components that check CSS.supports don't crash in tests.
if (typeof global.CSS === 'undefined') {
  global.CSS = {
    supports: () => false,
  }
}
