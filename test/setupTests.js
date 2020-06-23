import Enzyme from 'enzyme'
import EnzymeAdapter from 'enzyme-adapter-react-16'

Enzyme.configure({ adapter: new EnzymeAdapter() })

// Mock query service fns
// jest.mock(
//   '../src/js/queryService',
//   () =>
//     new Promise(resolve =>
//       resolve({
//         runSafetyNet: () => Promise.resolve(),
//         runQueryOnly: () => Promise.resolve(),
//       })
//     )
// )
