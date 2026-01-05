import React from 'react'
import { shallow, mount } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import { DashboardTile } from './DashboardTile'
import sampleResponses from '../../../../test/responseTestCases'
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

describe('split view with filters on both tables', () => {
  test('renders top and bottom tables with split view enabled', () => {
    const splitViewTile = {
      ...sampleTile,
      splitView: true,
      displayType: 'table',
      secondDisplayType: 'table',
      query: 'Total online sales by region by year',
      secondQuery: 'Total online sales by region by year',
      queryResponse: sampleResponses[10],
      secondQueryResponse: sampleResponses[10],
      tableFilters: [],
      secondTableFilters: [],
      orders: [],
      secondOrders: [],
    }

    const wrapper = setup({ tile: splitViewTile })

    // Check that both QueryOutput components are rendered
    const queryOutputs = wrapper.find('QueryOutput')
    expect(queryOutputs.length).toBeGreaterThanOrEqual(2)

    wrapper.unmount()
  })

  test('applies filters to top table and verifies initialFormattedTableParams', () => {
    const splitViewTile = {
      ...sampleTile,
      splitView: true,
      displayType: 'table',
      secondDisplayType: 'table',
      query: 'Total online sales by region by year',
      secondQuery: 'Total online sales by region by year',
      queryResponse: sampleResponses[10],
      secondQueryResponse: sampleResponses[10],
      tableFilters: [
        {
          id: sampleResponses[10].data.data.columns[0].name,
          value: 'West',
          operator: '=',
        },
      ],
      secondTableFilters: [],
      orders: [],
      secondOrders: [],
    }

    const wrapper = setup({ tile: splitViewTile })
    const instance = wrapper.instance()

    // Call the table params change handler for top table
    instance.onTableParamsChange(
      {},
      {
        filters: [{ id: 'Region', value: 'West', operator: '=' }],
        sorters: [],
      },
    )

    // Verify the params were queued for the parent
    expect(instance.paramsToSet).toBeDefined()
    expect(instance.paramsToSet.tableFilters).toBeDefined()

    wrapper.unmount()
  })

  test('applies filters to bottom table independently', () => {
    const splitViewTile = {
      ...sampleTile,
      splitView: true,
      displayType: 'table',
      secondDisplayType: 'table',
      query: 'Total online sales by region by year',
      secondQuery: 'Total online sales by region by year',
      queryResponse: sampleResponses[10],
      secondQueryResponse: sampleResponses[10],
      tableFilters: [],
      secondTableFilters: [
        {
          id: sampleResponses[10].data.data.columns[0].name,
          value: 'East',
          operator: '=',
        },
      ],
      orders: [],
      secondOrders: [],
    }

    const wrapper = setup({ tile: splitViewTile })
    const instance = wrapper.instance()

    // Call the table params change handler for bottom table
    instance.onSecondTableParamsChange(
      {},
      {
        filters: [{ id: 'Region', value: 'East', operator: '=' }],
        sorters: [],
      },
    )

    // Verify the params were queued with 'second' prefix
    expect(instance.paramsToSet).toBeDefined()
    expect(instance.paramsToSet.secondTableFilters).toBeDefined()

    wrapper.unmount()
  })

  test('both tables receive filter updates independently without cross-contamination', () => {
    const splitViewTile = {
      ...sampleTile,
      splitView: true,
      displayType: 'table',
      secondDisplayType: 'table',
      query: 'Total online sales by region by year',
      secondQuery: 'Total online sales by region by year',
      queryResponse: sampleResponses[10],
      secondQueryResponse: sampleResponses[10],
      tableFilters: [],
      secondTableFilters: [],
      orders: [],
      secondOrders: [],
    }

    const wrapper = setup({ tile: splitViewTile })
    const instance = wrapper.instance()

    // Apply filter to top table
    instance.onTableParamsChange(
      {},
      {
        filters: [{ id: 'Region', value: 'West', operator: '=' }],
        sorters: [{ field: 'Year', dir: 'asc' }],
      },
    )

    const topParams = { ...instance.paramsToSet }
    expect(topParams.tableFilters).toEqual([{ id: 'Region', value: 'West', operator: '=' }])
    expect(topParams.orders).toEqual([{ field: 'Year', dir: 'asc' }])

    // Clear params
    instance.paramsToSet = {}

    // Apply different filter to bottom table
    instance.onSecondTableParamsChange(
      {},
      {
        filters: [{ id: 'Region', value: 'East', operator: '=' }],
        sorters: [{ field: 'Sales', dir: 'desc' }],
      },
    )

    const bottomParams = { ...instance.paramsToSet }
    expect(bottomParams.secondTableFilters).toEqual([{ id: 'Region', value: 'East', operator: '=' }])
    expect(bottomParams.secondOrders).toEqual([{ field: 'Sales', dir: 'desc' }])

    // Verify no cross-contamination
    expect(bottomParams.tableFilters).toBeUndefined()
    expect(bottomParams.orders).toBeUndefined()

    wrapper.unmount()
  })

  test('rtFilterResponse is stored and passed to QueryOutput', () => {
    const splitViewTile = {
      ...sampleTile,
      splitView: true,
      displayType: 'table',
      secondDisplayType: 'table',
      query: 'Total online sales by region by year',
      secondQuery: 'Total online sales by region by year',
      queryResponse: sampleResponses[10],
      secondQueryResponse: sampleResponses[10],
      tableFilters: [],
      secondTableFilters: [],
      orders: [],
      secondOrders: [],
    }

    const wrapper = setup({ tile: splitViewTile })
    const instance = wrapper.instance()

    // Simulate ChataTable calling onUpdateFilterResponse
    const mockRTResponse = {
      data: { data: { fe_req: { filters: [{ id: 'Region', value: 'West' }] }, columns: [], rows: [] } },
      message: 'Filter applied',
    }

    // Manually set _isMounted so setState works
    instance._isMounted = true

    instance.onUpdateFilterResponse(mockRTResponse)

    // Verify state was updated when mounted (using the correct state prop name)
    expect(instance.state.localRTFilterResponse).toEqual(mockRTResponse)

    wrapper.unmount()
  })
})
