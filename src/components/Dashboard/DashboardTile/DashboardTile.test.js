import React from 'react'
import { shallow, mount } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import { DashboardTile } from './DashboardTile'
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
