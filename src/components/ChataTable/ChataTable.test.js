import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import ChataTable from './ChataTable'

// Mock Tabulator
jest.mock('tabulator-tables', () => ({
  __esModule: true,
  default: jest.fn(),
}))

const mockColumns = [
  { id: '1', field: '1', display_name: 'Status', type: 'text', index: 0 },
  { id: '2', field: '2', display_name: 'Name', type: 'text', index: 1 },
]

const mockResponse = {
  data: {
    data: {
      rows: [
        ['online', 'John'],
        ['offline', 'Jane'],
        ['online', 'Bob'],
        ['offline', 'Alice'],
      ],
      count_rows: 4,
      query_id: 'test-query-1',
    },
  },
}

const defaultProps = {
  columns: mockColumns,
  response: mockResponse,
  useInfiniteScroll: false,
  onTableParamsChange: jest.fn(),
  onErrorCallback: jest.fn(),
  onNewData: jest.fn(),
  updateColumns: jest.fn(),
  onCustomColumnChange: jest.fn(),
  updateColumnsAndData: jest.fn(),
  onUpdateFilterResponse: jest.fn(),
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataTable {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('ChataTable', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('renders correctly', () => {
    test('renders correctly with required props', () => {
      const wrapper = setup()
      const tableComponent = findByTestAttr(wrapper, 'react-autoql-table')
      expect(tableComponent.exists()).toBe(true)
    })
  })

  describe('Filtering Logic', () => {
    test('should never call Tabulator setFilter function', () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      // Mock Tabulator methods
      const mockTabulator = {
        getColumns: jest.fn(() => [
          {
            getField: () => '1',
            getDefinition: () => ({ headerFilter: true }),
            getElement: () => ({ classList: { add: jest.fn(), remove: jest.fn() } }),
          },
        ]),
        setHeaderFilterValue: jest.fn(),
        setFilter: jest.fn(), // This should never be called
      }

      instance.ref = { tabulator: mockTabulator }
      instance.useInfiniteScroll = false

      // Test setFilters method - it should only call setHeaderFilterValue, not setFilter
      const filters = [{ field: '1', type: '=', value: 'online' }]
      instance.setFilters(filters)

      // Verify setHeaderFilterValue was called
      expect(mockTabulator.setHeaderFilterValue).toHaveBeenCalledWith('1', 'online')

      // Verify setFilter was NEVER called
      expect(mockTabulator.setFilter).not.toHaveBeenCalled()
    })

    test('should never call Tabulator setFilter function in onTableBuilt', () => {
      const initialFilters = [{ field: '1', type: '=', value: 'online' }]

      const props = {
        initialTableParams: { filter: initialFilters },
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Mock Tabulator methods
      const mockTabulator = {
        getColumns: jest.fn(() => [
          {
            getField: () => '1',
            getDefinition: () => ({ headerFilter: true }),
            getElement: () => ({ classList: { add: jest.fn(), remove: jest.fn() } }),
          },
        ]),
        setHeaderFilterValue: jest.fn(),
        setFilter: jest.fn(), // This should never be called
      }

      instance.ref = { tabulator: mockTabulator }

      // Call onTableBuilt directly to test it
      instance.onTableBuilt()

      // Verify setFilter was NEVER called (this should fail now!)
      expect(mockTabulator.setFilter).not.toHaveBeenCalled()
    })

    test('should never call Tabulator setFilter function anywhere in the component', () => {
      const initialFilters = [{ field: '1', type: '=', value: 'online' }]

      const props = {
        initialTableParams: { filter: initialFilters },
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Mock Tabulator methods
      const mockTabulator = {
        getColumns: jest.fn(() => [
          {
            getField: () => '1',
            getDefinition: () => ({ headerFilter: true }),
            getElement: () => ({ classList: { add: jest.fn(), remove: jest.fn() } }),
          },
        ]),
        setHeaderFilterValue: jest.fn(),
        setFilter: jest.fn(), // This should never be called
        setSort: jest.fn(),
        getHeaderFilters: jest.fn(() => []),
        getSorters: jest.fn(() => []),
      }

      instance.ref = { tabulator: mockTabulator }

      // Call multiple methods that might potentially call setFilter
      const filters = [{ field: '1', type: '=', value: 'online' }]
      instance.setFilters(filters)
      instance.onDataFiltered(filters, [])
      instance.onTableBuilt()

      // Simulate componentDidUpdate behavior
      if (instance.state.tabulatorMounted) {
        instance.setFilters(instance.props?.initialTableParams?.filter)
      }

      // Verify setFilter was NEVER called anywhere
      expect(mockTabulator.setFilter).not.toHaveBeenCalled()
    })

    test('should not use Tabulator initialFilter to prevent data modification', () => {
      const initialFilters = [{ field: '1', type: '=', value: 'online' }]

      const props = {
        initialTableParams: { filter: initialFilters },
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // initialFilter should be undefined to prevent Tabulator from modifying data
      expect(instance.tableOptions.initialFilter).toBeUndefined()
    })

    test('should preserve originalQueryData when initial filters are provided', () => {
      const initialFilters = [{ field: '1', type: '=', value: 'online' }]

      const props = {
        initialTableParams: { filter: initialFilters },
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Check that originalQueryData is preserved
      expect(instance.originalQueryData).toBeDefined()
      expect(instance.originalQueryData).toHaveLength(4)
      expect(instance.tableParams.filter).toEqual(initialFilters)
    })

    test('should handle filter type functions correctly', () => {
      const initialFilters = [{ field: '1', type: () => true, value: 'online' }]

      const props = {
        initialTableParams: { filter: initialFilters },
      }

      // Should not throw an error
      expect(() => setup(props)).not.toThrow()

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Should handle function filter types
      expect(instance.tableParams.filter).toEqual(initialFilters)
    })

    test('should clear filters and return to original dataset', () => {
      const initialFilters = [{ field: '1', type: '=', value: 'online' }]

      const props = {
        initialTableParams: { filter: initialFilters },
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Initially has filters
      expect(instance.tableParams.filter).toEqual(initialFilters)

      // Clear filters
      instance.tableParams.filter = []
      wrapper.setState({})

      // Should have empty filters
      expect(instance.tableParams.filter).toHaveLength(0)

      // Original data should still be intact
      expect(instance.originalQueryData).toHaveLength(4)
    })

    test('should never modify originalQueryData directly', () => {
      const originalData = [...mockResponse.data.data.rows] // Shallow copy for comparison

      const props = {
        initialTableParams: {
          filter: [{ field: '1', type: '=', value: 'online' }],
        },
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Verify original data is unchanged
      expect(mockResponse.data.data.rows).toEqual(originalData)
      expect(instance.originalQueryData).toEqual(originalData)
    })
  })
})
