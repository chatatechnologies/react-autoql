import Enzyme from 'enzyme'
import EnzymeAdapter from 'enzyme-adapter-react-16'
import mockTabulator from '../mocks/Tabulator'

jest.mock('tabulator-tables', () => {
  return {
    ...jest.requireActual('tabulator-tables'),
    TabulatorFull: mockTabulator,
  }
})

Enzyme.configure({ adapter: new EnzymeAdapter() })
