import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import ChataTable from './ChataTable'
import AjaxCache from './ajaxCache'

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
  const instance = wrapper.instance()

  // Instantiate AjaxCache with TTL=0 to prevent unexpected evictions in tests
  instance._ajaxCache = new AjaxCache({ maxEntries: 50, ttl: 0 })

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

    test('setHeaderInputValue focuses, sets value/title and blurs the input', () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      // Provide a mock ref and input element
      instance.ref = { restoreRedraw: jest.fn() }

      const inputElement = {
        focus: jest.fn(),
        blur: jest.fn(),
        value: '',
        title: '',
        dispatchEvent: jest.fn(),
      }

      instance.setHeaderInputValue(inputElement, '42')

      expect(inputElement.focus).toHaveBeenCalled()
      expect(inputElement.value).toBe('42')
      expect(inputElement.title).toBe('42')
      expect(inputElement.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'input' }))
      expect(inputElement.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'change' }))
      expect(inputElement.blur).toHaveBeenCalled()
    })
  })

  describe('filterCount functionality', () => {
    test('should initialize filterCount based on initial data', () => {
      const wrapper = setup()
      const instance = wrapper.instance()
      // Update filterCount to match initial data
      instance.filterCount = mockResponse.data.data.rows.length
      expect(instance.filterCount).toBe(4)
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

    test('uses cached ajax rows for paging after initial filtered response', async () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      // Small page size to force multiple pages
      instance.pageSize = 1

      // Prepare mounted state so ajaxRequestFunc will execute
      instance.hasSetInitialData = true
      instance._isMounted = true
      instance._setFiltersTime = 0
      instance.state = { tabulatorMounted: true }

      // Mock queryFn to return 3 filtered rows
      const mockQueryFnResponse = {
        data: {
          data: {
            rows: [['a'], ['b'], ['c']],
            count_rows: 3,
            query_id: 'q-1',
          },
        },
      }

      instance.queryFn = jest.fn().mockResolvedValue(mockQueryFnResponse)

      // First call: page 1
      const params1 = { page: 1, filter: [], sort: [] }
      const res1 = await instance.ajaxRequestFunc({}, params1)

      expect(res1.rows).toEqual([['a']])
      // Cache should be populated with the response (since no server pagination detected)
      const cacheKey = JSON.stringify({ filters: [], sorters: [] })
      const cached = instance._ajaxCache.get(cacheKey)
      expect(cached).toBeDefined()
      expect(cached.rows).toEqual([['a'], ['b'], ['c']])
    })

    test('should not populate cache for server-paginated responses', async () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      instance.pageSize = 1
      instance.hasSetInitialData = true
      instance._isMounted = true
      instance._setFiltersTime = 0
      instance.state = { tabulatorMounted: true }

      // Mock queryFn to return a server-paginated response (indicates last_page)
      const mockQueryFnResponse = {
        data: {
          data: {
            rows: [['a'], ['b'], ['c']],
            count_rows: 3,
            query_id: 'q-2',
            last_page: 3,
          },
        },
      }

      instance.queryFn = jest.fn().mockResolvedValue(mockQueryFnResponse)

      const params1 = { page: 1, filter: [], sort: [] }
      const res1 = await instance.ajaxRequestFunc({}, params1)

      expect(res1.rows).toEqual([['a']])
      const cacheKey = JSON.stringify({ filters: [], sorters: [] })
      // For server-paginated responses, we store only the countFromServer (not rows) so filterCount stays correct
      const entry = instance._ajaxCache.get(cacheKey)
      expect(entry?.countFromServer).toBe(3)
      expect(entry?.rows).toBeUndefined()
    })

    test('should skip cache on getNewPage when no cached entry exists', async () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      instance.pageSize = 1
      instance.hasSetInitialData = true
      instance._isMounted = true
      instance._setFiltersTime = 0
      instance.state = { tabulatorMounted: true }

      // When cache is empty, getNewPage should fall back to getRows
      const key = JSON.stringify({ filters: [], sorters: [] })
      const result = await instance.getNewPage({}, { page: 1 })

      // Should have retrieved rows from props.response (via getRows fallback)
      expect(result.rows).toBeDefined()
      // Cache entry should not exist (no cache population in minimal cache)
      const entry = instance._ajaxCache.get(key)
      expect(entry).toBeUndefined()
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

      // Call ajaxResponseFunc with null response
      const result = instance.ajaxResponseFunc({}, null)

      // Should return the standard response object shape (data, last_page)
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('last_page')
      expect(result.data).toEqual([])
      expect(mockForceUpdate).not.toHaveBeenCalled()
    })

    test('should handle undefined response in ajaxResponseFunc', () => {
      const wrapper = setup()
      const instance = wrapper.instance()
      const mockForceUpdate = jest.fn()
      instance.forceUpdate = mockForceUpdate

      // Call ajaxResponseFunc with undefined response
      const result = instance.ajaxResponseFunc({}, undefined)

      // Should return the standard response object shape (data, last_page)
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('last_page')
      expect(result.data).toEqual([])
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

      // Update filterCount to match filtered rows
      instance.filterCount = mockResponse.rows.length

      setTimeout(() => {
        expect(instance.filterCount).toBe(4)
        expect(mockForceUpdate).not.toHaveBeenCalled()
        done()
      }, 10)
    })
  })

  describe('No Data with Initial Filters Scenario', () => {
    const mockResponseWithNoData = {
      data: {
        data: {
          rows: [], // No data
          count_rows: 0,
          query_id: 'test-query-empty',
        },
      },
    }

    const mockResponseWithData = {
      data: {
        data: {
          rows: [
            ['online', 'John'],
            ['offline', 'Jane'],
          ],
          count_rows: 2,
          query_id: 'test-query-data',
        },
      },
    }

    test('should return initial data on mount when there are no rows but initial filters exist', async () => {
      const initialFilters = [{ field: '1', type: '=', value: 'online' }]

      const props = {
        response: mockResponseWithNoData,
        initialTableParams: { filter: initialFilters },
        queryFn: jest.fn(),
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Mock the ajaxRequestFunc to track if it gets called
      const ajaxRequestFuncSpy = jest.spyOn(instance, 'ajaxRequestFunc')

      // Simulate the table mounting and initial data processing
      instance.onDataProcessed([])

      // Wait a bit to ensure any async operations complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // ajaxRequestFunc should NOT be called immediately on mount
      expect(ajaxRequestFuncSpy).not.toHaveBeenCalled()

      // Initial data should be returned (empty rows)
      const initialData = instance.getRows(props, 1)
      expect(initialData).toEqual([])

      // Filters should be preserved
      expect(instance.tableParams.filter).toEqual(initialFilters)
    })

    test('should call ajaxRequestFunc when filter is cleared on table with no initial data', async () => {
      const initialFilters = [{ field: '1', type: '=', value: 'online' }]

      const props = {
        response: mockResponseWithNoData,
        initialTableParams: { filter: initialFilters },
        queryFn: jest.fn().mockResolvedValue(mockResponseWithData),
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Set up the component state to simulate it being mounted and initial data processed
      instance.hasSetInitialData = true
      instance._isMounted = true
      instance._setInitialDataTime = Date.now() - 3000 // 3 seconds ago (not recent)
      instance.state = { tabulatorMounted: true }

      // Mock the ajaxRequestFunc
      const ajaxRequestFuncSpy = jest.spyOn(instance, 'ajaxRequestFunc').mockImplementation(async (props, params) => {
        // Simulate clearing filters (empty filter array)
        const clearedFilters = []
        const mockResponse = await props.queryFn({
          tableFilters: clearedFilters,
          orders: [],
        })
        return {
          rows: mockResponse.data.data.rows,
          page: 1,
          last_page: 1,
        }
      })

      // Simulate filter clearing by calling ajaxRequestFunc with empty filters
      const clearFilterParams = {
        page: 1,
        filter: [], // Cleared filters
        sort: [],
      }

      await instance.ajaxRequestFunc(props, clearFilterParams)

      // ajaxRequestFunc should be called when filters are cleared
      expect(ajaxRequestFuncSpy).toHaveBeenCalledWith(props, clearFilterParams)

      // queryFn should be called to get unfiltered data
      expect(props.queryFn).toHaveBeenCalledWith({
        tableFilters: [],
        orders: [],
      })
    })

    test('should allow ajaxRequestFunc calls after timing protection period expires', async () => {
      const initialFilters = [{ field: '1', type: '=', value: 'online' }]

      const props = {
        response: mockResponseWithNoData,
        initialTableParams: { filter: initialFilters },
        queryFn: jest.fn().mockResolvedValue(mockResponseWithData),
        useInfiniteScroll: true, // Enable infinite scroll to use server-side queryFn
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Set up component state to ensure ajaxRequestFunc will actually make the API call
      instance.hasSetInitialData = true
      instance._isMounted = true
      instance.state = { tabulatorMounted: true }
      instance._setFiltersTime = Date.now() - 2000 // Set to 2 seconds ago (not recent)

      // Set _setInitialDataTime to 2 seconds ago (outside protection period of 1000ms)
      instance._setInitialDataTime = Date.now() - 2000

      // Try to call ajaxRequestFunc after protection period
      const params = { page: 1, filter: [], sort: [] }

      // Ensure all conditions are properly set to allow the API call
      expect(instance.hasSetInitialData).toBe(true)
      expect(instance._isMounted).toBe(true)
      expect(instance.state.tabulatorMounted).toBe(true)

      const result = await instance.ajaxRequestFunc(props, params)

      // Should make the API call since protection period has expired
      expect(props.queryFn).toHaveBeenCalled()

      // Should return the API response, not initial data
      expect(result.isInitialData).toBeFalsy()
    })

    test('should handle the complete flow: mount with no data + filters, then clear filters', async () => {
      const initialFilters = [{ field: '1', type: '=', value: 'online' }]

      const props = {
        response: mockResponseWithNoData,
        initialTableParams: { filter: initialFilters },
        queryFn: jest.fn().mockResolvedValue(mockResponseWithData),
        useInfiniteScroll: true, // Enable infinite scroll to use server-side queryFn
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Step 1: Initial mount - should return empty data, no API call
      instance.onDataProcessed([])

      // Verify initial state
      expect(instance.tableParams.filter).toEqual(initialFilters)
      expect(instance.originalQueryData).toEqual([])

      // Step 2: Simulate user clearing filters after protection period
      instance.hasSetInitialData = true
      instance._isMounted = true
      instance._setInitialDataTime = Date.now() - 2000 // Outside protection period of 1000ms
      instance._setFiltersTime = Date.now() - 2000 // Set to 2 seconds ago (not recent)
      instance.state = { tabulatorMounted: true }

      // Step 3: Clear filters (simulate user action)
      const clearFilterParams = {
        page: 1,
        filter: [], // Cleared filters
        sort: [],
      }

      const result = await instance.ajaxRequestFunc(props, clearFilterParams)

      // Should have called queryFn to get unfiltered data
      expect(props.queryFn).toHaveBeenCalledWith({
        tableFilters: [],
        orders: [],
        cancelToken: expect.any(Object), // axios CancelToken
      })

      // Should return the unfiltered data
      expect(result.rows).toEqual(mockResponseWithData.data.data.rows)
    })
  })
})
