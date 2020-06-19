import Enzyme, { shallow } from 'enzyme'
import EnzymeAdapter from 'enzyme-adapter-react-16'

Enzyme.configure({ adapter: new EnzymeAdapter() })

// jest.mock('../src/js/api/retry', () => new Promise(resolve => resolve({
//   exponentialBackoffRetry: () => Promise.resolve(),
// })));

// jest.mock('../src/js/api/request', () => new Promise(resolve => resolve({
//   exponentialBackoffRetry: () => Promise.resolve(),
// })));

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
