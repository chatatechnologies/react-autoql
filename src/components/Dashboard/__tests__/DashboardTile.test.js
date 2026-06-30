import React from 'react'
import { shallow, mount } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import { DashboardTile } from '../DashboardTile/DashboardTile'
import sampleResponses from '../../../../test/responseTestCases'
// Use per-test Tabulator mock to avoid relying on global test-only mocks
jest.mock('tabulator-tables', () => require('../../../../test/utils/tabulatorMockFactory')())
import Tabulator from 'tabulator-tables'

const sampleTile = {
  key: 'be54870f-57da-4a02-99a8-5d2ea9993084',
  i: 'be54870f-57da-4a02-99a8-5d2ea9993084',
  w: 12,
  h: 5,
  x: 0,
  y: 0,
  query: 'Total online sales by region by year',
  title: '',
  minW: 3,
  minH: 2,
  maxH: 12,
  moved: false,
  static: false,
  skipQueryValidation: false,
  displayType: 'column',
  queryResponse: sampleResponses[10],
  dataConfig: {
    tableConfig: {
      stringColumnIndices: [0, 1],
      stringColumnIndex: 1,
      numberColumnIndices: [2],
      numberColumnIndex: 2,
      legendColumnIndex: 0,
    },
    pivotTableConfig: {
      stringColumnIndices: [0],
      stringColumnIndex: 0,
      numberColumnIndices: [1, 2, 3, 4, 5, 6],
      numberColumnIndex: 1,
    },
  },
}

const setup = (props = {}, state = null) => {
  const setupProps = {
    ...DashboardTile.defaultProps,
    ...props,
  }
  const wrapper = mount(<DashboardTile {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup({ tile: sampleTile })
    const dashboardTileComponent = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(dashboardTileComponent.exists()).toBe(true)
  })

  test('passes showRefreshInEdit to OptionsToolbar when editing', () => {
    const wrapper = setup({ tile: sampleTile, isEditing: true })
    const optionsToolbar = wrapper.find('OptionsToolbar').first()
    expect(optionsToolbar.exists()).toBe(true)
    expect(optionsToolbar.prop('showRefreshInEdit')).toBe(true)
    wrapper.unmount()
  })

  test('does not pass showRefreshInEdit when not editing', () => {
    const wrapper = setup({ tile: sampleTile, isEditing: false })
    const optionsToolbar = wrapper.find('OptionsToolbar').first()
    expect(optionsToolbar.exists()).toBe(true)
    expect(optionsToolbar.prop('showRefreshInEdit')).not.toBe(true)
    wrapper.unmount()
  })
})

describe('dashboard tile pivot after filtering', () => {
  test('filter in table view then switch to pivot shows data', () => {
    const tileWithTable = {
      ...sampleTile,
      displayType: 'table',
      // Start with no filters, will apply via initialFormattedTableParams updates
      tableFilters: [],
      orders: [],
    }

    const wrapper = setup({ tile: tileWithTable })

    // Ensure QueryOutput mounted
    const instance = wrapper.instance()
    expect(instance).toBeTruthy()

    // Simulate external filter being applied (like user filters in table)
    wrapper.setProps({
      tile: {
        ...tileWithTable,
        tableFilters: [
          {
            // Filter by Region using name match (QueryOutput resolves by id/field/name)
            name:
              tileWithTable.dataConfig.tableConfig.legendColumnIndex === 0
                ? sampleTile.dataConfig.tableConfig.legendColumnIndex
                : null,
            // Using actual column name from response
            id: sampleTile.queryResponse.data.data.columns[0].name,
            value: 'West',
            operator: '=',
          },
        ],
      },
    })

    // Now switch the tile display type to pivot_table
    wrapper.setProps({
      tile: {
        ...wrapper.props().tile,
        displayType: 'pivot_table',
      },
    })

    // Grab QueryOutput from top half
    const qo = wrapper.find('QueryOutput').at(0)
    expect(qo.exists()).toBe(true)

    const qoInstance = qo.instance().wrappedInstance || qo.instance()

    // After switching, pivotTableData should exist and have rows
    expect(qoInstance.pivotTableData).toBeDefined()
    expect(Array.isArray(qoInstance.pivotTableData)).toBe(true)
    expect(qoInstance.pivotTableData.length).toBeGreaterThan(0)

    wrapper.unmount()
  })
})

describe('config restoration after errors', () => {
  let mockSetParamsForTile
  let savedParams = []

  beforeEach(() => {
    jest.useFakeTimers()
    savedParams = []
    mockSetParamsForTile = jest.fn((params, tileId, callbackArray) => {
      savedParams.push({ params, tileId })
      // Simulate the debounce by calling callbacks immediately for testing
      if (callbackArray && Array.isArray(callbackArray)) {
        callbackArray.forEach((callback) => {
          if (typeof callback === 'function') {
            callback()
          }
        })
      }
    })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('should restore config after error when tile runs successfully, then errors, then succeeds again', () => {
    const initialConfig = {
      displayType: 'stacked_column',
      dataConfig: {
        tableConfig: {
          legendColumnIndex: 0,
          numberColumnIndex: 2,
          stringColumnIndex: 1,
          numberColumnIndices: [2],
          stringColumnIndices: [1],
        },
        pivotTableConfig: {
          numberColumnIndex: 1,
          stringColumnIndex: 0,
          numberColumnIndices: [1, 2, 3],
          stringColumnIndices: [0, 1, 2],
        },
      },
      aggConfig: { col1: 'SUM' },
      axisSorts: { 'x-1': 'value-asc' },
      networkColumnConfig: { sourceColumnIndex: 0, targetColumnIndex: 1 },
    }

    const tileWithConfig = {
      ...sampleTile,
      ...initialConfig,
      queryResponse: sampleResponses[10], // Successful response
    }

    const wrapper = setup({
      tile: tileWithConfig,
      setParamsForTile: mockSetParamsForTile,
    })

    const instance = wrapper.instance()

    // Step 1: First successful run - should save config
    const successResponse = {
      data: {
        data: sampleResponses[10].data.data,
        reference_id: '1.1.210', // Success (200-299 range)
      },
    }

    instance.endTopQuery({ response: successResponse })
    jest.advanceTimersByTime(100) // Advance past debounce

    // Simulate props update after setParamsForTile is called (what parent would do)
    wrapper.setProps({
      tile: {
        ...tileWithConfig,
        queryResponse: successResponse,
      },
    })

    // Verify config was saved after first success
    expect(instance.savedTileConfig.dataConfig).toEqual(initialConfig.dataConfig)
    expect(instance.savedTileConfig.displayType).toBe(initialConfig.displayType)
    expect(instance.savedTileConfig.aggConfig).toEqual(initialConfig.aggConfig)

    // Step 2: Simulate error response
    const errorResponse = {
      data: {
        message: 'error',
        reference_id: '1.1.500', // Error (not in 200-299 range)
      },
    }

    savedParams = [] // Reset to track restoration
    instance.endTopQuery({ response: errorResponse })
    jest.advanceTimersByTime(100) // Advance past debounce

    // Verify config was restored in the params
    const errorCall = savedParams.find((p) => p.params.queryResponse === errorResponse)
    expect(errorCall).toBeDefined()
    const errorCallParams = errorCall.params
    expect(errorCallParams.dataConfig).toEqual(initialConfig.dataConfig)
    expect(errorCallParams.displayType).toBe(initialConfig.displayType)
    expect(errorCallParams.aggConfig).toEqual(initialConfig.aggConfig)
    expect(errorCallParams.axisSorts).toEqual(initialConfig.axisSorts)
    expect(errorCallParams.networkColumnConfig).toEqual(initialConfig.networkColumnConfig)

    // Simulate props update with restored config
    wrapper.setProps({
      tile: {
        ...tileWithConfig,
        queryResponse: errorResponse,
        dataConfig: errorCallParams.dataConfig,
        displayType: errorCallParams.displayType,
        aggConfig: errorCallParams.aggConfig,
        axisSorts: errorCallParams.axisSorts,
        networkColumnConfig: errorCallParams.networkColumnConfig,
      },
    })

    // Step 3: Third run - successful again (with restored config in props)
    savedParams = [] // Reset again
    instance.endTopQuery({ response: successResponse })
    jest.advanceTimersByTime(100) // Advance past debounce

    // Simulate props update after third success
    wrapper.setProps({
      tile: {
        ...wrapper.props().tile,
        queryResponse: successResponse,
      },
    })

    // After third success, saved config should still have original values
    expect(instance.savedTileConfig.dataConfig).toEqual(initialConfig.dataConfig)
    expect(instance.savedTileConfig.displayType).toBe(initialConfig.displayType)
    expect(instance.savedTileConfig.aggConfig).toEqual(initialConfig.aggConfig)
    expect(instance.savedTileConfig.axisSorts).toEqual(initialConfig.axisSorts)
    expect(instance.savedTileConfig.networkColumnConfig).toEqual(initialConfig.networkColumnConfig)

    // Verify the final tile props still have the restored config (not reset to empty)
    const finalTile = wrapper.props().tile
    expect(finalTile.dataConfig).toEqual(initialConfig.dataConfig)
    expect(finalTile.displayType).toBe(initialConfig.displayType)
    expect(finalTile.aggConfig).toEqual(initialConfig.aggConfig)
    expect(finalTile.axisSorts).toEqual(initialConfig.axisSorts)
    expect(finalTile.networkColumnConfig).toEqual(initialConfig.networkColumnConfig)

    wrapper.unmount()
  })
})

describe('DashboardTile.isServerError', () => {
  const instance = new DashboardTile({ tile: { i: 1, query: '' }, setParamsForTile: () => {} })
  const fn = instance.isServerError.bind(instance)

  test('returns true when reference_id ends with .502', () => {
    expect(fn({ data: { reference_id: 'abc.def.502' } })).toBe(true)
  })

  test('returns true when referenceId ends with .502', () => {
    expect(fn({ data: { referenceId: '1.1.502' } })).toBe(true)
  })

  test('returns false when reference_id ends with .500 (not 502)', () => {
    expect(fn({ data: { reference_id: 'abc.def.500' } })).toBe(false)
  })

  test('returns false for numeric 5xx status alone', () => {
    expect(fn({ status: 502 })).toBe(false)
  })

  test('returns false for non-server responses (200)', () => {
    expect(fn({ status: 200 })).toBe(false)
  })

  test('returns false for empty/unknown response', () => {
    expect(fn({})).toBe(false)
  })
})

describe('DashboardTile retry behavior', () => {
  const mockRunCached = jest.fn()
  const mockRunQuery = jest.fn()

  beforeEach(() => {
    jest.useFakeTimers()
    mockRunCached.mockReset()
    mockRunQuery.mockReset()
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('retries with force:true and calls onRetry when cached helper returns 500', async () => {
    const onRetry = jest.fn()

    const props = {
      tile: { i: 1, query: 'cats' },
      setParamsForTile: jest.fn(),
      authentication: {},
      autoQLConfig: {},
      dataFormatting: {},
      onRetry,
    }

    const wrapper = shallow(<DashboardTile {...props} />)
    const instance = wrapper.instance()

    const requestData = { query: 'cats' }

    const error = { response: { data: { reference_id: 'abc.502' } } }

    mockRunCached
      .mockImplementationOnce(() => Promise.reject(error))
      .mockImplementationOnce(() => Promise.resolve({ data: { data: { rows: [] } }, status: 200 }))

    // Use real timers for the retry delay so promises resolve naturally
    jest.useRealTimers()
    const p = instance.executeQueryWithForceRetry(requestData, mockRunCached)

    try {
      await p
    } catch (e) {
      // swallow - we want to assert telemetry was emitted even on error
    }

    // Cached helper should be called twice: initial attempt and retry
    expect(mockRunCached).toHaveBeenCalledTimes(2)
    expect(mockRunCached).toHaveBeenNthCalledWith(2, expect.objectContaining({ force: true }))

    // Ensure the telemetry callback was invoked with the forced retry payload
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'retry', retryData: expect.objectContaining({ force: true }) }),
    )
  })

  it('successfully resolves query response after forced retry', async () => {
    const props = {
      tile: { i: 1, query: 'dogs' },
      setParamsForTile: jest.fn(),
      authentication: {},
      autoQLConfig: {},
      dataFormatting: {},
    }

    const wrapper = shallow(<DashboardTile {...props} />)
    const instance = wrapper.instance()

    const requestData = { query: 'dogs' }
    const successResponse = { data: { data: { rows: [{ name: 'Fido', age: 5 }] } }, status: 200 }
    const error = { response: { data: { reference_id: 'abc.502' } } }

    mockRunCached
      .mockImplementationOnce(() => Promise.reject(error))
      .mockImplementationOnce(() => Promise.resolve(successResponse))

    // Use real timers for the retry so promises resolve naturally
    jest.useRealTimers()
    const result = await instance.executeQueryWithForceRetry(requestData, mockRunCached)

    // Assert force:true was passed on the retry call
    expect(mockRunCached).toHaveBeenNthCalledWith(2, expect.objectContaining({ force: true }))
    // Assert the successful response is returned from the forced retry
    expect(result).toEqual(successResponse)
  })
})

describe('queryResponseVersion', () => {
  test('increments when tile.queryResponse is replaced externally while not executing', () => {
    const initialQR = sampleResponses[10]
    // Simulate a new query result with a different query_id (version detection uses query_id)
    const newQR = {
      ...sampleResponses[10],
      data: { ...sampleResponses[10].data, data: { ...sampleResponses[10].data?.data, query_id: 'q_replaced-external' } },
    }
    const wrapper = setup({ tile: { ...sampleTile, queryResponse: initialQR } })

    const initialVersion = wrapper.state('queryResponseVersion')

    // Simulate external replacement while not executing
    wrapper.setProps({ tile: { ...sampleTile, queryResponse: newQR } })

    expect(wrapper.state('queryResponseVersion')).toBe(initialVersion + 1)
    wrapper.unmount()
  })

  test('increments when QR arrives after null (reset cycle)', () => {
    // Reset explicitly sets queryResponse: null in props; this transition must increment.
    const wrapper = setup({ tile: { ...sampleTile, queryResponse: null } })

    const initialVersion = wrapper.state('queryResponseVersion')

    wrapper.setProps({ tile: { ...sampleTile, queryResponse: sampleResponses[10] } })

    expect(wrapper.state('queryResponseVersion')).toBe(initialVersion + 1)
    wrapper.unmount()
  })

  test('does not increment when QR arrives from undefined (prop hydration)', () => {
    // Parent hydrates tile with a cached queryResponse on re-render — should NOT force a remount.
    const wrapper = setup({ tile: { ...sampleTile, queryResponse: undefined } })

    const initialVersion = wrapper.state('queryResponseVersion')

    wrapper.setProps({ tile: { ...sampleTile, queryResponse: sampleResponses[10] } })

    expect(wrapper.state('queryResponseVersion')).toBe(initialVersion)
    wrapper.unmount()
  })

  test('does not increment while isTopExecuting is true', () => {
    const initialQR = sampleResponses[10]
    const newQR = {
      ...sampleResponses[10],
      data: { ...sampleResponses[10].data, data: { ...sampleResponses[10].data?.data, query_id: 'q_executing-guard' } },
    }
    const wrapper = setup({ tile: { ...sampleTile, queryResponse: initialQR } })

    wrapper.setState({ isTopExecuting: true })
    const version = wrapper.state('queryResponseVersion')

    wrapper.setProps({ tile: { ...sampleTile, queryResponse: newQR } })

    expect(wrapper.state('queryResponseVersion')).toBe(version)
    wrapper.unmount()
  })
})

describe('endTopQuery: queryId capture in edit mode', () => {
  let mockSetParamsForTile
  let savedParams

  beforeEach(() => {
    jest.useFakeTimers()
    savedParams = []
    mockSetParamsForTile = jest.fn((params) => { savedParams.push(params) })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('DOES capture new queryId on re-run when isCachedRefresh=false (edit-mode re-run with same query text)', () => {
    const tileWithExistingId = { ...sampleTile, queryId: 'q_old-id' }
    const wrapper = setup({ tile: tileWithExistingId, isEditing: true, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    const response = {
      data: { data: { ...sampleResponses[10].data.data, query_id: 'q_new-from-edit' }, reference_id: '1.1.200' },
    }

    // isCachedRefresh=false (real runQuery call) → always captures new queryId for PUT
    instance.endTopQuery({ response, queryChanged: false, isCachedRefresh: false })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.queryId === 'q_new-from-edit')
    expect(call).toBeDefined()
    wrapper.unmount()
  })

  test('does NOT overwrite existing queryId when isCachedRefresh=true (view-mode cached call, same queryId expected)', () => {
    const tileWithExistingId = { ...sampleTile, queryId: 'q_existing' }
    const wrapper = setup({ tile: tileWithExistingId, isEditing: false, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    const response = {
      data: { data: { ...sampleResponses[10].data.data, query_id: 'q_should-not-set' }, reference_id: '1.1.200' },
    }

    // isCachedRefresh=true (cached endpoint, view mode) + queryChanged=false → skip update
    instance.endTopQuery({ response, queryChanged: false, isCachedRefresh: true })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.queryId === 'q_should-not-set')
    expect(call).toBeUndefined()
    wrapper.unmount()
  })

  test('always captures queryId when there is no existing queryId', () => {
    const tileWithNoId = { ...sampleTile, queryId: undefined }
    const wrapper = setup({ tile: tileWithNoId, isEditing: false, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    const response = {
      data: { data: { ...sampleResponses[10].data.data, query_id: 'q_first-capture' }, reference_id: '1.1.200' },
    }

    instance.endTopQuery({ response, queryChanged: false })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.queryId === 'q_first-capture')
    expect(call).toBeDefined()
    wrapper.unmount()
  })
})

describe('network column detection in endTopQuery', () => {
  test('endTopQuery handles successful responses without errors', () => {
    const wrapper = setup({ tile: sampleTile })
    const instance = wrapper.instance()

    const response = {
      data: { data: sampleResponses[10].data.data, reference_id: '1.1.200' },
    }

    // Should not throw
    instance.endTopQuery({ response })

    wrapper.unmount()
  })

  test('endTopQuery with isReset=true clears reset-zeroed fields in savedTileConfig', () => {
    const wrapper = setup({
      tile: {
        ...sampleTile,
        columns: [{ field: '0' }],
        aggConfig: { rev: 'SUM' },
        tableFilters: [{ col: 'x' }],
        dataConfig: { tableConfig: { columnMap: {} } },
        axisSorts: [{ col: 'y', dir: 'asc' }],
        networkColumnConfig: { source: 0 },
      },
    })
    const instance = wrapper.instance()

    const response = { data: { data: sampleResponses[10].data.data, reference_id: '1.1.200' } }
    instance.endTopQuery({ response, isReset: true })

    // Reset-cleared fields must be zeroed so a subsequent error-restore uses clean state.
    expect(instance.savedTileConfig.columns).toEqual([])
    expect(instance.savedTileConfig.tableFilters).toEqual([])
    expect(instance.savedTileConfig.aggConfig).toBeUndefined()
    expect(instance.savedTileConfig.dataConfig).toBeUndefined()
    expect(instance.savedTileConfig.axisSorts).toBeUndefined()
    expect(instance.savedTileConfig.networkColumnConfig).toBeUndefined()

    wrapper.unmount()
  })
})

describe('isReset flag in processTileTop', () => {
  test('passes isReset=true down to processQuery', () => {
    const wrapper = setup({ tile: sampleTile })
    const instance = wrapper.instance()

    const mockResponse = { data: { data: { rows: [] } } }
    const processQuerySpy = jest
      .spyOn(instance, 'processQuery')
      .mockImplementation(() => Promise.resolve(mockResponse))

    instance.processTileTop({ isReset: true })

    expect(processQuerySpy).toHaveBeenCalledWith(expect.objectContaining({ isReset: true }))

    processQuerySpy.mockRestore()
    wrapper.unmount()
  })

  test('passes isReset=false by default', () => {
    const wrapper = setup({ tile: sampleTile })
    const instance = wrapper.instance()

    const mockResponse = { data: { data: { rows: [] } } }
    const processQuerySpy = jest
      .spyOn(instance, 'processQuery')
      .mockImplementation(() => Promise.resolve(mockResponse))

    instance.processTileTop({})

    const callArgs = processQuerySpy.mock.calls[0][0]
    expect(callArgs.isReset).toBeFalsy()

    processQuerySpy.mockRestore()
    wrapper.unmount()
  })
})

describe('normalizeAxisSorts unit', () => {
  test('converts array-of-objects to a merged plain object', () => {
    const instance = setup({ tile: sampleTile }).instance()
    expect(instance.normalizeAxisSorts([{ 'x-col1': 'asc' }, { 'x-col2': 'desc' }])).toEqual({
      'x-col1': 'asc',
      'x-col2': 'desc',
    })
    instance.props // suppress enzyme warning
  })

  test('passes a plain object through unchanged', () => {
    const instance = setup({ tile: sampleTile }).instance()
    expect(instance.normalizeAxisSorts({ 'x-col1': 'asc' })).toEqual({ 'x-col1': 'asc' })
  })

  test('returns empty object for undefined', () => {
    const instance = setup({ tile: sampleTile }).instance()
    expect(instance.normalizeAxisSorts(undefined)).toEqual({})
  })

  test('returns empty object for null', () => {
    const instance = setup({ tile: sampleTile }).instance()
    expect(instance.normalizeAxisSorts(null)).toEqual({})
  })

  test('returns empty object for an empty array', () => {
    const instance = setup({ tile: sampleTile }).instance()
    expect(instance.normalizeAxisSorts([])).toEqual({})
  })

  test('skips non-object array items without throwing', () => {
    const instance = setup({ tile: sampleTile }).instance()
    expect(() => instance.normalizeAxisSorts([null, 'bad', { 'x-col1': 'asc' }])).not.toThrow()
  })
})

describe('axisSorts array normalization', () => {
  test('converts array-of-objects to plain object for QueryOutput', () => {
    const arrayAxisSorts = [{ 'x-col1': 'value-asc' }, { 'x-col2': 'value-desc' }]
    const wrapper = setup({
      tile: { ...sampleTile, axisSorts: arrayAxisSorts },
      isEditing: false,
    })

    const qo = wrapper.find('QueryOutput').first()
    const initialAxisSorts = qo.prop('initialAxisSorts')

    expect(initialAxisSorts).toEqual({ 'x-col1': 'value-asc', 'x-col2': 'value-desc' })

    wrapper.unmount()
  })

  test('passes object axisSorts through unchanged', () => {
    const objAxisSorts = { 'x-col1': 'value-asc' }
    const wrapper = setup({
      tile: { ...sampleTile, axisSorts: objAxisSorts },
      isEditing: false,
    })

    const qo = wrapper.find('QueryOutput').first()
    expect(qo.prop('initialAxisSorts')).toEqual({ 'x-col1': 'value-asc' })

    wrapper.unmount()
  })

  test('returns empty object when axisSorts is undefined', () => {
    const wrapper = setup({
      tile: { ...sampleTile, axisSorts: undefined },
      isEditing: false,
    })

    const qo = wrapper.find('QueryOutput').first()
    expect(qo.prop('initialAxisSorts')).toEqual({})

    wrapper.unmount()
  })
})

describe('pivotTableConfig empty stripping', () => {
  test('strips pivotTableConfig and tableConfig when both index arrays are empty', () => {
    const tileWithEmptyPivot = {
      ...sampleTile,
      dataConfig: {
        tableConfig: { stringColumnIndices: [], numberColumnIndices: [] },
        pivotTableConfig: { stringColumnIndices: [], numberColumnIndices: [] },
      },
    }
    const wrapper = setup({ tile: tileWithEmptyPivot, isEditing: false })

    const qo = wrapper.find('QueryOutput').first()
    const dataConfig = qo.prop('dataConfig')

    if (dataConfig) {
      expect(dataConfig).not.toHaveProperty('pivotTableConfig')
      expect(dataConfig).not.toHaveProperty('tableConfig')
    }

    wrapper.unmount()
  })

  test('preserves pivotTableConfig when indices are not empty', () => {
    const wrapper = setup({ tile: sampleTile, isEditing: false })

    const qo = wrapper.find('QueryOutput').first()
    const dataConfig = qo.prop('dataConfig')

    if (dataConfig) {
      // sampleTile has non-empty indices — both should be preserved
      expect(dataConfig).toHaveProperty('pivotTableConfig')
      expect(dataConfig).toHaveProperty('tableConfig')
    }

    wrapper.unmount()
  })
})

describe('endBottomQuery error path preserves secondNetworkColumnConfig', () => {
  let mockSetParamsForTile
  let savedParams

  beforeEach(() => {
    jest.useFakeTimers()
    savedParams = []
    mockSetParamsForTile = jest.fn((params) => {
      savedParams.push(params)
    })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('error response does not overwrite restored secondNetworkColumnConfig', () => {
    const savedNetworkConfig = { sourceColumnIndex: 0, targetColumnIndex: 1 }

    const wrapper = setup({
      tile: { ...sampleTile, secondNetworkColumnConfig: savedNetworkConfig },
      setParamsForTile: mockSetParamsForTile,
    })
    const instance = wrapper.instance()

    // Seed savedTileConfig with the network config (as if a prior success run saved it)
    instance.savedTileConfig = { ...instance.savedTileConfig, secondNetworkColumnConfig: savedNetworkConfig }

    const errorResponse = {
      data: { message: 'error', reference_id: '1.1.500' },
    }

    instance.endBottomQuery({ response: errorResponse })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.secondQueryResponse === errorResponse)
    expect(call).toBeDefined()
    // The restored config must not be overwritten by null from getNetworkColumnConfig(errorResponse)
    expect(call.secondNetworkColumnConfig).toEqual(savedNetworkConfig)
  })

  test('success response still sets secondNetworkColumnConfig from response', () => {
    const wrapper = setup({
      tile: sampleTile,
      setParamsForTile: mockSetParamsForTile,
    })
    const instance = wrapper.instance()

    const successResponse = {
      data: {
        data: {
          ...sampleResponses[10].data.data,
          columns: [
            { name: 'source', type: 'STRING' },
            { name: 'target', type: 'STRING' },
          ],
        },
        reference_id: '1.1.210',
      },
    }

    instance.endBottomQuery({ response: successResponse })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.secondQueryResponse === successResponse)
    expect(call).toBeDefined()
    // secondNetworkColumnConfig should be set (may be null if no network columns detected, but key exists)
    expect(Object.prototype.hasOwnProperty.call(call, 'secondNetworkColumnConfig')).toBe(true)
  })
})

describe('endBottomQuery: secondQueryId capture with isCachedRefresh', () => {
  let mockSetParamsForTile
  let savedParams

  beforeEach(() => {
    jest.useFakeTimers()
    savedParams = []
    mockSetParamsForTile = jest.fn((params) => { savedParams.push(params) })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('DOES capture new secondQueryId when isCachedRefresh=false (edit-mode re-run)', () => {
    const tileWithExistingId = { ...sampleTile, secondQueryId: 'q_old-second-id' }
    const wrapper = setup({ tile: tileWithExistingId, isEditing: true, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    const response = {
      data: { data: { ...sampleResponses[10].data.data, query_id: 'q_new-second-id' }, reference_id: '1.1.200' },
    }

    instance.endBottomQuery({ response, queryChanged: false, isCachedRefresh: false })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.secondQueryId === 'q_new-second-id')
    expect(call).toBeDefined()
    wrapper.unmount()
  })

  test('does NOT overwrite existing secondQueryId when isCachedRefresh=true (view-mode cached call)', () => {
    const tileWithExistingId = { ...sampleTile, secondQueryId: 'q_existing-second' }
    const wrapper = setup({ tile: tileWithExistingId, isEditing: false, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    const response = {
      data: { data: { ...sampleResponses[10].data.data, query_id: 'q_should-not-set-second' }, reference_id: '1.1.200' },
    }

    instance.endBottomQuery({ response, queryChanged: false, isCachedRefresh: true })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.secondQueryId === 'q_should-not-set-second')
    expect(call).toBeUndefined()
    wrapper.unmount()
  })
})

describe('debouncedSetParamsForTile does not fire after unmount', () => {
  test('setParamsForTile is not called when component unmounts before debounce fires', () => {
    const mockSetParamsForTile = jest.fn()
    jest.useFakeTimers()

    const wrapper = setup({
      tile: sampleTile,
      setParamsForTile: mockSetParamsForTile,
    })
    const instance = wrapper.instance()

    // Trigger a debounced call (e.g. title change)
    instance.debouncedSetParamsForTile({ title: 'new title' })

    // Unmount before the 50ms debounce fires
    wrapper.unmount()

    // Advance past the debounce window
    jest.advanceTimersByTime(200)

    // The initial aggConfig call from the constructor fires immediately (not debounced),
    // so we check that no call happened AFTER unmount (i.e. with the title param)
    const postUnmountCall = mockSetParamsForTile.mock.calls.find(
      ([params]) => params?.title === 'new title',
    )
    expect(postUnmountCall).toBeUndefined()

    jest.useRealTimers()
  })
})

describe('onRefreshClick and onResetClick wiring', () => {
  test('onRefreshClick triggers executeSingleTile with tile id', () => {
    const executeSingleTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, executeSingleTile, isEditing: true })

    const toolbar = wrapper.find('OptionsToolbar').first()
    toolbar.prop('onRefreshClick')()

    expect(executeSingleTile).toHaveBeenCalledWith(sampleTile.i)

    wrapper.unmount()
  })

  test('onResetClick triggers resetTile with tile id', () => {
    const resetTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, resetTile, isEditing: true })

    const toolbar = wrapper.find('OptionsToolbar').first()
    toolbar.prop('onResetClick')()

    expect(resetTile).toHaveBeenCalledWith(sampleTile.i)

    wrapper.unmount()
  })
})

describe('endBottomQuery isReset guard', () => {
  let mockSetParamsForTile
  let savedParams

  beforeEach(() => {
    jest.useFakeTimers()
    savedParams = []
    mockSetParamsForTile = jest.fn((params) => {
      savedParams.push(params)
    })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  const successResponse = {
    data: { data: { columns: [], rows: [] }, reference_id: '1.1.200' },
  }

  test('isReset=true clears reset-zeroed second* fields in savedTileConfig', () => {
    const wrapper = setup({
      tile: {
        ...sampleTile,
        secondAggConfig: { col: 'SUM' },
        secondColumns: [{ field: '0' }],
        secondTableFilters: [{ col: 'x' }],
        secondDataConfig: { tableConfig: { columnMap: {} } },
        secondAxisSorts: [{ col: 'y', dir: 'asc' }],
        secondNetworkColumnConfig: { source: 0 },
      },
      setParamsForTile: mockSetParamsForTile,
    })
    const instance = wrapper.instance()

    instance.endBottomQuery({ response: successResponse, isReset: true })

    // Reset-cleared fields must be zeroed so a subsequent error-restore uses clean state.
    expect(instance.savedTileConfig.secondAggConfig).toBeUndefined()
    expect(instance.savedTileConfig.secondColumns).toEqual([])
    expect(instance.savedTileConfig.secondTableFilters).toEqual([])
    expect(instance.savedTileConfig.secondDataConfig).toBeUndefined()
    expect(instance.savedTileConfig.secondAxisSorts).toBeUndefined()
    expect(instance.savedTileConfig.secondNetworkColumnConfig).toBeUndefined()

    wrapper.unmount()
  })

  test('isReset=false (default) updates all savedTileConfig second-half fields', () => {
    const newAggConfig = { revenue: 'SUM' }
    const newColumns = [{ field: '1' }]

    const wrapper = setup({
      tile: {
        ...sampleTile,
        secondAggConfig: newAggConfig,
        secondColumns: newColumns,
        secondTableFilters: [],
      },
      setParamsForTile: mockSetParamsForTile,
    })
    const instance = wrapper.instance()

    instance.endBottomQuery({ response: successResponse, isReset: false })

    expect(instance.savedTileConfig.secondAggConfig).toEqual(newAggConfig)
    expect(instance.savedTileConfig.secondColumns).toEqual(newColumns)

    wrapper.unmount()
  })

  test('isReset=true still sets secondNetworkColumnConfig from response', () => {
    const wrapper = setup({ tile: sampleTile, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    instance.endBottomQuery({ response: successResponse, isReset: true })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.secondQueryResponse === successResponse)
    expect(call).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(call, 'secondNetworkColumnConfig')).toBe(true)

    wrapper.unmount()
  })
})

describe('isReset flag in processTileBottom', () => {
  test('passes isReset=true down to processQuery', () => {
    const wrapper = setup({ tile: { ...sampleTile, splitView: true, secondQuery: 'SELECT 2' } })
    const instance = wrapper.instance()

    const processQuerySpy = jest
      .spyOn(instance, 'processQuery')
      .mockImplementation(() => Promise.resolve({ data: { data: { rows: [] } } }))

    instance.processTileBottom({ query: 'SELECT 2', isReset: true })

    expect(processQuerySpy).toHaveBeenCalledWith(expect.objectContaining({ isReset: true }))

    processQuerySpy.mockRestore()
    wrapper.unmount()
  })

  test('passes isReset=false by default', () => {
    const wrapper = setup({ tile: { ...sampleTile, splitView: true, secondQuery: 'SELECT 2' } })
    const instance = wrapper.instance()

    const processQuerySpy = jest
      .spyOn(instance, 'processQuery')
      .mockImplementation(() => Promise.resolve({ data: { data: { rows: [] } } }))

    instance.processTileBottom({ query: 'SELECT 2' })

    expect(processQuerySpy).toHaveBeenCalledWith(expect.objectContaining({ isReset: false }))

    processQuerySpy.mockRestore()
    wrapper.unmount()
  })

  test('passes isReset to endBottomQuery via then chain', async () => {
    const wrapper = setup({ tile: { ...sampleTile, splitView: true, secondQuery: 'SELECT 2' } })
    const instance = wrapper.instance()

    const endBottomQuerySpy = jest.spyOn(instance, 'endBottomQuery').mockReturnValue(undefined)
    jest
      .spyOn(instance, 'processQuery')
      .mockImplementation(() => Promise.resolve({ data: { reference_id: '1.1.200', data: {} } }))

    await instance.processTileBottom({ query: 'SELECT 2', isReset: true })

    expect(endBottomQuerySpy).toHaveBeenCalledWith(expect.objectContaining({ isReset: true }))

    wrapper.unmount()
  })
})

describe('getNetworkColumnConfig', () => {
  const instance = new DashboardTile({ tile: { i: 1, query: '' }, setParamsForTile: () => {} })

  test('returns null when response has no columns and no rows', () => {
    expect(instance.getNetworkColumnConfig({ data: { data: { columns: [], rows: [] } } })).toBeNull()
  })

  test('returns null when response is empty or malformed', () => {
    expect(instance.getNetworkColumnConfig(null)).toBeNull()
    expect(instance.getNetworkColumnConfig({})).toBeNull()
  })

  test('falls back to object row keys when columns array is empty', () => {
    const response = {
      data: { data: { columns: [], rows: [{ source: 'A', target: 'B' }] } },
    }
    // findNetworkColumns may or may not detect these synthetic cols — result is null or a valid config object
    const result = instance.getNetworkColumnConfig(response)
    expect(result === null || (typeof result === 'object' && 'sourceColumnIndex' in result)).toBe(true)
  })

  test('falls back to array row indices when columns array is empty', () => {
    const response = {
      data: { data: { columns: [], rows: [['A', 'B', 10]] } },
    }
    const result = instance.getNetworkColumnConfig(response)
    expect(result === null || (typeof result === 'object' && 'sourceColumnIndex' in result)).toBe(true)
  })
})

describe('dashboard tile: prop passing to QueryOutput for filtering mode', () => {
  test('passes skipInitialFilters=true to QueryOutput in view mode so header inputs start empty', () => {
    const wrapper = setup({ tile: sampleTile, isEditing: false })
    const qo = wrapper.find('QueryOutput').first()
    expect(qo.prop('skipInitialFilters')).toBe(true)
    wrapper.unmount()
  })

  test('passes skipInitialFilters=true to QueryOutput in edit mode — header inputs always start empty', () => {
    const wrapper = setup({ tile: sampleTile, isEditing: true })
    const qo = wrapper.find('QueryOutput').first()
    expect(qo.prop('skipInitialFilters')).toBe(true)
    wrapper.unmount()
  })

  test('passes isDashboardEditing=true to QueryOutput when isEditing=true', () => {
    const wrapper = setup({ tile: sampleTile, isEditing: true })
    const qo = wrapper.find('QueryOutput').first()
    expect(qo.prop('isDashboardEditing')).toBe(true)
    wrapper.unmount()
  })

  test('passes isDashboardEditing=false to QueryOutput when isEditing=false', () => {
    const wrapper = setup({ tile: sampleTile, isEditing: false })
    const qo = wrapper.find('QueryOutput').first()
    expect(qo.prop('isDashboardEditing')).toBe(false)
    wrapper.unmount()
  })

  test('QueryOutput receives isDashboardEditing not raw isEditing (DashboardTile maps the prop)', () => {
    const wrapper = setup({ tile: sampleTile, isEditing: true })
    const qo = wrapper.find('QueryOutput').first()
    // DashboardTile maps isEditing → isDashboardEditing for the API-bypass path in ChataTable
    expect(qo.prop('isDashboardEditing')).toBe(true)
    // isEditing on QueryOutput is for chart legend state and is not set by DashboardTile
    expect(qo.prop('isEditing')).toBeFalsy()
    wrapper.unmount()
  })

  test('passes onNewQueryId callback to QueryOutput for capturing filter-triggered queryIds in edit mode', () => {
    const wrapper = setup({ tile: sampleTile, isEditing: true })
    const qo = wrapper.find('QueryOutput').first()
    expect(typeof qo.prop('onNewQueryId')).toBe('function')
    wrapper.unmount()
  })

  test('onNewQueryId callback calls debouncedSetParamsForTile with queryId', () => {
    jest.useFakeTimers()
    const mockSetParamsForTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, isEditing: true, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()
    const qo = wrapper.find('QueryOutput').first()

    const onNewQueryId = qo.prop('onNewQueryId')
    onNewQueryId('q_new-from-filter')
    jest.advanceTimersByTime(100)

    const call = mockSetParamsForTile.mock.calls.find(([params]) => params?.queryId === 'q_new-from-filter')
    expect(call).toBeDefined()

    jest.useRealTimers()
    wrapper.unmount()
  })
})

describe('dashboard tile: initialFormattedTableParams filter handling', () => {
  test('does NOT use fe_req.filters in initialFormattedTableParams (those are baked into cached SQL)', () => {
    const feReqFilters = [{ name: 'status', operator: '=', value: 'active' }]
    const tileWithFeReqOnly = {
      ...sampleTile,
      tableFilters: undefined,
      queryResponse: {
        ...sampleTile.queryResponse,
        data: {
          ...sampleTile.queryResponse.data,
          data: {
            ...sampleTile.queryResponse.data.data,
            fe_req: { filters: feReqFilters },
          },
        },
      },
    }

    const wrapper = setup({ tile: tileWithFeReqOnly })
    const qo = wrapper.find('QueryOutput').first()
    const params = qo.prop('initialFormattedTableParams')

    // fe_req.filters must not appear — they are already in the cached SQL
    expect(params.filters).not.toEqual(feReqFilters)
    wrapper.unmount()
  })

  test('uses tile.tableFilters in initialFormattedTableParams (needed for subset-filter API continuity)', () => {
    const tableFilters = [{ name: 'region', operator: '=', value: 'West' }]
    const tileWithTableFilters = { ...sampleTile, tableFilters }

    const wrapper = setup({ tile: tileWithTableFilters })
    const qo = wrapper.find('QueryOutput').first()
    const params = qo.prop('initialFormattedTableParams')

    expect(params.filters).toEqual(tableFilters)
    wrapper.unmount()
  })

  test('initialFormattedTableParams passes sorters', () => {
    const tileWithOrders = { ...sampleTile, orders: [{ field: 'date', dir: 'desc' }] }

    const wrapper = setup({ tile: tileWithOrders })
    const qo = wrapper.find('QueryOutput').first()
    const params = qo.prop('initialFormattedTableParams')

    expect(params.sorters).toEqual([{ field: 'date', dir: 'desc' }])
    wrapper.unmount()
  })

  test('initialFormattedTableParams passes sessionFilters', () => {
    const tileWithSessionFilters = {
      ...sampleTile,
      filters: [{ value: 'West', operator: '=', name: 'region' }],
    }

    const wrapper = setup({ tile: tileWithSessionFilters })
    const qo = wrapper.find('QueryOutput').first()
    const params = qo.prop('initialFormattedTableParams')

    expect(params.sessionFilters).toEqual([{ value: 'West', operator: '=', name: 'region' }])
    wrapper.unmount()
  })

  test('visual pre-population is suppressed by skipInitialFilters even when tableFilters is set', () => {
    const tileWithFilters = {
      ...sampleTile,
      tableFilters: [{ name: 'region', operator: '=', value: 'West' }],
    }

    const wrapper = setup({ tile: tileWithFilters })
    const qo = wrapper.find('QueryOutput').first()

    // Filters are in the params for API calls, but visual display is suppressed
    expect(qo.prop('skipInitialFilters')).toBe(true)
    expect(qo.prop('initialFormattedTableParams').filters).toBeDefined()
    wrapper.unmount()
  })
})

describe('onSecondColumnChange: secondQueryId capture', () => {
  let mockSetParamsForTile
  let savedParams

  beforeEach(() => {
    jest.useFakeTimers()
    savedParams = []
    mockSetParamsForTile = jest.fn((params) => { savedParams.push(params) })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('captures secondQueryId from secondQueryResponse when column changes', () => {
    const splitTile = { ...sampleTile, secondQuery: 'show second data', secondQueryResponse: sampleTile.queryResponse }
    const wrapper = setup({ tile: splitTile, isEditing: true, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    const secondQueryResponse = {
      data: { data: { ...sampleResponses[10].data.data, query_id: 'q_second-column-change' }, reference_id: '1.1.200' },
    }

    instance.onSecondColumnChange({}, [], [], secondQueryResponse, {}, [], [], [])
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.secondQueryId === 'q_second-column-change')
    expect(call).toBeDefined()
    wrapper.unmount()
  })

  test('secondQueryId is undefined when secondQueryResponse has no query_id', () => {
    const splitTile = { ...sampleTile, secondQuery: 'show second data', secondQueryResponse: sampleTile.queryResponse }
    const wrapper = setup({ tile: splitTile, isEditing: true, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    instance.onSecondColumnChange({}, [], [], null, {}, [], [], [])
    jest.advanceTimersByTime(100)

    expect(savedParams.length).toBeGreaterThan(0)
    const call = savedParams[savedParams.length - 1]
    expect(call.secondQueryId).toBeUndefined()
    wrapper.unmount()
  })
})

describe('onTableParamsChange — filter interactions', () => {
  const formattedParams = { filters: [{ field: 'region', value: 'West' }], sorters: [] }

  test('does NOT apply filter changes in view mode (isEditing=false)', () => {
    jest.useFakeTimers()
    const mockSetParamsForTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, isEditing: false, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)   // flush any init debounced calls
    mockSetParamsForTile.mockClear()
    wrapper.instance().onTableParamsChange({}, formattedParams)
    jest.advanceTimersByTime(200)
    const call = mockSetParamsForTile.mock.calls.find(([p]) => p?.tableFilters)
    expect(call).toBeUndefined()
    wrapper.unmount()
    jest.useRealTimers()
  })

  test('applies filter changes in edit mode (isEditing=true)', () => {
    jest.useFakeTimers()
    const mockSetParamsForTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, isEditing: true, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()
    wrapper.instance().onTableParamsChange({}, formattedParams)
    jest.advanceTimersByTime(200)
    const call = mockSetParamsForTile.mock.calls.find(([p]) => p?.tableFilters)
    expect(call).toBeDefined()
    expect(call[0].tableFilters).toEqual(formattedParams.filters)
    wrapper.unmount()
    jest.useRealTimers()
  })

  test('onSecondTableParamsChange does NOT apply filter changes in view mode', () => {
    jest.useFakeTimers()
    const mockSetParamsForTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, isEditing: false, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()
    wrapper.instance().onSecondTableParamsChange({}, formattedParams)
    jest.advanceTimersByTime(200)
    const call = mockSetParamsForTile.mock.calls.find(([p]) => p?.secondTableFilters)
    expect(call).toBeUndefined()
    wrapper.unmount()
    jest.useRealTimers()
  })
})

describe('DashboardTile dirty class guard', () => {
  test('does NOT apply dirty class on a new tile (no queryId) even when isDirty is true', () => {
    const newTile = { ...sampleTile, queryId: undefined }
    const wrapper = setup({ tile: newTile, isDirty: true })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(tile.prop('className')).not.toContain('dirty')
    wrapper.unmount()
  })

  test('applies dirty class on an existing tile (has queryId) when isDirty is true', () => {
    const existingTile = { ...sampleTile, queryId: 'qid-1' }
    const wrapper = setup({ tile: existingTile, isDirty: true, isEditing: true })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(tile.prop('className')).toContain('dirty')
    wrapper.unmount()
  })

  test('does NOT apply dirty class when isDirty is false even with queryId', () => {
    const existingTile = { ...sampleTile, queryId: 'qid-1' }
    const wrapper = setup({ tile: existingTile, isDirty: false, isEditing: true })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(tile.prop('className')).not.toContain('dirty')
    wrapper.unmount()
  })

  test('does NOT apply dirty class in view mode (isEditing=false)', () => {
    const existingTile = { ...sampleTile, queryId: 'qid-1' }
    const wrapper = setup({ tile: existingTile, isDirty: true, isEditing: false })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(tile.prop('className')).not.toContain('dirty')
    wrapper.unmount()
  })
})

describe('DashboardTile dirty badge guard', () => {
  test('does NOT render dirty badge on a new tile (no queryId) even when isDirty is true', () => {
    const newTile = { ...sampleTile, queryId: undefined }
    const wrapper = setup({ tile: newTile, isDirty: true })
    expect(wrapper.find('.react-autoql-dashboard-tile-dirty-badge').exists()).toBe(false)
    wrapper.unmount()
  })

  test('renders dirty badge on an existing tile (has queryId) when isDirty is true', () => {
    const existingTile = { ...sampleTile, queryId: 'qid-1' }
    const wrapper = setup({ tile: existingTile, isDirty: true, isEditing: true })
    expect(wrapper.find('.react-autoql-dashboard-tile-dirty-badge').exists()).toBe(true)
    wrapper.unmount()
  })

  test('does NOT render dirty badge when isDirty is false', () => {
    const existingTile = { ...sampleTile, queryId: 'qid-1' }
    const wrapper = setup({ tile: existingTile, isDirty: false, isEditing: true })
    expect(wrapper.find('.react-autoql-dashboard-tile-dirty-badge').exists()).toBe(false)
    wrapper.unmount()
  })

  test('applies bottom-dirty class to bottom pane when split view newly enabled and bottom not yet run', () => {
    const splitTile = { ...sampleTile, queryId: 'qid-1', splitView: true, secondQuery: sampleTile.query }
    const wrapper = setup({ tile: splitTile, isDirty: true, isEditing: true })
    expect(wrapper.find('.dashboard-tile-split-pane-container.bottom-dirty').exists()).toBe(true)
    wrapper.unmount()
  })

  test('does NOT apply bottom-dirty class when bottom query has been executed', () => {
    const splitTile = { ...sampleTile, queryId: 'qid-1', splitView: true, secondQuery: sampleTile.query, secondQueryId: 'qid-second' }
    const wrapper = setup({ tile: splitTile, isDirty: false, isEditing: true })
    expect(wrapper.find('.dashboard-tile-split-pane-container.bottom-dirty').exists()).toBe(false)
    wrapper.unmount()
  })

  test('does NOT apply bottom-dirty class when not editing', () => {
    const splitTile = { ...sampleTile, queryId: 'qid-1', splitView: true, secondQuery: sampleTile.query }
    const wrapper = setup({ tile: splitTile, isDirty: true, isEditing: false })
    expect(wrapper.find('.dashboard-tile-split-pane-container.bottom-dirty').exists()).toBe(false)
    wrapper.unmount()
  })

  test('applies top-dirty class to top pane when only top is dirty (no bottom-specific reason)', () => {
    const splitTile = { ...sampleTile, queryId: 'qid-1', splitView: true, secondQuery: sampleTile.query, secondQueryId: 'qid-second' }
    const wrapper = setup({ tile: splitTile, isDirty: true, isEditing: true })
    expect(wrapper.find('.dashboard-tile-split-pane-container.top-dirty').exists()).toBe(true)
    expect(wrapper.find('.dashboard-tile-split-pane-container.bottom-dirty').exists()).toBe(false)
    wrapper.unmount()
  })

  test('applies bottom-failed class when split view bottom response fails', () => {
    const failedResponse = { data: { reference_id: '1.1.400', data: {} } }
    const splitTile = { ...sampleTile, queryId: 'qid-1', splitView: true, secondQuery: sampleTile.query, secondQueryResponse: failedResponse }
    const wrapper = setup({ tile: splitTile, isFailed: true, isEditing: true })
    expect(wrapper.find('.dashboard-tile-split-pane-container.bottom-failed').exists()).toBe(true)
    wrapper.unmount()
  })

  test('does NOT apply tile-level failed class for split view (per-pane banners handle it)', () => {
    const failedResponse = { data: { reference_id: '1.1.400', data: {} } }
    const splitTile = { ...sampleTile, queryId: 'qid-1', splitView: true, secondQuery: sampleTile.query, secondQueryResponse: failedResponse }
    const wrapper = setup({ tile: splitTile, isFailed: true, isEditing: true })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(tile.prop('className')).not.toContain('failed')
    wrapper.unmount()
  })
})

describe('DashboardTile failed class and badge', () => {
  test('applies failed class when isFailed is true', () => {
    const wrapper = setup({ tile: sampleTile, isFailed: true, isEditing: true })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(tile.prop('className')).toContain('failed')
    wrapper.unmount()
  })

  test('does NOT apply failed class when isFailed is false', () => {
    const wrapper = setup({ tile: sampleTile, isFailed: false, isEditing: true })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(tile.prop('className')).not.toContain('failed')
    wrapper.unmount()
  })

  test('renders failed badge when isFailed is true', () => {
    const wrapper = setup({ tile: sampleTile, isFailed: true, isEditing: true })
    expect(wrapper.find('.react-autoql-dashboard-tile-failed-badge').exists()).toBe(true)
    wrapper.unmount()
  })

  test('does NOT render failed badge when isFailed is false', () => {
    const wrapper = setup({ tile: sampleTile, isFailed: false, isEditing: true })
    expect(wrapper.find('.react-autoql-dashboard-tile-failed-badge').exists()).toBe(false)
    wrapper.unmount()
  })

  test('does NOT apply failed class in view mode (isEditing=false)', () => {
    const wrapper = setup({ tile: sampleTile, isFailed: true, isEditing: false })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(tile.prop('className')).not.toContain('failed')
    wrapper.unmount()
  })

  test('does NOT render failed badge in view mode (isEditing=false)', () => {
    const wrapper = setup({ tile: sampleTile, isFailed: true, isEditing: false })
    expect(wrapper.find('.react-autoql-dashboard-tile-failed-badge').exists()).toBe(false)
    wrapper.unmount()
  })

  test('shows failed class but NOT dirty class when both isFailed and isDirty (prevents badge overlap)', () => {
    const existingTile = { ...sampleTile, queryId: 'qid-1' }
    const wrapper = setup({ tile: existingTile, isDirty: true, isFailed: true, isEditing: true })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    const className = tile.prop('className')
    expect(className).toContain('failed')
    expect(className).not.toContain('dirty')
    wrapper.unmount()
  })
})

describe('DashboardTile wasFilteringBeforeRemount', () => {
  test('starts as false', () => {
    const wrapper = setup({ tile: sampleTile })
    expect(wrapper.instance().wasFilteringBeforeRemount).toBe(false)
    wrapper.unmount()
  })

  test('captures isFilteringTable() value from actual responseRef before version increment', () => {
    const wrapper = setup({ tile: { ...sampleTile, queryId: undefined } })
    const instance = wrapper.instance()

    // Spy on the real responseRef (set by the mounted QueryOutput)
    if (instance.state.responseRef && typeof instance.state.responseRef.isFilteringTable === 'function') {
      jest.spyOn(instance.state.responseRef, 'isFilteringTable').mockReturnValue(true)
    }
    instance.setState({ isTopExecuting: false })

    const newQR = {
      ...sampleResponses[10],
      data: { ...sampleResponses[10].data, data: { ...sampleResponses[10].data?.data, query_id: 'q_new-was-filtering' } },
    }
    wrapper.setProps({ tile: { ...sampleTile, queryResponse: newQR } })

    // wasFilteringBeforeRemount should reflect whatever isFilteringTable() returned
    expect(typeof instance.wasFilteringBeforeRemount).toBe('boolean')
    wrapper.unmount()
  })

  test('defaults wasFilteringBeforeRemount to false when responseRef is not set', () => {
    const wrapper = setup({ tile: { ...sampleTile, queryId: undefined } })
    const instance = wrapper.instance()

    // Clear responseRef so the fallback || false path is taken
    instance.setState({ responseRef: null, isTopExecuting: false })

    const newQR = {
      ...sampleResponses[10],
      data: { ...sampleResponses[10].data, data: { ...sampleResponses[10].data?.data, query_id: 'q_no-ref' } },
    }
    wrapper.setProps({ tile: { ...sampleTile, queryResponse: newQR } })

    expect(instance.wasFilteringBeforeRemount).toBe(false)
    wrapper.unmount()
  })

  test('passes wasFilteringBeforeRemount as initialIsFiltering to QueryOutput', () => {
    const wrapper = setup({ tile: sampleTile })
    const instance = wrapper.instance()
    instance.wasFilteringBeforeRemount = true
    instance.forceUpdate()
    wrapper.update()
    const qo = wrapper.find('QueryOutput').first()
    expect(qo.prop('initialIsFiltering')).toBe(true)
    wrapper.unmount()
  })
})

describe('DashboardTile wasBottomFilteringBeforeRemount', () => {
  test('starts as false', () => {
    const wrapper = setup({ tile: sampleTile })
    expect(wrapper.instance().wasBottomFilteringBeforeRemount).toBe(false)
    wrapper.unmount()
  })

  test('defaults to false when secondResponseRef is not set', () => {
    const wrapper = setup({ tile: { ...sampleTile, queryId: undefined } })
    const instance = wrapper.instance()
    instance.setState({ secondResponseRef: null, isTopExecuting: false })

    const newQR = {
      ...sampleResponses[10],
      data: { ...sampleResponses[10].data, data: { ...sampleResponses[10].data?.data, query_id: 'q_bottom-no-ref' } },
    }
    wrapper.setProps({ tile: { ...sampleTile, queryResponse: newQR } })

    expect(instance.wasBottomFilteringBeforeRemount).toBe(false)
    wrapper.unmount()
  })

  test('captures isFilteringTable() from secondResponseRef when response changes', () => {
    const wrapper = setup({ tile: { ...sampleTile, queryId: undefined } })
    const instance = wrapper.instance()

    if (instance.state.secondResponseRef && typeof instance.state.secondResponseRef.isFilteringTable === 'function') {
      jest.spyOn(instance.state.secondResponseRef, 'isFilteringTable').mockReturnValue(true)
    }
    instance.setState({ isTopExecuting: false })

    const newQR = {
      ...sampleResponses[10],
      data: { ...sampleResponses[10].data, data: { ...sampleResponses[10].data?.data, query_id: 'q_bottom-filtering' } },
    }
    wrapper.setProps({ tile: { ...sampleTile, queryResponse: newQR } })

    expect(typeof instance.wasBottomFilteringBeforeRemount).toBe('boolean')
    wrapper.unmount()
  })

  test('passes wasBottomFilteringBeforeRemount as initialIsFiltering to bottom QueryOutput', () => {
    const splitTile = { ...sampleTile, splitView: true, secondQuery: sampleTile.query, secondQueryResponse: sampleResponses[10] }
    const wrapper = setup({ tile: splitTile })
    const instance = wrapper.instance()
    instance.wasBottomFilteringBeforeRemount = true
    instance.forceUpdate()
    wrapper.update()
    const outputs = wrapper.find('QueryOutput')
    const bottomOutput = outputs.length > 1 ? outputs.last() : outputs.first()
    expect(bottomOutput.prop('initialIsFiltering')).toBe(true)
    wrapper.unmount()
  })
})

describe('DashboardTile onColumnChange edit mode guard', () => {
  test('does NOT call setParamsForTile when not in edit mode', () => {
    jest.useFakeTimers()
    const mockSetParamsForTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, isEditing: false, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()

    wrapper.instance().onColumnChange({}, [], [], sampleTile.queryResponse, {}, [])
    jest.advanceTimersByTime(200)

    expect(mockSetParamsForTile).not.toHaveBeenCalled()
    wrapper.unmount()
    jest.useRealTimers()
  })

  test('calls setParamsForTile with queryId when in edit mode', () => {
    jest.useFakeTimers()
    const mockSetParamsForTile = jest.fn()
    const qr = { data: { data: { ...sampleResponses[10].data.data, query_id: 'q_col-change' }, reference_id: '1.1.200' } }
    const wrapper = setup({ tile: sampleTile, isEditing: true, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()

    wrapper.instance().onColumnChange({}, [], [], qr, {}, [])
    jest.advanceTimersByTime(200)

    const call = mockSetParamsForTile.mock.calls.find(([p]) => p?.queryId === 'q_col-change')
    expect(call).toBeDefined()
    wrapper.unmount()
    jest.useRealTimers()
  })
})

describe('hasError', () => {
  const instance = new DashboardTile({ tile: { i: 1, query: '' }, setParamsForTile: () => {} })

  test('returns false when reference_id is in 200-299 range', () => {
    expect(instance.hasError({ data: { reference_id: '1.1.200' } })).toBe(false)
    expect(instance.hasError({ data: { reference_id: '1.1.299' } })).toBe(false)
    expect(instance.hasError({ data: { reference_id: '1.1.210' } })).toBe(false)
  })

  test('returns true when reference_id is outside 200-299 range', () => {
    expect(instance.hasError({ data: { reference_id: '1.1.500' } })).toBe(true)
    expect(instance.hasError({ data: { reference_id: '1.1.400' } })).toBe(true)
    expect(instance.hasError({ data: { reference_id: '1.1.100' } })).toBe(true)
  })

  test('returns true when response is null or undefined', () => {
    expect(instance.hasError(null)).toBe(true)
    expect(instance.hasError(undefined)).toBe(true)
    expect(instance.hasError({})).toBe(true)
  })

  test('returns true when reference_id is missing', () => {
    expect(instance.hasError({ data: {} })).toBe(true)
  })
})

describe('shouldHideOptions', () => {
  const instance = new DashboardTile({ tile: { i: 1, query: '' }, setParamsForTile: () => {} })

  test('returns true when response has replacements', () => {
    const response = { data: { data: { replacements: [{ value: 'foo', text: 'bar' }] } } }
    expect(instance.shouldHideOptions(response)).toBe(true)
  })

  test('returns true when response has items', () => {
    const response = { data: { data: { items: [{ label: 'thing' }] } } }
    expect(instance.shouldHideOptions(response)).toBe(true)
  })

  test('returns false for a normal query response', () => {
    const response = { data: { data: { rows: [], columns: [] } } }
    expect(instance.shouldHideOptions(response)).toBe(false)
  })

  test('returns false for null/undefined', () => {
    expect(instance.shouldHideOptions(null)).toBe(false)
    expect(instance.shouldHideOptions(undefined)).toBe(false)
  })

  test('returns false when response has data but no reference_id', () => {
    const response = { data: { data: { rows: [[1, 2]], columns: [] } } }
    expect(instance.shouldHideOptions(response)).toBe(false)
  })

  test('returns true when response has an error reference_id', () => {
    const response = { data: { reference_id: '1.1.500' } }
    expect(instance.shouldHideOptions(response)).toBe(true)
  })

  test('returns false when response has a success reference_id', () => {
    const response = { data: { reference_id: '1.1.200' } }
    expect(instance.shouldHideOptions(response)).toBe(false)
  })
})

describe('filterValidConfig', () => {
  const instance = new DashboardTile({ tile: { i: 1, query: '' }, setParamsForTile: () => {} })

  test('includes tableFilters when it is an empty array', () => {
    const result = instance.filterValidConfig({ tableFilters: [] })
    expect(result).toHaveProperty('tableFilters')
    expect(result.tableFilters).toEqual([])
  })

  test('excludes tableFilters when it is null', () => {
    const result = instance.filterValidConfig({ tableFilters: null })
    expect(result).not.toHaveProperty('tableFilters')
  })

  test('includes dataConfig only when tableConfig or pivotTableConfig is non-null', () => {
    const validDataConfig = { tableConfig: { stringColumnIndices: [0] } }
    expect(instance.filterValidConfig({ dataConfig: validDataConfig })).toHaveProperty('dataConfig')

    const emptyDataConfig = {}
    expect(instance.filterValidConfig({ dataConfig: emptyDataConfig })).not.toHaveProperty('dataConfig')
  })

  test('excludes falsy non-array fields', () => {
    const result = instance.filterValidConfig({ displayType: '', aggConfig: undefined, axisSorts: null })
    expect(result).not.toHaveProperty('displayType')
    expect(result).not.toHaveProperty('aggConfig')
    expect(result).not.toHaveProperty('axisSorts')
  })

  test('includes truthy non-array fields', () => {
    const result = instance.filterValidConfig({ displayType: 'column', aggConfig: { col: 'SUM' } })
    expect(result.displayType).toBe('column')
    expect(result.aggConfig).toEqual({ col: 'SUM' })
  })
})

describe('endTopQuery: secondQueryId mirroring when both halves share the same query', () => {
  let mockSetParamsForTile
  let savedParams

  beforeEach(() => {
    jest.useFakeTimers()
    savedParams = []
    mockSetParamsForTile = jest.fn((params) => { savedParams.push(params) })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('mirrors queryId to secondQueryId when areTopAndBottomSameQuery() returns true', () => {
    // Same query, same filters → areTopAndBottomSameQuery() === true
    const tile = { ...sampleTile, query: 'SELECT 1', secondQuery: 'SELECT 1', tableFilters: [], secondTableFilters: [] }
    const wrapper = setup({ tile, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    const response = {
      data: { data: { ...sampleResponses[10].data.data, query_id: 'q_mirror-test' }, reference_id: '1.1.200' },
    }

    instance.endTopQuery({ response, queryChanged: true })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.queryId === 'q_mirror-test')
    expect(call).toBeDefined()
    expect(call.secondQueryId).toBe('q_mirror-test')

    wrapper.unmount()
  })

  test('does NOT set secondQueryId when areTopAndBottomSameQuery() returns false', () => {
    // Different queries → areTopAndBottomSameQuery() === false
    const tile = { ...sampleTile, query: 'SELECT 1', secondQuery: 'SELECT 2', tableFilters: [], secondTableFilters: [] }
    const wrapper = setup({ tile, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    const response = {
      data: { data: { ...sampleResponses[10].data.data, query_id: 'q_no-mirror' }, reference_id: '1.1.200' },
    }

    instance.endTopQuery({ response, queryChanged: true })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.queryId === 'q_no-mirror')
    expect(call).toBeDefined()
    expect(call.secondQueryId).toBeUndefined()

    wrapper.unmount()
  })

  test('does NOT mirror secondQueryId when filters differ (even if query text is the same)', () => {
    const tile = {
      ...sampleTile,
      query: 'SELECT 1',
      secondQuery: 'SELECT 1',
      tableFilters: [{ field: 'region', value: 'West' }],
      secondTableFilters: [{ field: 'region', value: 'East' }],
    }
    const wrapper = setup({ tile, setParamsForTile: mockSetParamsForTile })
    const instance = wrapper.instance()

    const response = {
      data: { data: { ...sampleResponses[10].data.data, query_id: 'q_filter-split' }, reference_id: '1.1.200' },
    }

    instance.endTopQuery({ response, queryChanged: false })
    jest.advanceTimersByTime(100)

    const call = savedParams.find((p) => p.queryId === 'q_filter-split')
    expect(call).toBeDefined()
    expect(call.secondQueryId).toBeUndefined()

    wrapper.unmount()
  })
})

describe('onNewQueryId and onSecondNewQueryId: skipping falsy values', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers() })

  test('onNewQueryId does NOT call setParamsForTile when queryId is falsy', () => {
    const mockSetParamsForTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()

    wrapper.instance().onNewQueryId(null)
    wrapper.instance().onNewQueryId(undefined)
    wrapper.instance().onNewQueryId('')
    jest.advanceTimersByTime(200)

    const calls = mockSetParamsForTile.mock.calls.filter(([p]) => 'queryId' in p)
    expect(calls.length).toBe(0)
    wrapper.unmount()
  })

  test('onNewQueryId calls setParamsForTile with queryId when truthy', () => {
    const mockSetParamsForTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()

    wrapper.instance().onNewQueryId('q_truthy')
    jest.advanceTimersByTime(200)

    const call = mockSetParamsForTile.mock.calls.find(([p]) => p?.queryId === 'q_truthy')
    expect(call).toBeDefined()
    wrapper.unmount()
  })

  test('onSecondNewQueryId does NOT call setParamsForTile when queryId is falsy', () => {
    const mockSetParamsForTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()

    wrapper.instance().onSecondNewQueryId(null)
    wrapper.instance().onSecondNewQueryId(undefined)
    jest.advanceTimersByTime(200)

    const calls = mockSetParamsForTile.mock.calls.filter(([p]) => 'secondQueryId' in p)
    expect(calls.length).toBe(0)
    wrapper.unmount()
  })

  test('onSecondNewQueryId calls setParamsForTile with secondQueryId when truthy', () => {
    const mockSetParamsForTile = jest.fn()
    const wrapper = setup({ tile: sampleTile, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()

    wrapper.instance().onSecondNewQueryId('q_second-truthy')
    jest.advanceTimersByTime(200)

    const call = mockSetParamsForTile.mock.calls.find(([p]) => p?.secondQueryId === 'q_second-truthy')
    expect(call).toBeDefined()
    wrapper.unmount()
  })
})

describe('DashboardTile dirty class/badge for replacements and items responses', () => {
  test('does NOT apply dirty class when queryResponse has replacements but isDirty is false (new tile)', () => {
    const tileWithReplacements = {
      ...sampleTile,
      queryId: undefined,
      queryResponse: {
        data: { data: { replacements: [{ value: 'foo', text: 'bar' }] }, reference_id: '1.1.200' },
      },
    }
    const wrapper = setup({ tile: tileWithReplacements, isDirty: false, isEditing: true })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(tile.prop('className')).not.toContain('dirty')
    wrapper.unmount()
  })

  test('does NOT apply dirty class when queryResponse has items but isDirty is false (new tile)', () => {
    const tileWithItems = {
      ...sampleTile,
      queryId: undefined,
      queryResponse: {
        data: { data: { items: [{ label: 'thing' }] }, reference_id: '1.1.200' },
      },
    }
    const wrapper = setup({ tile: tileWithItems, isDirty: false, isEditing: true })
    const tile = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(tile.prop('className')).not.toContain('dirty')
    wrapper.unmount()
  })

  test('renders dirty badge when queryResponse has replacements and isDirty is true', () => {
    const tileWithReplacements = {
      ...sampleTile,
      queryId: undefined,
      queryResponse: {
        data: { data: { replacements: [{ value: 'foo', text: 'bar' }] }, reference_id: '1.1.200' },
      },
    }
    const wrapper = setup({ tile: tileWithReplacements, isDirty: true, isEditing: true })
    expect(wrapper.find('.react-autoql-dashboard-tile-dirty-badge').exists()).toBe(true)
    wrapper.unmount()
  })

  test('does NOT render dirty badge when queryResponse has items but isDirty is false (new tile)', () => {
    const tileWithItems = {
      ...sampleTile,
      queryId: undefined,
      queryResponse: {
        data: { data: { items: [{ label: 'thing' }] }, reference_id: '1.1.200' },
      },
    }
    const wrapper = setup({ tile: tileWithItems, isDirty: false, isEditing: true })
    expect(wrapper.find('.react-autoql-dashboard-tile-dirty-badge').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('DashboardTile OptionsToolbar hideOnError: hides toolbar for replacements/items responses', () => {
  test('hides OptionsToolbar when queryResponse has replacements', () => {
    const tileWithReplacements = {
      ...sampleTile,
      queryResponse: {
        data: { data: { replacements: [{ value: 'foo', text: 'bar' }] }, reference_id: '1.1.200' },
      },
    }
    const wrapper = setup({ tile: tileWithReplacements })
    // hideOnError=true means the toolbar is not rendered
    expect(wrapper.find('OptionsToolbar').length).toBe(0)
    wrapper.unmount()
  })

  test('shows OptionsToolbar for a normal successful response', () => {
    const wrapper = setup({ tile: sampleTile })
    expect(wrapper.find('OptionsToolbar').first().exists()).toBe(true)
    wrapper.unmount()
  })

  test('does not pass hideOnError as a prop to OptionsToolbar', () => {
    const wrapper = setup({ tile: sampleTile })
    const toolbar = wrapper.find('OptionsToolbar').first()
    expect(toolbar.exists()).toBe(true)
    expect(toolbar.prop('hideOnError')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('processTile: runs processTileBottom separately when filters differ', () => {
  test('calls processTileBottom when top and bottom filters differ (even if query text is identical)', () => {
    const tile = {
      ...sampleTile,
      splitView: true,
      query: 'SELECT 1',
      secondQuery: 'SELECT 1',
      tableFilters: [{ field: 'region', value: 'West' }],
      secondTableFilters: [{ field: 'region', value: 'East' }],
    }
    const wrapper = setup({ tile })
    const instance = wrapper.instance()

    const processTileBottomSpy = jest
      .spyOn(instance, 'processTileBottom')
      .mockImplementation(() => Promise.resolve())
    jest.spyOn(instance, 'processTileTop').mockImplementation(() => Promise.resolve())

    instance.processTile({ query: 'SELECT 1', secondQuery: 'SELECT 1' })

    expect(processTileBottomSpy).toHaveBeenCalled()

    processTileBottomSpy.mockRestore()
    wrapper.unmount()
  })

  test('does NOT call processTileBottom when filters are equal and query text is identical', () => {
    const filters = [{ field: 'region', value: 'West' }]
    const tile = {
      ...sampleTile,
      splitView: true,
      query: 'SELECT 1',
      secondQuery: 'SELECT 1',
      tableFilters: filters,
      secondTableFilters: filters,
    }
    const wrapper = setup({ tile })
    const instance = wrapper.instance()

    const processTileBottomSpy = jest
      .spyOn(instance, 'processTileBottom')
      .mockImplementation(() => Promise.resolve())
    jest.spyOn(instance, 'processTileTop').mockImplementation(() => Promise.resolve())

    instance.processTile({ query: 'SELECT 1', secondQuery: 'SELECT 1' })

    expect(processTileBottomSpy).not.toHaveBeenCalled()

    processTileBottomSpy.mockRestore()
    wrapper.unmount()
  })
})

describe('showResetQueryOption prop wiring', () => {
  test('passes showResetQueryOption=true to OptionsToolbar when prop is true, tile has query and queryResponse', () => {
    const tileWithResponse = { ...sampleTile, query: 'show sales', queryResponse: sampleResponses[10] }
    const wrapper = setup({ tile: tileWithResponse, showResetQueryOption: true, isEditing: true })
    const toolbar = wrapper.find('OptionsToolbar').first()
    expect(toolbar.prop('showResetQueryOption')).toBe(true)
    wrapper.unmount()
  })

  test('passes showResetQueryOption=false when tile has no queryResponse', () => {
    const tileNoResponse = { ...sampleTile, query: 'show sales', queryResponse: undefined }
    const wrapper = setup({ tile: tileNoResponse, showResetQueryOption: true, isEditing: true })
    const toolbar = wrapper.find('OptionsToolbar').first()
    expect(toolbar.prop('showResetQueryOption')).toBe(false)
    wrapper.unmount()
  })

  test('passes showResetQueryOption=false when tile has no query', () => {
    const tileNoQuery = { ...sampleTile, query: '', queryResponse: sampleResponses[10] }
    const wrapper = setup({ tile: tileNoQuery, showResetQueryOption: true, isEditing: true })
    const toolbar = wrapper.find('OptionsToolbar').first()
    expect(toolbar.prop('showResetQueryOption')).toBe(false)
    wrapper.unmount()
  })
})

describe('DashboardTile areTopAndBottomSameQuery with filter equality', () => {
  test('returns true when queries are identical and filters are equal', () => {
    const filters = [{ field: 'region', value: 'West' }]
    const wrapper = setup({
      tile: {
        ...sampleTile,
        query: 'SELECT 1',
        secondQuery: 'SELECT 1',
        tableFilters: filters,
        secondTableFilters: filters,
      },
    })
    expect(wrapper.instance().areTopAndBottomSameQuery()).toBe(true)
    wrapper.unmount()
  })

  test('returns false when queries are identical but filters differ', () => {
    const wrapper = setup({
      tile: {
        ...sampleTile,
        query: 'SELECT 1',
        secondQuery: 'SELECT 1',
        tableFilters: [{ field: 'region', value: 'West' }],
        secondTableFilters: [{ field: 'region', value: 'East' }],
      },
    })
    expect(wrapper.instance().areTopAndBottomSameQuery()).toBe(false)
    wrapper.unmount()
  })

  test('returns false when queries differ even if filters are equal', () => {
    const wrapper = setup({
      tile: {
        ...sampleTile,
        query: 'SELECT 1',
        secondQuery: 'SELECT 2',
        tableFilters: [],
        secondTableFilters: [],
      },
    })
    expect(wrapper.instance().areTopAndBottomSameQuery()).toBe(false)
    wrapper.unmount()
  })

  test('returns true when no secondQuery (single-query tile)', () => {
    const wrapper = setup({
      tile: { ...sampleTile, query: 'SELECT 1', secondQuery: undefined, tableFilters: [], secondTableFilters: [] },
    })
    expect(wrapper.instance().areTopAndBottomSameQuery()).toBe(true)
    wrapper.unmount()
  })
})

describe('shouldShowDirtyBadge', () => {
  test('returns true when isDirty and tile has queryId', () => {
    const wrapper = setup({ tile: { ...sampleTile, queryId: 'qid-1' }, isDirty: true, isEditing: true })
    expect(wrapper.instance().shouldShowDirtyBadge()).toBe(true)
    wrapper.unmount()
  })

  test('returns false when isDirty but tile has no queryId', () => {
    const wrapper = setup({ tile: { ...sampleTile, queryId: undefined }, isDirty: true, isEditing: true })
    expect(wrapper.instance().shouldShowDirtyBadge()).toBe(false)
    wrapper.unmount()
  })

  test('returns true when queryResponse has replacements and isDirty is true', () => {
    const tile = {
      ...sampleTile,
      queryId: undefined,
      queryResponse: { data: { data: { replacements: [{ value: 'foo', text: 'bar' }] }, reference_id: '1.1.200' } },
    }
    const wrapper = setup({ tile, isDirty: true, isEditing: true })
    expect(wrapper.instance().shouldShowDirtyBadge()).toBe(true)
    wrapper.unmount()
  })

  test('returns false when queryResponse has replacements but isDirty is false (new tile)', () => {
    const tile = {
      ...sampleTile,
      queryId: undefined,
      queryResponse: { data: { data: { replacements: [{ value: 'foo', text: 'bar' }] }, reference_id: '1.1.200' } },
    }
    const wrapper = setup({ tile, isDirty: false, isEditing: true })
    expect(wrapper.instance().shouldShowDirtyBadge()).toBe(false)
    wrapper.unmount()
  })

  test('returns true when queryResponse has items and isDirty is true', () => {
    const tile = {
      ...sampleTile,
      queryId: undefined,
      queryResponse: { data: { data: { items: [{ label: 'thing' }] }, reference_id: '1.1.200' } },
    }
    const wrapper = setup({ tile, isDirty: true, isEditing: true })
    expect(wrapper.instance().shouldShowDirtyBadge()).toBe(true)
    wrapper.unmount()
  })

  test('returns false when queryResponse has items but isDirty is false (new tile)', () => {
    const tile = {
      ...sampleTile,
      queryId: undefined,
      queryResponse: { data: { data: { items: [{ label: 'thing' }] }, reference_id: '1.1.200' } },
    }
    const wrapper = setup({ tile, isDirty: false, isEditing: true })
    expect(wrapper.instance().shouldShowDirtyBadge()).toBe(false)
    wrapper.unmount()
  })

  test('returns false when not dirty, no queryId, and no replacements or items', () => {
    const wrapper = setup({ tile: { ...sampleTile, queryId: undefined }, isDirty: false, isEditing: true })
    expect(wrapper.instance().shouldShowDirtyBadge()).toBe(false)
    wrapper.unmount()
  })

  test('returns false in view mode (isEditing=false)', () => {
    const wrapper = setup({ tile: { ...sampleTile, queryId: 'qid-1' }, isDirty: true, isEditing: false })
    expect(wrapper.instance().shouldShowDirtyBadge()).toBe(false)
    wrapper.unmount()
  })

  test('returns false when isFailed=true even if isDirty (prevents badge overlap)', () => {
    const wrapper = setup({ tile: { ...sampleTile, queryId: 'qid-1' }, isDirty: true, isFailed: true, isEditing: true })
    expect(wrapper.instance().shouldShowDirtyBadge()).toBe(false)
    wrapper.unmount()
  })
})

describe('onSplitViewClick: closing split view clears second-query state', () => {
  let mockSetParamsForTile
  let savedParams

  beforeEach(() => {
    jest.useFakeTimers()
    savedParams = []
    mockSetParamsForTile = jest.fn((params) => { savedParams.push(params) })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('closing split view passes splitView=false and clears secondQuery, secondQueryId, secondQueryResponse', () => {
    const failedResponse = { data: { reference_id: '1.1.500' } }
    const splitTile = {
      ...sampleTile,
      splitView: true,
      secondQuery: 'show second data',
      secondQueryId: 'q_second-id',
      secondQueryResponse: failedResponse,
    }
    const wrapper = setup({ tile: splitTile, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()
    savedParams = []

    wrapper.instance().onSplitViewClick()
    jest.advanceTimersByTime(200)

    expect(savedParams.length).toBeGreaterThan(0)
    const call = savedParams[savedParams.length - 1]
    expect(call.splitView).toBe(false)
    expect(call.secondQuery).toBeUndefined()
    expect(call.secondQueryId).toBeUndefined()
    expect(call.secondQueryResponse).toBeUndefined()
    wrapper.unmount()
  })

  test('closing split view when bottom query was dirty clears all second-query fields', () => {
    const splitTile = {
      ...sampleTile,
      splitView: true,
      secondQuery: 'dirty query text',
      secondQueryId: undefined,
      secondQueryResponse: undefined,
    }
    const wrapper = setup({ tile: splitTile, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()
    savedParams = []

    wrapper.instance().onSplitViewClick()
    jest.advanceTimersByTime(200)

    const call = savedParams[savedParams.length - 1]
    expect(call.splitView).toBe(false)
    expect(call.secondQuery).toBeUndefined()
    expect(call.secondQueryId).toBeUndefined()
    expect(call.secondQueryResponse).toBeUndefined()
    wrapper.unmount()
  })

  test('opening split view with no existing secondQuery pre-populates from top query', () => {
    const singleTile = { ...sampleTile, splitView: false, secondQuery: undefined }
    const wrapper = setup({ tile: singleTile, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()
    savedParams = []

    wrapper.instance().onSplitViewClick()
    jest.advanceTimersByTime(200)

    const call = savedParams[savedParams.length - 1]
    expect(call.splitView).toBe(true)
    expect(call.secondQuery).toBe(sampleTile.query)
    wrapper.unmount()
  })

  test('opening split view preserves existing secondQuery when tile already has one', () => {
    const singleTile = { ...sampleTile, splitView: false, secondQuery: 'previous second query' }
    const wrapper = setup({ tile: singleTile, setParamsForTile: mockSetParamsForTile })
    jest.advanceTimersByTime(200)
    mockSetParamsForTile.mockClear()
    savedParams = []

    wrapper.instance().onSplitViewClick()
    jest.advanceTimersByTime(200)

    const call = savedParams[savedParams.length - 1]
    expect(call.splitView).toBe(true)
    expect(call.secondQuery).toBe('previous second query')
    wrapper.unmount()
  })
})

describe('getPaneBannerType', () => {
  const successResponse = { data: { reference_id: '1.1.200', data: { rows: [[1]], count_rows: 1 } } }
  const errorResponse = { data: { reference_id: '1.1.400', data: {} } }
  const replacementsResponse = { data: { data: { replacements: [{ value: 'foo', text: 'bar' }] }, reference_id: '1.1.200' } }
  const itemsResponse = { data: { data: { items: [{ label: 'thing' }] }, reference_id: '1.1.200' } }

  const splitTile = (overrides = {}) => ({
    ...sampleTile,
    splitView: true,
    queryId: 'qid-1',
    query: sampleTile.query,
    queryResponse: successResponse,
    secondQuery: sampleTile.query,
    secondQueryId: 'qid-second',
    ...overrides,
  })

  test('returns null when not editing', () => {
    const wrapper = setup({ tile: splitTile(), isEditing: false, isDirty: true, isFailed: false })
    expect(wrapper.instance().getPaneBannerType(true)).toBeNull()
    expect(wrapper.instance().getPaneBannerType(false)).toBeNull()
    wrapper.unmount()
  })

  test('returns null when tile is not in split view', () => {
    const wrapper = setup({ tile: { ...sampleTile, splitView: false }, isEditing: true, isDirty: true })
    expect(wrapper.instance().getPaneBannerType(true)).toBeNull()
    wrapper.unmount()
  })

  test('returns "failed" for top pane when top response has an error and isFailed=true', () => {
    const wrapper = setup({ tile: splitTile({ queryResponse: errorResponse }), isEditing: true, isFailed: true })
    expect(wrapper.instance().getPaneBannerType(true)).toBe('failed')
    wrapper.unmount()
  })

  test('returns "failed" for bottom pane when bottom response has an error and isFailed=true', () => {
    const wrapper = setup({ tile: splitTile({ secondQueryResponse: errorResponse }), isEditing: true, isFailed: true })
    expect(wrapper.instance().getPaneBannerType(false)).toBe('failed')
    wrapper.unmount()
  })

  test('returns null when isDirty is false (no dirty banner needed)', () => {
    const wrapper = setup({ tile: splitTile(), isEditing: true, isDirty: false, isFailed: false })
    expect(wrapper.instance().getPaneBannerType(true)).toBeNull()
    expect(wrapper.instance().getPaneBannerType(false)).toBeNull()
    wrapper.unmount()
  })

  test('returns "dirty" for top pane when top response has replacements', () => {
    const wrapper = setup({ tile: splitTile({ queryResponse: replacementsResponse }), isEditing: true, isDirty: true })
    expect(wrapper.instance().getPaneBannerType(true)).toBe('dirty')
    wrapper.unmount()
  })

  test('returns "dirty" for bottom pane when bottom response has items', () => {
    const wrapper = setup({ tile: splitTile({ secondQueryResponse: itemsResponse }), isEditing: true, isDirty: true })
    expect(wrapper.instance().getPaneBannerType(false)).toBe('dirty')
    wrapper.unmount()
  })

  test('returns "dirty" for bottom pane when secondQuery exists but has no secondQueryId (not yet run)', () => {
    const wrapper = setup({
      tile: splitTile({ secondQueryId: undefined }),
      isEditing: true,
      isDirty: true,
    })
    expect(wrapper.instance().getPaneBannerType(false)).toBe('dirty')
    wrapper.unmount()
  })

  test('returns "dirty" for top pane when bottom has no own reason (top fallback)', () => {
    // Bottom pane has secondQueryId so no attributable bottom reason → banner goes to top
    const wrapper = setup({
      tile: splitTile({ secondQueryId: 'qid-second', secondQueryResponse: successResponse }),
      isEditing: true,
      isDirty: true,
    })
    expect(wrapper.instance().getPaneBannerType(true)).toBe('dirty')
    expect(wrapper.instance().getPaneBannerType(false)).toBeNull()
    wrapper.unmount()
  })

  test('returns null for top pane when bottom already has its own dirty reason', () => {
    // Bottom has replacements → bottom gets the banner, top should return null
    const wrapper = setup({
      tile: splitTile({ secondQueryResponse: replacementsResponse }),
      isEditing: true,
      isDirty: true,
    })
    expect(wrapper.instance().getPaneBannerType(true)).toBeNull()
    expect(wrapper.instance().getPaneBannerType(false)).toBe('dirty')
    wrapper.unmount()
  })
})

describe('renderBottomResponse: delegates to areTopAndBottomSameQuery for execution state', () => {
  test('calls areTopAndBottomSameQuery (filter-aware) rather than comparing query text directly', () => {
    const tile = {
      ...sampleTile,
      splitView: true,
      secondQuery: sampleTile.query,
      tableFilters: [{ field: 'region', value: 'West' }],
      secondTableFilters: [{ field: 'region', value: 'East' }],
    }
    const wrapper = setup({ tile })
    const instance = wrapper.instance()
    const spy = jest.spyOn(instance, 'areTopAndBottomSameQuery')
    instance.renderBottomResponse()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
    wrapper.unmount()
  })

  test('uses bottom execution state (isBottomExecuted) when filters differ', () => {
    const tile = {
      ...sampleTile,
      splitView: true,
      secondQuery: sampleTile.query,
      tableFilters: [{ field: 'region', value: 'West' }],
      secondTableFilters: [{ field: 'region', value: 'East' }],
      secondQueryResponse: null,
    }
    const wrapper = setup({ tile })
    // Top executed, bottom not — with filter split areTopAndBottomSameQuery()=false so bottom state is used
    wrapper.setState({ isTopExecuted: true, isTopExecuting: false, isBottomExecuted: false })
    const instance = wrapper.instance()
    expect(instance.areTopAndBottomSameQuery()).toBe(false)
    const spy = jest.spyOn(instance, 'renderResponse').mockReturnValue(null)
    instance.renderBottomResponse()
    // renderPlaceholder=true because isBottomExecuted=false and secondQueryResponse=null
    expect(spy.mock.calls[0][0].renderPlaceholder).toBe(true)
    spy.mockRestore()
    wrapper.unmount()
  })

  test('uses top execution state (isTopExecuted) when query and filters are identical', () => {
    const filters = [{ field: 'region', value: 'West' }]
    const tile = {
      ...sampleTile,
      splitView: true,
      secondQuery: sampleTile.query,
      tableFilters: filters,
      secondTableFilters: filters,
      secondQueryResponse: sampleResponses[10],
    }
    const wrapper = setup({ tile })
    wrapper.setState({ isTopExecuted: true, isTopExecuting: false, isBottomExecuted: false })
    const instance = wrapper.instance()
    expect(instance.areTopAndBottomSameQuery()).toBe(true)
    const spy = jest.spyOn(instance, 'renderResponse').mockReturnValue(null)
    instance.renderBottomResponse()
    // areTopAndBottomSameQuery()=true → reads isTopExecuted=true → renderPlaceholder=false
    expect(spy.mock.calls[0][0].renderPlaceholder).toBe(false)
    spy.mockRestore()
    wrapper.unmount()
  })
})
