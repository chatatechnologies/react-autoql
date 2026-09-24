import React from 'react'
import { shallow } from 'enzyme'
import { getAuthentication, getAutoQLConfig, runQuery, runCachedDashboardQueryPost } from 'autoql-fe-utils'
import { DashboardTile } from '../DashboardTile'
import { buildDashboardSource } from '../../dashboardSource'

// Characterizes what DashboardTile derives from its tile: the request processQuery sends, and the
// data-driven props it hands QueryOutput. Written before that mapping was shared with the report
// builder, so the extraction can be shown to change nothing — these expectations must not be edited
// to make a refactor pass.

const AUTH = { token: 'dash-token', apiKey: 'dash-key', domain: 'https://dash.example' }

const makeTile = (overrides = {}) => ({ i: 'tile-1', key: 'tile-1', query: 'total sales by region', ...overrides })

const shallowTile = (props) =>
  shallow(<DashboardTile setParamsForTile={() => {}} authentication={AUTH} dashboardId='dash-1' {...props} />)

// Runs processQuery with the network call stubbed out and returns what it would have sent.
const captureRequest = (props, processArgs = {}) => {
  const wrapper = shallowTile(props)
  const instance = wrapper.instance()
  const spy = jest.spyOn(instance, 'executeQueryWithForceRetry').mockResolvedValue({})
  instance.processQuery({ query: props.tile.query, axiosSource: { token: 'cancel-token' }, ...processArgs })
  const [requestData, queryFunction] = spy.mock.calls[0]
  wrapper.unmount()
  return { requestData, queryFunction }
}

// The request fields that don't come from the tile, given the props these tests use.
const commonRequest = ({ autoQLConfig, isEditing, dashboardId = 'dash-1' } = {}) => ({
  ...getAuthentication(AUTH),
  ...getAutoQLConfig(autoQLConfig),
  enableQueryValidation: !isEditing ? false : getAutoQLConfig(autoQLConfig).enableQueryValidation,
  skipQueryValidation: undefined,
  source: buildDashboardSource({ dashboardId, isProjectDashboard: undefined, isEditing }),
  scope: 'dashboards',
  userSelection: undefined,
  cancelToken: 'cancel-token',
  query: 'total sales by region',
  force: false,
})

describe('DashboardTile processQuery request', () => {
  const fullTile = {
    displayType: 'column',
    pageSize: 500,
    columnSelects: [{ columns: ['sum(amount)'] }],
    displayOverrides: [{ index: 1, type: 'QUANTITY' }],
    filters: [{ name: 'region', value: 'West' }],
    orders: [{ name: 'amount', sort: 'DESC' }],
    tableFilters: [{ name: 'region', type: '=', value: 'West' }],
    queryId: 'q-123',
  }

  it('sends the tile’s columns, overrides, filters, orders and page size for a chart', () => {
    const { requestData, queryFunction } = captureRequest({ tile: makeTile(fullTile) })

    expect(queryFunction).toBe(runQuery)
    expect(requestData).toStrictEqual({
      ...commonRequest(),
      newColumns: fullTile.columnSelects,
      displayOverrides: fullTile.displayOverrides,
      filters: fullTile.filters,
      orders: fullTile.orders,
      tableFilters: fullTile.tableFilters,
      pageSize: 500,
      sourceQuery: 'q-123',
    })
  })

  it('falls back to the dashboard page size for a chart with none of its own', () => {
    const { requestData } = captureRequest({ tile: makeTile({ ...fullTile, pageSize: undefined }), dataPageSize: 250 })
    expect(requestData.pageSize).toBe(250)
  })

  it('sends no page size for a table, even when the tile has one', () => {
    const { requestData } = captureRequest({ tile: makeTile({ ...fullTile, displayType: 'table' }) })
    expect(requestData).toHaveProperty('pageSize', undefined)
  })

  it('appends dashboard slicers to the tile’s own session filters', () => {
    const slicer = { name: 'segment', value: 'Enterprise' }
    const { requestData } = captureRequest({ tile: makeTile(fullTile), dashboardSlicers: [slicer] })
    expect(requestData.filters).toStrictEqual([...fullTile.filters, slicer])
  })

  it('treats missing tile filters as none', () => {
    const { requestData } = captureRequest({ tile: makeTile({ ...fullTile, filters: undefined }) })
    expect(requestData.filters).toStrictEqual([])
  })

  it('drops the tile’s query tweaks on reset but still applies slicers', () => {
    const slicer = { name: 'segment', value: 'Enterprise' }
    const { requestData } = captureRequest({ tile: makeTile(fullTile), dashboardSlicers: [slicer] }, { isReset: true })
    expect(requestData).toStrictEqual({
      ...commonRequest(),
      newColumns: [],
      displayOverrides: [],
      filters: [slicer],
      orders: [],
      tableFilters: [],
      pageSize: 500,
      sourceQuery: 'q-123',
    })
  })

  it('only validates the query while the dashboard is being edited', () => {
    const autoQLConfig = { enableQueryValidation: true }
    const viewing = captureRequest({ tile: makeTile(fullTile), autoQLConfig })
    const editing = captureRequest({ tile: makeTile(fullTile), autoQLConfig, isEditing: true })

    expect(viewing.requestData.enableQueryValidation).toBe(false)
    expect(editing.requestData.enableQueryValidation).toBe(true)
    expect(editing.requestData.source).toBe(
      buildDashboardSource({ dashboardId: 'dash-1', isProjectDashboard: undefined, isEditing: true }),
    )
  })

  it('scopes auth and config to the tile’s own project on a multi-project dashboard', () => {
    const projectAuth = { token: 'project-token', apiKey: 'project-key', domain: 'https://project.example' }
    const { requestData } = captureRequest({
      tile: makeTile({ ...fullTile, projectId: 'p-2' }),
      autoQLConfig: { projectId: 'p-1' },
      getAuthenticationForProject: (id) => (id === 'p-2' ? projectAuth : undefined),
    })

    expect(requestData).toMatchObject({ ...getAuthentication(projectAuth), projectId: 'p-2' })
  })

  it('uses the cached-tile endpoint for a cached refresh', () => {
    const { requestData, queryFunction } = captureRequest(
      { tile: makeTile(fullTile), tileKey: 'tile-1' },
      { isCachedRefresh: true },
    )
    expect(queryFunction).toBe(runCachedDashboardQueryPost)
    expect(requestData).toMatchObject({ dashboardId: 'dash-1', tileKey: 'tile-1', queryIndex: 0 })
  })
})

// Captures the props renderTopResponse would hand QueryOutput, without mounting it.
const captureQueryOutputProps = (props) => {
  const wrapper = shallowTile(props)
  const instance = wrapper.instance()
  let captured
  instance.renderResponse = ({ queryOutputProps }) => {
    captured = queryOutputProps
    return null
  }
  instance.renderTopResponse()
  wrapper.unmount()
  return captured
}

// Every prop renderTopResponse passes today. Adding or losing one is a behaviour change.
const QUERY_OUTPUT_PROP_NAMES = [
  'allowCustomColumnsOnDrilldown',
  'bucketSize',
  'dataPageSize',
  'defaultSelectedSuggestion',
  'disableAggregationMenu',
  'enableChartControls',
  'initialAggConfig',
  'initialAxisSorts',
  'initialChartControls',
  'initialColumnOrder',
  'initialDisplayType',
  'initialFormattedTableParams',
  'initialFrozenColumns',
  'initialIsFiltering',
  'initialNetworkColumnConfig',
  'initialTableConfigs',
  'isDashboardEditing',
  'key',
  'legendFilterConfig',
  'lockedFilters',
  'onAggConfigChange',
  'onAxisSortChange',
  'onBucketSizeChange',
  'onChartControlsChange',
  'onColumnChange',
  'onColumnOrderChange',
  'onDisplayTypeChange',
  'onDrilldownEnd',
  'onDrilldownStart',
  'onFrozenColumnsChange',
  'onLegendFilterChange',
  'onNetworkColumnChange',
  'onNewQueryId',
  'onNoneOfTheseClick',
  'onPageSizeChange',
  'onQueryValidationSelectOption',
  'onSuggestionClick',
  'onTableConfigChange',
  'onTableParamsChange',
  'optionsToolbarRef',
  'queryId',
  'queryRequestData',
  'queryResponse',
  'queryValidationSelections',
  'ref',
  'reportProblemCallback',
  'skipInitialFilters',
  'vizToolbarRef',
]

const response = (columns) => ({ data: { data: { columns, rows: [['West', 1]] } } })

describe('DashboardTile QueryOutput props', () => {
  it('passes exactly the same set of props', () => {
    const props = captureQueryOutputProps({ tile: makeTile() })
    expect(Object.keys(props).sort()).toStrictEqual(QUERY_OUTPUT_PROP_NAMES)
  })

  it('maps a fully configured tile', () => {
    const queryResponse = response([
      { index: 0, name: 'region', type: 'STRING' },
      { index: 1, name: 'amount', type: 'DOLLAR_AMT' },
    ])
    const tile = makeTile({
      displayType: 'column',
      queryResponse,
      queryId: 'q-123',
      pageSize: 500,
      bucketSize: 10,
      aggConfig: { amount: 'sum' },
      dataConfig: {
        tableConfig: { numberColumnIndex: 1, stringColumnIndex: 0 },
        pivotTableConfig: { numberColumnIndices: [1], stringColumnIndices: [0] },
        columnOverrides: { 1: { type: 'QUANTITY', precision: 0 } },
        extraSetting: 'kept',
      },
      columnVisibility: { region: true, amount: false },
      queryValidationSelections: [{ id: 'v' }],
      defaultSelectedSuggestion: 'sales by region',
      networkColumnConfig: { sourceColumnIndex: 0 },
      legendFilterConfig: { West: false },
      axisSorts: [{ x: 'asc' }, null, { y: 'desc' }],
      columnOrder: ['amount', 'region'],
      frozenColumns: ['region'],
      tableFilters: [{ name: 'region', value: 'West' }],
      orders: [{ name: 'amount', sort: 'DESC' }],
      filters: [{ name: 'segment', value: 'SMB' }],
      chartControls: { showAverageLine: true, showRegressionLine: false },
    })
    const props = captureQueryOutputProps({
      tile,
      isEditing: true,
      disableAggregationMenu: true,
      allowCustomColumnsOnDrilldown: true,
    })

    expect(props).toMatchObject({
      initialDisplayType: 'column',
      queryResponse,
      queryId: 'q-123',
      initialTableConfigs: {
        extraSetting: 'kept',
        columnOverrides: { 1: { type: 'QUANTITY', precision: 0 } },
        columnVisibility: { region: true, amount: false },
        pivotTableConfig: { numberColumnIndices: [1], stringColumnIndices: [0] },
        tableConfig: { numberColumnIndex: 1, stringColumnIndex: 0 },
      },
      initialAggConfig: { amount: 'sum' },
      queryValidationSelections: [{ id: 'v' }],
      defaultSelectedSuggestion: 'sales by region',
      dataPageSize: 500,
      bucketSize: 10,
      initialNetworkColumnConfig: { sourceColumnIndex: 0 },
      legendFilterConfig: { West: false },
      initialAxisSorts: { x: 'asc', y: 'desc' },
      initialColumnOrder: ['amount', 'region'],
      initialFrozenColumns: ['region'],
      initialFormattedTableParams: {
        filters: [{ name: 'region', value: 'West' }],
        sorters: [{ name: 'amount', sort: 'DESC' }],
        sessionFilters: [{ name: 'segment', value: 'SMB' }],
      },
      lockedFilters: [{ name: 'region', value: 'West' }],
      enableChartControls: true,
      initialChartControls: { showAverageLine: true, showRegressionLine: false },
      isDashboardEditing: true,
      disableAggregationMenu: true,
      allowCustomColumnsOnDrilldown: true,
      skipInitialFilters: true,
    })
    expect(Object.keys(props.initialTableConfigs).sort()).toStrictEqual([
      'columnOverrides',
      'columnVisibility',
      'extraSetting',
      'pivotTableConfig',
      'tableConfig',
    ])
  })

  // transformQueryResponse gives every column a fresh uuid, so a saved column's id never matches a
  // new response's and the match falls through to display_name, as it does on real dashboards.
  it('rebuilds column overrides from legacy saved columns when the data config has none', () => {
    const tile = makeTile({
      queryResponse: response([
        { id: 'fresh-0', index: 0, name: 'region', display_name: 'Region', type: 'STRING' },
        { id: 'fresh-1', index: 1, name: 'amount', display_name: 'Amount', type: 'DOLLAR_AMT', precision: 2 },
      ]),
      columns: [
        { id: 'saved-1', index: 1, name: 'amount', display_name: 'Amount', type: 'QUANTITY', precision: 0 },
        { id: 'saved-0', index: 0, name: 'region', display_name: 'Region', type: 'STRING' },
        { id: 'saved-x', name: 'no-index-so-ignored', display_name: 'X', type: 'QUANTITY' },
      ],
    })
    const { initialTableConfigs } = captureQueryOutputProps({ tile })

    expect(initialTableConfigs).toStrictEqual({
      columnOverrides: { 1: { type: 'QUANTITY', precision: 0 } },
      columnVisibility: undefined,
    })
  })

  // Pinned as-is, not endorsed: with no ids on either side, `oc.id === savedCol.id` is
  // undefined === undefined, so every saved column matches the first response column.
  it('matches id-less legacy columns to the first response column', () => {
    const tile = makeTile({
      queryResponse: response([
        { index: 0, name: 'region', type: 'STRING' },
        { index: 1, name: 'amount', type: 'DOLLAR_AMT', precision: 2 },
      ]),
      columns: [{ index: 1, name: 'amount', type: 'QUANTITY', precision: 0 }],
    })
    const { initialTableConfigs } = captureQueryOutputProps({ tile })

    expect(initialTableConfigs.columnOverrides).toStrictEqual({ 0: { type: 'QUANTITY', precision: 0 } })
  })

  it('strips a pivot config saved with no columns, and the table config with it', () => {
    const tile = makeTile({
      dataConfig: {
        tableConfig: { numberColumnIndex: 1 },
        pivotTableConfig: { numberColumnIndices: [], stringColumnIndices: [] },
      },
    })
    const { initialTableConfigs } = captureQueryOutputProps({ tile })

    expect(initialTableConfigs).toStrictEqual({ columnOverrides: {}, columnVisibility: undefined })
  })

  it('fills defaults for a bare tile', () => {
    const props = captureQueryOutputProps({ tile: makeTile() })

    expect(props).toMatchObject({
      initialTableConfigs: { columnOverrides: {}, columnVisibility: undefined },
      initialAxisSorts: {},
      initialFormattedTableParams: { filters: undefined, sorters: undefined, sessionFilters: [] },
      lockedFilters: [],
      initialChartControls: { showAverageLine: false, showRegressionLine: false },
      enableChartControls: true,
      skipInitialFilters: true,
    })
  })
})
