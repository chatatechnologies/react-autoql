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
        blockRedraw: jest.fn(),
        restoreRedraw: jest.fn(),
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
        blockRedraw: jest.fn(),
        restoreRedraw: jest.fn(),
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

  describe('filterCount functionality', () => {
    test('should initialize filterCount based on initial data', () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      // When useInfiniteScroll is false, getRows calls clientSortAndFilterData which sets filterCount
      expect(instance.filterCount).toBe(4) // Should be set to the length of initial data
    })

    test('should update filterCount from queryFn response using array length before slicing to 50 rows', async () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      // Set up conditions for ajaxRequestFunc to actually run
      instance.hasSetInitialData = true
      instance._isMounted = true
      instance._setFiltersTime = 0 // Make it not recently mounted
      instance.state = { tabulatorMounted: true }

      // Mock queryFn to return response with 100 rows (but only 50 will be sliced)
      const mockQueryFnResponse = {
        data: {
          data: {
            rows: new Array(100).fill().map((_, i) => [`row${i}`, `data${i}`]), // 100 actual rows
          },
        },
      }

      instance.queryFn = jest.fn().mockResolvedValue(mockQueryFnResponse)
      instance.useInfiniteScroll = true

      // Call ajaxRequestFunc (which calls queryFn)
      const params = { page: 1, size: 50, filter: [], sort: [] }
      await instance.ajaxRequestFunc({}, params)

      // Should set filterCount to the full array length (100), not the sliced count (50)
      expect(instance.filterCount).toBe(100)
      expect(instance.queryFn).toHaveBeenCalled()
    })

    test('should not reset filterCount in onDataFiltered (user removed this logic)', () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      // Set initial filter count
      instance.filterCount = 5

      // Call onDataFiltered with no filters (cleared)
      instance.onDataFiltered([], [])

      // Should NOT reset filterCount (user removed this logic)
      expect(instance.filterCount).toBe(5)
    })

    test('should not reset filterCount when filters are applied in onDataFiltered', () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      // Set initial filter count
      instance.filterCount = 3

      // Call onDataFiltered with active filters
      const activeFilters = [{ field: '1', type: '=', value: 'online' }]
      instance.onDataFiltered(activeFilters, [])

      // Should not reset filterCount
      expect(instance.filterCount).toBe(3)
    })

    test('should update filterCount in ajaxRequestFunc for infinite scroll tables', () => {
      const props = {
        useInfiniteScroll: true,
      }
      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Mock response wrapper with filtered data
      const mockResponseWrapper = {
        data: {
          data: {
            rows: [
              ['online', 'John'],
              ['online', 'Bob'],
              ['online', 'Alice'],
            ],
          },
        },
      }

      // Mock the queryFn to return our mock response
      instance.queryFn = jest.fn().mockResolvedValue(mockResponseWrapper)

      // Mock hasSetInitialData to be true so ajaxRequestFunc processes the request
      instance.hasSetInitialData = true

      // Call ajaxRequestFunc
      const params = { page: 1, filter: [{ field: '1', type: '=', value: 'online' }] }

      // We need to mock the async behavior
      return instance.ajaxRequestFunc({}, params).then(() => {
        // Should update filterCount to the length of filtered rows (this happens in ajaxRequestFunc)
        expect(instance.filterCount).toBe(3)
      })
    })

    test('should handle empty response in ajaxResponseFunc', () => {
      const wrapper = setup()
      const instance = wrapper.instance()
      const mockForceUpdate = jest.fn()
      instance.forceUpdate = mockForceUpdate

      // Call ajaxResponseFunc with empty response
      const result = instance.ajaxResponseFunc({}, null)

      // Should return empty object and not force update
      expect(result).toEqual({})
      expect(mockForceUpdate).not.toHaveBeenCalled()
    })

    test('should handle undefined response in ajaxResponseFunc', () => {
      const wrapper = setup()
      const instance = wrapper.instance()
      const mockForceUpdate = jest.fn()
      instance.forceUpdate = mockForceUpdate

      // Call ajaxResponseFunc with undefined response
      const result = instance.ajaxResponseFunc({}, undefined)

      // Should return empty object and not force update
      expect(result).toEqual({})
      expect(mockForceUpdate).not.toHaveBeenCalled()
    })

    test('should update filterCount and trigger re-render after data processing', (done) => {
      const wrapper = setup()
      const instance = wrapper.instance()
      const mockForceUpdate = jest.fn()
      instance.forceUpdate = mockForceUpdate

      // Mock response with filtered data
      const mockResponse = {
        rows: [
          ['online', 'John'],
          ['online', 'Bob'],
          ['online', 'Alice'],
          ['online', 'Charlie'],
        ],
        last_page: 1,
      }

      // Call ajaxResponseFunc
      instance.ajaxResponseFunc({}, mockResponse)

      // Wait for setTimeout to execute
      setTimeout(() => {
        // Should update filterCount to match the number of rows
        expect(instance.filterCount).toBe(4)

        // Should force re-render to update UI
        expect(mockForceUpdate).toHaveBeenCalled()
        done()
      }, 10)
    })
  })
})
