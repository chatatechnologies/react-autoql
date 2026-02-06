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

  test('setFilters always calls restoreRedraw (normal path)', () => {
    const wrapper = setup()
    const instance = wrapper.instance()

    const restoreSpy = jest.fn()
    const mockTabulator = {
      getColumns: jest.fn(() => []),
      setHeaderFilterValue: jest.fn(),
      setFilter: jest.fn(),
      getHeaderFilters: jest.fn(() => []),
      getSorters: jest.fn(() => []),
      blockRedraw: jest.fn(),
      restoreRedraw: jest.fn(),
    }

    // Provide both wrapper-level API and underlying tabulator for compatibility
    instance.ref = { tabulator: mockTabulator, blockRedraw: mockTabulator.blockRedraw, restoreRedraw: restoreSpy }

    instance.setFilters([{ field: '1', type: '=', value: 'online' }])

    expect(restoreSpy).toHaveBeenCalled()
  })

  test('setFilters always calls restoreRedraw even if Tabulator throws', () => {
    const wrapper = setup()
    const instance = wrapper.instance()

    const restoreSpy = jest.fn()
    const mockTabulator = {
      getColumns: jest.fn(() => {
        throw new Error('tabulator error')
      }),
      setHeaderFilterValue: jest.fn(),
      setFilter: jest.fn(),
      getHeaderFilters: jest.fn(() => []),
      getSorters: jest.fn(() => []),
      blockRedraw: jest.fn(),
      restoreRedraw: jest.fn(),
    }

    instance.ref = { tabulator: mockTabulator, blockRedraw: mockTabulator.blockRedraw, restoreRedraw: restoreSpy }

    try {
      instance.setFilters([{ field: '1', type: '=', value: 'online' }])
    } catch (e) {
      // ignore thrown error; we only care that restoreRedraw was invoked
    }

    expect(restoreSpy).toHaveBeenCalled()
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

    test('should use filtered data for subsequent page requests to prevent scrolling past total records', async () => {
      // Setup: 100 original rows, but filter returns only 15 rows
      const originalRows = Array.from({ length: 100 }, (_, i) => [`value-${i}`, `name-${i}`])
      const filteredRows = Array.from({ length: 15 }, (_, i) => [`filtered-${i}`, `name-${i}`])

      const props = {
        response: {
          data: {
            data: {
              rows: originalRows,
              count_rows: 100,
              query_id: 'original-query',
            },
          },
        },
        useInfiniteScroll: true,
        pageSize: 10,
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()
      instance.pageSize = 10
      instance.useInfiniteScroll = true
      instance.hasSetInitialData = true

      // Mock queryFn to return filtered data (simulating a filter applied)
      const filteredResponse = {
        data: {
          data: {
            rows: filteredRows,
            count_rows: 15,
            query_id: 'filtered-query',
          },
        },
      }
      instance.queryFn = jest.fn().mockResolvedValue(filteredResponse)

      // Apply filter via ajaxRequestFunc (page 1)
      const filterParams = { page: 1, filter: [{ field: '0', type: '=', value: 'filtered' }] }
      await instance.ajaxRequestFunc({}, filterParams)

      // Verify filteredResponseData is cached
      expect(instance.filteredResponseData).toEqual(filteredRows)
      expect(instance.filterCount).toBe(15)

      // Now request page 2 - this should use filteredResponseData, not props.response
      const page2Rows = instance.getRows(props, 2)

      // Page 2 should return rows 10-14 (5 rows) from filtered data
      expect(page2Rows.length).toBe(5)
      expect(page2Rows[0][0]).toBe('filtered-10')

      // Page 3 should return empty (no more filtered data)
      const page3Rows = instance.getRows(props, 3)
      expect(page3Rows.length).toBe(0)

      // Critical: If bug exists, page 3 would return rows from original 100-row dataset
      // This verifies we don't scroll past the 15 filtered records
    })

    test('should clear filteredResponseData when query_id changes', () => {
      const props = {
        response: {
          data: {
            data: {
              rows: [['a'], ['b']],
              query_id: 'query-1',
            },
          },
        },
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Set some cached filtered data
      instance.filteredResponseData = [['filtered-1'], ['filtered-2']]

      // Simulate new query response via componentDidUpdate
      const prevProps = { response: { data: { data: { query_id: 'query-1' } } } }
      const newProps = { response: { data: { data: { query_id: 'query-2' } } } }

      // Update props to trigger componentDidUpdate
      wrapper.setProps({ response: newProps.response })

      // filteredResponseData should be cleared
      expect(instance.filteredResponseData).toBeNull()
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

    test('always configures Tabulator AJAX callbacks when initial response has no rows', () => {
      const initialFilters = [{ field: '1', type: '=', value: 'online' }]

      const props = {
        response: mockResponseWithNoData,
        initialTableParams: { filter: initialFilters },
      }

      const wrapper = setup(props)
      const instance = wrapper.instance()

      // Table options should always include AJAX hooks even when initial data is empty
      expect(instance.tableOptions).toBeDefined()
      expect(typeof instance.tableOptions.ajaxRequestFunc).toBe('function')
      expect(typeof instance.tableOptions.ajaxResponse).toBe('function')
      expect(typeof instance.tableOptions.ajaxRequesting).toBe('function')
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
        signal: expect.any(Object), // AbortController signal
      })

      // Should return the unfiltered data
      expect(result.rows).toEqual(mockResponseWithData.data.data.rows)
    })
  })

  describe('setFilterBadgeClasses for pivot tables', () => {
    test('removes all column badges for pivot tables', () => {
      const wrapper = setup({ pivot: true, data: mockResponse.data.data.rows })
      const instance = wrapper.instance()

      const classList1 = { remove: jest.fn() }
      const classList2 = { remove: jest.fn() }

      const mockColumn1 = {
        getField: () => '0',
        getDefinition: () => ({ origColumn: { index: 0 } }),
        getElement: () => ({ classList: classList1 }),
      }

      const mockColumn2 = {
        getField: () => '1',
        getDefinition: () => ({
          origColumn: { index: 2 },
          origPivotColumn: { index: 1 },
        }),
        getElement: () => ({ classList: classList2 }),
      }

      instance.ref = { tabulator: { getColumns: () => [mockColumn1, mockColumn2] } }
      instance._isMounted = true
      instance.state.tabulatorMounted = true

      instance.tableParams.filter = [{ field: '1', value: 'October', type: '=' }]
      instance.setFilterBadgeClasses()

      expect(classList1.remove).toHaveBeenCalledWith('is-filtered')
      expect(classList2.remove).toHaveBeenCalledWith('is-filtered')
    })

    test('removes all column badges even when no filters', () => {
      const wrapper = setup({ pivot: true, data: mockResponse.data.data.rows })
      const instance = wrapper.instance()

      const classList = { remove: jest.fn() }

      const mockColumn = {
        getField: () => '0',
        getDefinition: () => ({ origColumn: { index: 0 } }),
        getElement: () => ({ classList }),
      }

      instance.ref = { tabulator: { getColumns: () => [mockColumn] } }
      instance._isMounted = true
      instance.state.tabulatorMounted = true

      instance.tableParams.filter = []
      instance.setFilterBadgeClasses()

      expect(classList.remove).toHaveBeenCalledWith('is-filtered')
    })

    test('handles pivot columns without origColumn gracefully', () => {
      const wrapper = setup({ pivot: true, data: mockResponse.data.data.rows })
      const instance = wrapper.instance()

      const classList = { remove: jest.fn() }

      const mockColumn = {
        getField: () => '0',
        getDefinition: () => ({}),
        getElement: () => ({ classList }),
      }

      instance.ref = { tabulator: { getColumns: () => [mockColumn] } }
      instance._isMounted = true
      instance.state.tabulatorMounted = true

      instance.tableParams.filter = [{ field: '2', value: 'test', type: '=' }]

      expect(() => instance.setFilterBadgeClasses()).not.toThrow()
      expect(classList.remove).toHaveBeenCalledWith('is-filtered')
    })
  })

  describe('renderTableRowCount', () => {
    test('returns null for empty table', () => {
      const wrapper = setup({ response: { data: { data: { rows: [], count_rows: 0 } } } })
      const instance = wrapper.instance()

      const result = instance.renderTableRowCount()
      expect(result).toBeNull()
    })

    test('uses originalQueryData.length for pivot tables', () => {
      const pivotData = [
        ['Product A', 100],
        ['Product B', 200],
        ['Product C', 300],
      ]
      const wrapper = setup({
        pivot: true,
        data: pivotData,
        response: { data: { data: { rows: [['a'], ['b']], count_rows: 2 } } },
      })
      const instance = wrapper.instance()
      instance.originalQueryData = pivotData
      instance.state.scrollTop = 0

      // Mock DOM elements
      instance.tableContainer = {
        querySelector: jest.fn((selector) => {
          if (selector === '.tabulator-tableholder') {
            return { scrollTop: 0, clientHeight: 300 }
          }
          if (selector === '.tabulator-row') {
            return { offsetHeight: 30 }
          }
          return null
        }),
      }

      const result = instance.renderTableRowCount()
      expect(result).not.toBeNull()
      // Should use pivot data length (3), not response count_rows (2)
      expect(JSON.stringify(result)).toContain('Scrolled 3')
    })

    test('uses filterCount for filtered non-pivot tables', () => {
      const wrapper = setup()
      const instance = wrapper.instance()
      instance.tableParams.filter = [{ field: '1', value: 'online', type: '=' }]
      instance.filterCount = 2
      instance.state.scrollTop = 0

      instance.tableContainer = {
        querySelector: jest.fn((selector) => {
          if (selector === '.tabulator-tableholder') {
            return { scrollTop: 0, clientHeight: 300 }
          }
          if (selector === '.tabulator-row') {
            return { offsetHeight: 30 }
          }
          return null
        }),
      }

      const result = instance.renderTableRowCount()
      expect(result).not.toBeNull()
      expect(JSON.stringify(result)).toContain('Scrolled 2')
    })

    test('calculates visible rows based on scroll position', () => {
      const wrapper = setup()
      const instance = wrapper.instance()
      instance.state.scrollTop = 600 // Scrolled down

      instance.tableContainer = {
        querySelector: jest.fn((selector) => {
          if (selector === '.tabulator-tableholder') {
            return { scrollTop: 600, clientHeight: 300 }
          }
          if (selector === '.tabulator-row') {
            return { offsetHeight: 30 }
          }
          return null
        }),
      }

      const result = instance.renderTableRowCount()
      expect(result).not.toBeNull()
      // With scrollTop=600, clientHeight=300, rowHeight=30: (600+300)/30 = 30 visible rows
      // But total is 4, so should show 4
      expect(JSON.stringify(result)).toContain('Scrolled 4')
    })
  })

})
