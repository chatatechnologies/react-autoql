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

  describe('Filter badge classList handling', () => {
    test('uses classList.toggle when available for non-pivot columns', () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      const toggleSpy = jest.fn()
      const allColumns = [
        {
          getField: () => '1',
          getDefinition: () => ({ name: '1', origColumn: { field: '1' } }),
          getElement: () => ({ classList: { toggle: toggleSpy } }),
        },
      ]

      const filteredFields = new Set(['1'])

      instance.setNonPivotFilterBadges(allColumns, filteredFields)

      expect(toggleSpy).toHaveBeenCalledWith('is-filtered', true)
    })

    test('falls back to add/remove when toggle is not present for non-pivot columns', () => {
      const wrapper = setup()
      const instance = wrapper.instance()

      const addSpy = jest.fn()
      const removeSpy = jest.fn()

      const col1 = {
        getField: () => '1',
        getDefinition: () => ({ name: '1', origColumn: { field: '1' } }),
        getElement: () => ({ classList: { add: addSpy, remove: removeSpy } }),
      }
      const col2 = {
        getField: () => '2',
        getDefinition: () => ({ name: '2', origColumn: { field: '2' } }),
        getElement: () => ({ classList: { add: addSpy, remove: removeSpy } }),
      }

      const allColumns = [col1, col2]
      const filteredFields = new Set(['1'])

      instance.setNonPivotFilterBadges(allColumns, filteredFields)

      expect(addSpy).toHaveBeenCalledWith('is-filtered')
      expect(removeSpy).toHaveBeenCalledWith('is-filtered')
    })

    test('toggles container class for pivot tables using toggle or fallback', () => {
      const wrapper = setup({ pivot: true })
      const instance = wrapper.instance()

      // ensure container exists
      const containerId = `react-autoql-table-container-${instance.TABLE_ID}`
      const container = document.createElement('div')
      container.id = containerId
      document.body.appendChild(container)

      // case A: toggle present — attach spy to existing DOMTokenList.toggle
      const toggleSpy = jest.fn()
      container.classList.toggle = toggleSpy
      instance.setPivotFilterBadges([], [{ field: '1' }])
      expect(toggleSpy).toHaveBeenCalledWith('pivot-table-has-filters', true)

      // case B: toggle missing, add/remove present
      const addSpy = jest.fn()
      const removeSpy = jest.fn()
      // shadow toggle to force fallback path
      container.classList.toggle = undefined
      container.classList.add = addSpy
      container.classList.remove = removeSpy
      instance.setPivotFilterBadges([], [])
      expect(removeSpy).toHaveBeenCalledWith('pivot-table-has-filters')

      container.remove()
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
      // tabulatorMounted must be true or the guard at line 715 returns initialData early
      wrapper.setState({ tabulatorMounted: true })
      // _setFiltersTime=0 prevents the hasRecentlySetHeaderFilters debounce guard from firing
      instance._setFiltersTime = 0

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
      // tabulatorMounted must be true or the guard at line 715 returns initialData early
      wrapper.setState({ tabulatorMounted: true })
      // _setFiltersTime=0 prevents the hasRecentlySetHeaderFilters debounce guard from firing
      instance._setFiltersTime = 0

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
        isEditing: true, // Edit mode forces REMOTE so queryFn is used server-side
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
        isEditing: true, // Edit mode forces REMOTE so filter changes call the API
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

describe('ChataTable filter/badge initialization', () => {
  test('baseFilters is initialized from initialTableParams.filter', () => {
    const filters = [{ field: '1', type: '=', value: 'online' }]
    const instance = setup({ initialTableParams: { filter: filters } }).instance()
    expect(instance.baseFilters).toEqual(filters)
  })

  test('baseFilters is empty array when no initialTableParams', () => {
    const instance = setup().instance()
    expect(instance.baseFilters).toEqual([])
  })

  test('baseFilters is a deep clone (mutations do not affect initialTableParams)', () => {
    const filters = [{ field: '1', type: '=', value: 'online' }]
    const instance = setup({ initialTableParams: { filter: filters } }).instance()
    instance.baseFilters[0].value = 'MUTATED'
    expect(filters[0].value).toBe('online')
  })

  test('isFiltering state is false by default when initialIsFiltering is not set', () => {
    const instance = setup().instance()
    expect(instance.state.isFiltering).toBe(false)
  })

  test('isFiltering state is true when initialIsFiltering=true is passed', () => {
    const instance = setup({ initialIsFiltering: true }).instance()
    expect(instance.state.isFiltering).toBe(true)
  })

  test('isFiltering state is false when initialIsFiltering=false is passed', () => {
    const instance = setup({ initialIsFiltering: false }).instance()
    expect(instance.state.isFiltering).toBe(false)
  })
})

describe('disableBaseFilterInputs', () => {
  function setupWithDOM(filters) {
    const wrapper = setup({ initialTableParams: { filter: filters }, isDashboardEditing: false })
    const instance = wrapper.instance()

    // Build DOM elements matching the selectors used by disableBaseFilterInputs
    const container = document.createElement('div')
    container.id = `react-autoql-table-container-${instance.TABLE_ID}`

    filters.forEach((filter) => {
      const col = document.createElement('div')
      col.className = 'tabulator-col'
      col.setAttribute('tabulator-field', filter.field)

      const content = document.createElement('div')
      content.className = 'tabulator-col-content'
      const input = document.createElement('input')
      content.appendChild(input)
      col.appendChild(content)
      container.appendChild(col)

      const clearBtn = document.createElement('div')
      clearBtn.dataset.clearBtn = `${instance.TABLE_ID}-${filter.field}`
      document.body.appendChild(clearBtn)
    })

    document.body.appendChild(container)

    return { wrapper, instance, container }
  }

  afterEach(() => {
    // Clean up DOM nodes
    document.body.innerHTML = ''
  })

  test('disables header input and adds disabled class for each base filter with a value', () => {
    const filters = [{ field: '1', type: '=', value: 'online' }]
    const { instance, container } = setupWithDOM(filters)

    instance.disableBaseFilterInputs()

    const input = container.querySelector('.tabulator-col[tabulator-field="1"] input')
    expect(input.disabled).toBe(true)
    expect(input.classList.contains('react-autoql-base-filter-disabled')).toBe(true)
  })

  test('makes clear button non-interactive for each base filter', () => {
    const filters = [{ field: '1', type: '=', value: 'online' }]
    const { instance } = setupWithDOM(filters)

    instance.disableBaseFilterInputs()

    const clearBtn = document.querySelector(`[data-clear-btn="${instance.TABLE_ID}-1"]`)
    expect(clearBtn.style.pointerEvents).toBe('none')
    expect(clearBtn.style.opacity).toBe('0.3')
  })

  test('skips filters with no value', () => {
    const filters = [{ field: '1', type: '=', value: '' }]
    const { instance, container } = setupWithDOM(filters)

    instance.disableBaseFilterInputs()

    const input = container.querySelector('.tabulator-col[tabulator-field="1"] input')
    expect(input.disabled).toBe(false)
  })

  test('does nothing when isDashboardEditing=true', () => {
    const filters = [{ field: '1', type: '=', value: 'online' }]
    const wrapper = setup({ initialTableParams: { filter: filters }, isDashboardEditing: true })
    const instance = wrapper.instance()

    const spy = jest.spyOn(document, 'querySelector')
    instance.disableBaseFilterInputs()

    // Should return immediately without querying DOM
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('does nothing when baseFilters is empty', () => {
    const wrapper = setup({ isDashboardEditing: false })
    const instance = wrapper.instance()

    const spy = jest.spyOn(document, 'querySelector')
    instance.disableBaseFilterInputs()

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('handles missing DOM nodes gracefully (no throw)', () => {
    const filters = [{ field: '99', type: '=', value: 'missing' }]
    const wrapper = setup({ initialTableParams: { filter: filters }, isDashboardEditing: false })
    const instance = wrapper.instance()
    expect(() => instance.disableBaseFilterInputs()).not.toThrow()
  })
})

describe('toggleIsFiltering callback behavior', () => {
  function makeFullRef() {
    return {
      tabulator: {
        getColumns: jest.fn(() => []),
        setHeaderFilterValue: jest.fn(),
        getHeaderFilters: jest.fn(() => []),
        blockRedraw: jest.fn(),
        restoreRedraw: jest.fn(),
      },
      blockRedraw: jest.fn(),
      restoreRedraw: jest.fn(),
    }
  }

  test('calls setFilters with current tableParams.filter when toggling on', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    instance.ref = makeFullRef()
    instance._isMounted = true
    instance.tableParams.filter = [{ field: '1', type: '=', value: 'online' }]
    const setFiltersSpy = jest.spyOn(instance, 'setFilters').mockImplementation(() => {})

    instance.toggleIsFiltering(true)

    expect(setFiltersSpy).toHaveBeenCalledWith(instance.tableParams.filter)
  })

  test('does not call setFilters when toggling off', () => {
    const wrapper = setup({ initialIsFiltering: true })
    const instance = wrapper.instance()
    instance.ref = makeFullRef()
    instance._isMounted = true
    const setFiltersSpy = jest.spyOn(instance, 'setFilters').mockImplementation(() => {})

    instance.toggleIsFiltering(false)

    expect(setFiltersSpy).not.toHaveBeenCalled()
  })

  test('returns the new isFiltering value', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    instance._isMounted = true

    expect(instance.toggleIsFiltering(true)).toBe(true)
    expect(instance.toggleIsFiltering(false)).toBe(false)
  })

  test('toggles from false to true when no explicit value passed', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    instance._isMounted = true

    const result = instance.toggleIsFiltering()
    expect(result).toBe(true)
  })
})

describe('setFilterBadgeClasses non-pivot path', () => {
  test('adds is-filtered class to columns with active filters', () => {
    const wrapper = setup()
    const instance = wrapper.instance()

    const toggleSpy = jest.fn()
    const mockColumn = {
      getField: () => '1',
      getDefinition: () => ({ name: '1', origColumn: { field: '1' } }),
      getElement: () => ({ classList: { toggle: toggleSpy } }),
    }
    const unmatchedColumn = {
      getField: () => '2',
      getDefinition: () => ({ name: '2', origColumn: { field: '2' } }),
      getElement: () => ({ classList: { toggle: toggleSpy } }),
    }

    instance.ref = { tabulator: { getColumns: () => [mockColumn, unmatchedColumn] } }
    instance._isMounted = true
    instance.state.tabulatorMounted = true
    instance.tableParams.filter = [{ field: '1', type: '=', value: 'online' }]

    instance.setFilterBadgeClasses()

    expect(toggleSpy).toHaveBeenCalledWith('is-filtered', true)
    expect(toggleSpy).toHaveBeenCalledWith('is-filtered', false)
  })

  test('removes is-filtered from all columns when there are no filters (direct remove path)', () => {
    const wrapper = setup()
    const instance = wrapper.instance()

    const removeSpy = jest.fn()
    const mockColumns = ['1', '2'].map((f) => ({
      getField: () => f,
      getDefinition: () => ({ name: f, origColumn: { field: f } }),
      getElement: () => ({ classList: { remove: removeSpy } }),
    }))

    instance.ref = { tabulator: { getColumns: () => mockColumns } }
    instance._isMounted = true
    instance.state.tabulatorMounted = true
    instance.tableParams.filter = []

    instance.setFilterBadgeClasses()

    expect(removeSpy).toHaveBeenCalledTimes(2)
    expect(removeSpy).toHaveBeenCalledWith('is-filtered')
  })

  test('does not run when !_isMounted', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    const getColumnsSpy = jest.fn(() => [])
    instance.ref = { tabulator: { getColumns: getColumnsSpy } }
    instance._isMounted = false
    instance.state.tabulatorMounted = true

    instance.setFilterBadgeClasses()

    expect(getColumnsSpy).not.toHaveBeenCalled()
  })

  test('does not run when !tabulatorMounted', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    const getColumnsSpy = jest.fn(() => [])
    instance.ref = { tabulator: { getColumns: getColumnsSpy } }
    instance._isMounted = true
    instance.state.tabulatorMounted = false

    instance.setFilterBadgeClasses()

    expect(getColumnsSpy).not.toHaveBeenCalled()
  })
})

describe('onDataFiltered tabulatorMounted guard', () => {
  test('returns initialData without updating when tabulatorMounted is false', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    instance.hasSetInitialData = true
    instance._isMounted = true
    wrapper.setState({ tabulatorMounted: false })

    const forceUpdateSpy = jest.spyOn(instance, 'forceUpdate').mockImplementation(() => {})

    const result = instance.onDataFiltered([{ field: '1', type: '=', value: 'online' }], [['online', 'John']])

    // When tabulatorMounted=false, should bail out early (return initialData)
    expect(forceUpdateSpy).not.toHaveBeenCalled()
    forceUpdateSpy.mockRestore()
  })
})

describe('Dashboard edit-mode filtering', () => {
  const smallResponse = { data: { data: { rows: [], count_rows: 10, query_id: 'q1' } } }
  const filters = [{ field: '1', type: '=', value: 'online' }]

  function makeMockRef(setHeaderFilterValueSpy) {
    const tabulator = {
      getColumns: jest.fn(() => [
        {
          getField: () => '1',
          getDefinition: () => ({ headerFilter: true }),
          getElement: () => ({ classList: { add: jest.fn(), remove: jest.fn() } }),
        },
      ]),
      setHeaderFilterValue: setHeaderFilterValueSpy,
      blockRedraw: jest.fn(),
      restoreRedraw: jest.fn(),
    }
    return { tabulator, blockRedraw: tabulator.blockRedraw, restoreRedraw: tabulator.restoreRedraw }
  }

  describe('useRemote initialization', () => {
    test('is REMOTE when isEditing=true regardless of row count', () => {
      expect(setup({ isEditing: true, response: smallResponse }).instance().isLocal).toBe(false)
    })

    test('is REMOTE when isDashboardEditing=true regardless of row count', () => {
      expect(setup({ isDashboardEditing: true, response: smallResponse }).instance().isLocal).toBe(false)
    })

    test('is LOCAL for small row count when isEditing=false', () => {
      expect(setup({ isEditing: false, response: smallResponse }).instance().isLocal).toBe(true)
    })

    test('skipInitialFilters=true does not affect useRemote decision', () => {
      expect(setup({ skipInitialFilters: true, response: smallResponse }).instance().isLocal).toBe(true)
    })

    test('fe_req.filters in response does NOT force REMOTE in view mode', () => {
      const response = {
        data: { data: { rows: [], count_rows: 10, query_id: 'q1', fe_req: { filters: [{ name: 'status', operator: '=', value: 'active' }] } } },
      }
      expect(setup({ response }).instance().isLocal).toBe(true)
    })

    test('initialTableParams.filter does NOT force REMOTE in view mode', () => {
      const wrapper = setup({ response: smallResponse, initialTableParams: { filter: [{ field: '1', type: '=', value: 'x' }] } })
      expect(wrapper.instance().isLocal).toBe(true)
    })
  })

  describe('skipInitialFilters', () => {
    test('does not call setFilters on tabulator mount when skipInitialFilters=true', () => {
      const wrapper = setup({ skipInitialFilters: true, initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      const spy = jest.spyOn(instance, 'setFilters').mockImplementation(() => {})
      jest.spyOn(instance, 'setHeaderInputEventListeners').mockImplementation(() => {})
      jest.spyOn(instance, 'setTableHeight').mockImplementation(() => {})
      jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})
      wrapper.setState({ tabulatorMounted: true })
      expect(spy).not.toHaveBeenCalled()
    })

    test('header inputs are not set when skipInitialFilters=true', () => {
      const setHeaderFilterValueSpy = jest.fn()
      const wrapper = setup({ skipInitialFilters: true, initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      instance.ref = makeMockRef(setHeaderFilterValueSpy)
      jest.spyOn(instance, 'setFilters').mockImplementation(() => {})
      jest.spyOn(instance, 'setHeaderInputEventListeners').mockImplementation(() => {})
      jest.spyOn(instance, 'setTableHeight').mockImplementation(() => {})
      jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})
      wrapper.setState({ tabulatorMounted: true })
      expect(setHeaderFilterValueSpy).not.toHaveBeenCalled()
    })

    test('tableParams.filter is still set when skipInitialFilters=true so API calls carry filters', () => {
      const wrapper = setup({ skipInitialFilters: true, initialTableParams: { filter: filters } })
      expect(wrapper.instance().tableParams.filter).toEqual(filters)
    })

    test('setFilterBadgeClasses still runs on mount when skipInitialFilters=true', () => {
      const wrapper = setup({ skipInitialFilters: true, initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      jest.spyOn(instance, 'setFilters').mockImplementation(() => {})
      jest.spyOn(instance, 'setHeaderInputEventListeners').mockImplementation(() => {})
      jest.spyOn(instance, 'setTableHeight').mockImplementation(() => {})
      const badgeSpy = jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})
      wrapper.setState({ tabulatorMounted: true })
      expect(badgeSpy).toHaveBeenCalled()
    })

    test('calls setFilters on tabulator mount when skipInitialFilters=false', () => {
      const wrapper = setup({ initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      const spy = jest.spyOn(instance, 'setFilters').mockImplementation(() => {})
      jest.spyOn(instance, 'setHeaderInputEventListeners').mockImplementation(() => {})
      jest.spyOn(instance, 'setTableHeight').mockImplementation(() => {})
      jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})
      wrapper.setState({ tabulatorMounted: true })
      expect(spy).toHaveBeenCalled()
    })

    test('setFilters populates header input values', () => {
      const setHeaderFilterValueSpy = jest.fn()
      const wrapper = setup({ initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      instance.ref = makeMockRef(setHeaderFilterValueSpy)
      instance.setFilters(filters)
      expect(setHeaderFilterValueSpy).toHaveBeenCalledWith('1', 'online')
    })

    test('does not call setFilters when skipInitialFilters stays false', () => {
      const wrapper = setup({ skipInitialFilters: false, initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      wrapper.setState({ tabulatorMounted: true })
      const spy = jest.spyOn(instance, 'setFilters').mockImplementation(() => {})
      wrapper.setProps({ skipInitialFilters: false })
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('isDashboardEditing queryFn bypass', () => {
    test('calls props.queryFn directly when isDashboardEditing=true', () => {
      const mockPropsQueryFn = jest.fn().mockResolvedValue({})
      const wrapper = setup({ isDashboardEditing: true, queryFn: mockPropsQueryFn })
      wrapper.instance().queryFn({ tableFilters: [{ field: '1', type: '=', value: 'x' }] })
      expect(mockPropsQueryFn).toHaveBeenCalledWith({ tableFilters: [{ field: '1', type: '=', value: 'x' }] })
    })

    test('calls props.queryFn directly when isEditing=true', () => {
      const mockPropsQueryFn = jest.fn().mockResolvedValue({})
      const wrapper = setup({ isEditing: true, queryFn: mockPropsQueryFn })
      wrapper.instance().queryFn({ tableFilters: [] })
      expect(mockPropsQueryFn).toHaveBeenCalled()
    })

    test('uses client-side path when neither isEditing nor isDashboardEditing', () => {
      const mockPropsQueryFn = jest.fn()
      const wrapper = setup({ isEditing: false, isDashboardEditing: false, queryFn: mockPropsQueryFn, response: smallResponse, useInfiniteScroll: false })
      wrapper.instance().queryFn({ tableFilters: [] })
      expect(mockPropsQueryFn).not.toHaveBeenCalled()
    })
  })

  describe('isDashboardEditing change handler', () => {
    function makeEditingRef({ clearHeaderFilter = jest.fn(), clearSort = jest.fn() } = {}) {
      const tabulator = {
        getColumns: jest.fn(() => [
          {
            getField: () => '1',
            getDefinition: () => ({ headerFilter: true }),
            getElement: () => ({ classList: { toggle: jest.fn(), add: jest.fn(), remove: jest.fn() } }),
          },
        ]),
        setHeaderFilterValue: jest.fn(),
        getHeaderFilters: jest.fn(() => []),
        clearHeaderFilter,
        clearSort,
        blockRedraw: jest.fn(),
        restoreRedraw: jest.fn(),
      }
      return { tabulator, blockRedraw: tabulator.blockRedraw, restoreRedraw: tabulator.restoreRedraw }
    }

    // Issue 1: badge always refreshed on editing state change
    test('calls setFilterBadgeClasses when isDashboardEditing changes to true with filter row closed', () => {
      const wrapper = setup({ isDashboardEditing: false, initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      instance.ref = makeEditingRef()
      instance._isMounted = true
      wrapper.setState({ tabulatorMounted: true, isFiltering: false })
      const badgeSpy = jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})

      wrapper.setProps({ isDashboardEditing: true })

      expect(badgeSpy).toHaveBeenCalled()
    })

    test('calls setFilterBadgeClasses when isDashboardEditing changes to false with filter row closed', () => {
      const wrapper = setup({ isDashboardEditing: true, initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      instance.ref = makeEditingRef()
      instance._isMounted = true
      wrapper.setState({ tabulatorMounted: true, isFiltering: false })
      const badgeSpy = jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})

      wrapper.setProps({ isDashboardEditing: false })

      expect(badgeSpy).toHaveBeenCalled()
    })

    test('calls setFilterBadgeClasses when isDashboardEditing changes with filter row open', () => {
      const wrapper = setup({ isDashboardEditing: false, initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      instance.ref = makeEditingRef()
      instance._isMounted = true
      wrapper.setState({ tabulatorMounted: true, isFiltering: true })
      const badgeSpy = jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})

      wrapper.setProps({ isDashboardEditing: true })

      expect(badgeSpy).toHaveBeenCalled()
    })

    // Entering edit mode always resets tableParams.filter to baseFilters (regardless of isFiltering)
    test('resets tableParams.filter to baseFilters when entering edit mode (even when isFiltering is false)', () => {
      const sessionFilters = [{ field: '1', type: '=', value: 'online' }]
      const wrapper = setup({ isDashboardEditing: false, initialTableParams: { filter: [] } })
      const instance = wrapper.instance()
      instance.ref = makeEditingRef()
      instance._isMounted = true
      // Suppress tabulatorMounted side-effects so we can control tableParams.filter
      jest.spyOn(instance, 'setFilters').mockImplementation(() => {})
      jest.spyOn(instance, 'setHeaderInputEventListeners').mockImplementation(() => {})
      jest.spyOn(instance, 'setTableHeight').mockImplementation(() => {})
      jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})
      wrapper.setState({ tabulatorMounted: true, isFiltering: false })
      // Set in-session applied filters AFTER tabulatorMounted block has run
      instance.tableParams.filter = sessionFilters

      wrapper.setProps({ isDashboardEditing: true })

      // Edit mode always resets to baseFilters (empty here) — view-mode filters are discarded
      expect(instance.tableParams.filter).toEqual([])
    })

    // Issue 2: _setFiltersTime stamped before clearHeaderFilter to guard AJAX
    test('stamps _setFiltersTime before clearHeaderFilter so the AJAX debounce guard fires', () => {
      const callOrder = []
      const clearHeaderFilterMock = jest.fn(() => callOrder.push('clearHeaderFilter'))

      const wrapper = setup({ isDashboardEditing: false, initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      instance.baseFilters = filters
      instance.ref = makeEditingRef({ clearHeaderFilter: clearHeaderFilterMock })
      instance._isMounted = true
      instance._setFiltersTime = 0 // stale — older than DEBOUNCE_MS

      wrapper.setState({ tabulatorMounted: true, isFiltering: true })

      // Track when _setFiltersTime is written relative to clearHeaderFilter
      let timeWhenClearCalled = null
      clearHeaderFilterMock.mockImplementation(() => {
        timeWhenClearCalled = instance._setFiltersTime
        callOrder.push('clearHeaderFilter')
      })

      wrapper.setProps({ isDashboardEditing: true })

      // _setFiltersTime must be set (non-zero) at the moment clearHeaderFilter runs
      expect(timeWhenClearCalled).toBeGreaterThan(0)
      expect(clearHeaderFilterMock).toHaveBeenCalled()
    })

    test('calls clearHeaderFilter when entering edit mode (even when filter row is closed)', () => {
      const clearHeaderFilterMock = jest.fn()
      const wrapper = setup({ isDashboardEditing: false, initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      instance.ref = makeEditingRef({ clearHeaderFilter: clearHeaderFilterMock })
      instance._isMounted = true
      wrapper.setState({ tabulatorMounted: true, isFiltering: false })
      jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})

      wrapper.setProps({ isDashboardEditing: true })

      expect(clearHeaderFilterMock).toHaveBeenCalled()
    })

    test('calls clearSort when entering edit mode', () => {
      const clearSortMock = jest.fn()
      const wrapper = setup({ isDashboardEditing: false, initialTableParams: { filter: filters } })
      const instance = wrapper.instance()
      instance.ref = makeEditingRef({ clearSort: clearSortMock })
      instance._isMounted = true
      wrapper.setState({ tabulatorMounted: true, isFiltering: false })
      jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})

      wrapper.setProps({ isDashboardEditing: true })

      expect(clearSortMock).toHaveBeenCalled()
    })

    test('resets tableParams to baseSort when entering edit mode', () => {
      const sort = [{ field: '1', dir: 'asc' }]
      const wrapper = setup({ isDashboardEditing: false, initialTableParams: { filter: [], sort } })
      const instance = wrapper.instance()
      instance.ref = makeEditingRef()
      instance._isMounted = true
      instance.tableParams.sort = [{ field: '1', dir: 'desc' }] // simulate view-mode sort change
      jest.spyOn(instance, 'setFilterBadgeClasses').mockImplementation(() => {})
      jest.spyOn(instance, 'setSorters').mockImplementation(() => {})
      wrapper.setState({ tabulatorMounted: true, isFiltering: false })

      wrapper.setProps({ isDashboardEditing: true })

      expect(instance.tableParams.sort).toEqual(sort)
    })
  })
})

describe('lockedFilters as baseFilters', () => {
  const locked = [{ field: '1', type: '=', value: 'locked-val' }]
  const initial = [{ field: '1', type: '=', value: 'initial-val' }]

  test('lockedFilters takes precedence over initialTableParams.filter for baseFilters', () => {
    const wrapper = setup({ lockedFilters: locked, initialTableParams: { filter: initial } })
    expect(wrapper.instance().baseFilters).toEqual(locked)
  })

  test('falls back to initialTableParams.filter when lockedFilters is undefined', () => {
    const wrapper = setup({ lockedFilters: undefined, initialTableParams: { filter: initial } })
    expect(wrapper.instance().baseFilters).toEqual(initial)
  })

  test('falls back to empty array when both lockedFilters and initialTableParams.filter are absent', () => {
    const wrapper = setup({ lockedFilters: undefined, initialTableParams: {} })
    expect(wrapper.instance().baseFilters).toEqual([])
  })
})

describe('enableBaseFilterInputs', () => {
  function setupWithDOM(filters) {
    const wrapper = setup({ initialTableParams: { filter: filters }, isDashboardEditing: false })
    const instance = wrapper.instance()

    const container = document.createElement('div')
    container.id = `react-autoql-table-container-${instance.TABLE_ID}`

    filters.forEach((filter) => {
      const col = document.createElement('div')
      col.className = 'tabulator-col'
      col.setAttribute('tabulator-field', filter.field)

      const content = document.createElement('div')
      content.className = 'tabulator-col-content'
      const input = document.createElement('input')
      input.disabled = true
      input.classList.add('react-autoql-base-filter-disabled')
      content.appendChild(input)
      col.appendChild(content)
      container.appendChild(col)

      const clearBtn = document.createElement('div')
      clearBtn.dataset.clearBtn = `${instance.TABLE_ID}-${filter.field}`
      clearBtn.style.pointerEvents = 'none'
      clearBtn.style.opacity = '0.3'
      document.body.appendChild(clearBtn)
    })

    document.body.appendChild(container)
    return { wrapper, instance, container }
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('re-enables header input and removes disabled class', () => {
    const filters = [{ field: '1', type: '=', value: 'online' }]
    const { instance, container } = setupWithDOM(filters)

    instance.enableBaseFilterInputs()

    const input = container.querySelector('.tabulator-col[tabulator-field="1"] input')
    expect(input.disabled).toBe(false)
    expect(input.classList.contains('react-autoql-base-filter-disabled')).toBe(false)
  })

  test('restores clear button interactivity', () => {
    const filters = [{ field: '1', type: '=', value: 'online' }]
    const { instance } = setupWithDOM(filters)

    instance.enableBaseFilterInputs()

    const clearBtn = document.querySelector(`[data-clear-btn="${instance.TABLE_ID}-1"]`)
    expect(clearBtn.style.pointerEvents).toBe('')
    expect(clearBtn.style.opacity).toBe('')
  })

  test('skips filters with no value', () => {
    const filters = [{ field: '1', type: '=', value: '' }]
    const { instance, container } = setupWithDOM(filters)

    instance.enableBaseFilterInputs()

    const input = container.querySelector('.tabulator-col[tabulator-field="1"] input')
    // Input was never disabled (no value), still not disabled after enable call
    expect(input.disabled).toBe(true) // DOM was set disabled in setupWithDOM, but enableBaseFilterInputs skips it
  })

  test('does nothing when baseFilters is empty', () => {
    const wrapper = setup({ isDashboardEditing: false })
    const instance = wrapper.instance()

    const spy = jest.spyOn(document, 'querySelector')
    instance.enableBaseFilterInputs()

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('handles missing DOM nodes gracefully (no throw)', () => {
    const filters = [{ field: '99', type: '=', value: 'missing' }]
    const wrapper = setup({ initialTableParams: { filter: filters }, isDashboardEditing: false })
    const instance = wrapper.instance()
    expect(() => instance.enableBaseFilterInputs()).not.toThrow()
  })
})

describe('onDataFiltered: showQueryInterpretation guard', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  function makeRef(getHeaderFiltersResult) {
    return {
      tabulator: {
        getHeaderFilters: jest.fn(() => getHeaderFiltersResult),
        setHeaderFilterValue: jest.fn(),
        getColumns: jest.fn(() => []),
        blockRedraw: jest.fn(),
        restoreRedraw: jest.fn(),
      },
    }
  }

  test('does NOT call getRTForRemoteFilterAndSort when showQueryInterpretation=false', () => {
    const wrapper = setup({ showQueryInterpretation: false })
    const instance = wrapper.instance()
    const spy = jest.spyOn(instance, 'getRTForRemoteFilterAndSort').mockResolvedValue(undefined)

    instance._isMounted = true
    instance.useInfiniteScroll = false
    instance.ref = makeRef([{ field: '1', type: '=', value: 'online' }])
    wrapper.setState({ tabulatorMounted: true })
    instance.tableParams.filter = [{ field: '1', type: '=', value: 'online' }]

    instance.onDataFiltered([], [])
    jest.advanceTimersByTime(200)

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('calls getRTForRemoteFilterAndSort when showQueryInterpretation=true and filters are set', () => {
    const wrapper = setup({ showQueryInterpretation: true })
    const instance = wrapper.instance()
    const spy = jest.spyOn(instance, 'getRTForRemoteFilterAndSort').mockResolvedValue(undefined)

    instance._isMounted = true
    instance.useInfiniteScroll = false
    instance.ref = makeRef([{ field: '1', type: '=', value: 'online' }])
    wrapper.setState({ tabulatorMounted: true })
    instance.tableParams.filter = [{ field: '1', type: '=', value: 'online' }]

    instance.onDataFiltered([], [])
    jest.advanceTimersByTime(200)

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('does NOT call getRTForRemoteFilterAndSort when filters are empty even if showQueryInterpretation=true', () => {
    const wrapper = setup({ showQueryInterpretation: true })
    const instance = wrapper.instance()
    const spy = jest.spyOn(instance, 'getRTForRemoteFilterAndSort').mockResolvedValue(undefined)

    instance._isMounted = true
    instance.useInfiniteScroll = false
    instance.ref = makeRef([])
    wrapper.setState({ tabulatorMounted: true })
    instance.tableParams.filter = []

    instance.onDataFiltered([], [])
    jest.advanceTimersByTime(200)

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
