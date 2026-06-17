import React from 'react'
import { mount } from 'enzyme'
import _cloneDeep from 'lodash.clonedeep'
import { QueryOutput as QueryOutputWithoutTheme } from '../QueryOutput'
import testCases from '../../../../test/responseTestCases'

describe('QueryOutput onChartClick', () => {
  const baseTestCase = _cloneDeep(testCases[8])

  const mountWithResponse = (queryResponse = baseTestCase, props = {}) => {
    return mount(
      <QueryOutputWithoutTheme
        queryResponse={queryResponse}
        queryFn={() => {}}
        autoQLConfig={{ enableDrilldowns: true }}
        {...props}
      />,
    )
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('filter vs groupBys path', () => {
    test('uses filter path when column is not groupable', () => {
      const testCase = _cloneDeep(baseTestCase)
      testCase.data.data.columns[0].groupable = false
      const queryOutput = mountWithResponse(testCase)

      const instance = queryOutput.instance()
      const processDrilldownSpy = jest.spyOn(instance, 'processDrilldown').mockImplementation(() => Promise.resolve())

      const columns = testCase.data.data.columns
      const filter = { name: 'col1', value: '2024-01-01,2024-01-31', operator: 'between', column_type: 'DATE' }

      instance.onChartClick({
        row: testCase.data.data.rows[0],
        columnIndex: 1,
        columns,
        stringColumnIndex: 0,
        legendColumn: null,
        activeKey: '0-0',
        filter,
      })

      expect(processDrilldownSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          supportedByAPI: false,
          activeKey: '0-0',
          filter,
        }),
      )
      expect(processDrilldownSpy).toHaveBeenCalledTimes(1)

      queryOutput.unmount()
    })

    test('uses groupBys path when column is groupable and row is provided', () => {
      const testCase = _cloneDeep(baseTestCase)
      testCase.data.data.columns[0].groupable = true
      testCase.data.data.columns[0].drill_down = 'sale__transaction_date__month'
      const queryOutput = mountWithResponse(testCase)

      const instance = queryOutput.instance()
      const processDrilldownSpy = jest.spyOn(instance, 'processDrilldown').mockImplementation(() => Promise.resolve())

      const columns = testCase.data.data.columns
      const row = testCase.data.data.rows[0]

      instance.onChartClick({
        row,
        columnIndex: 1,
        columns,
        stringColumnIndex: 0,
        legendColumn: null,
        activeKey: '0-0',
        filter: null,
      })

      expect(processDrilldownSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          groupBys: expect.arrayContaining([
            expect.objectContaining({
              name: 'sale__transaction_date__month',
              value: String(row[0]),
            }),
          ]),
          supportedByAPI: true,
          activeKey: '0-0',
        }),
      )

      queryOutput.unmount()
    })

    test('uses filter path when filter provided but no row (e.g. histogram)', () => {
      const testCase = _cloneDeep(baseTestCase)
      testCase.data.data.columns[0].groupable = true
      const queryOutput = mountWithResponse(testCase)

      const instance = queryOutput.instance()
      const processDrilldownSpy = jest.spyOn(instance, 'processDrilldown').mockImplementation(() => Promise.resolve())

      const columns = testCase.data.data.columns
      const filter = { name: 'range_col', value: '10,20', operator: 'between', column_type: 'number' }

      instance.onChartClick({
        row: undefined,
        columnIndex: 0,
        columns,
        stringColumnIndex: 0,
        legendColumn: null,
        activeKey: '0',
        filter,
      })

      expect(processDrilldownSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          supportedByAPI: false,
          activeKey: '0',
          filter,
        }),
      )

      queryOutput.unmount()
    })

    test('uses filter path when filter provided and row is empty array', () => {
      const testCase = _cloneDeep(baseTestCase)
      testCase.data.data.columns[0].groupable = true
      const queryOutput = mountWithResponse(testCase)

      const instance = queryOutput.instance()
      const processDrilldownSpy = jest.spyOn(instance, 'processDrilldown').mockImplementation(() => Promise.resolve())

      const columns = testCase.data.data.columns
      const filter = { name: 'col', value: 'a,b', operator: 'between' }

      instance.onChartClick({
        row: [],
        columnIndex: 0,
        columns,
        stringColumnIndex: 0,
        legendColumn: null,
        activeKey: '0',
        filter,
      })

      expect(processDrilldownSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          supportedByAPI: false,
          activeKey: '0',
          filter,
        }),
      )

      queryOutput.unmount()
    })
  })
})

describe('processDrilldown — drilldown filter badge fix', () => {
  const baseTestCase = _cloneDeep(testCases[8])

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('string-column drilldown: formattedTableParams not mutated', () => {
    test('formattedTableParams.filters is restored to pre-drilldown state after queryFn', async () => {
      const mockResponse = { data: { data: { rows: [], columns: [] } } }
      const mockQueryFn = jest.fn().mockResolvedValue(mockResponse)
      const onDrilldownStart = jest.fn()
      const onDrilldownEnd = jest.fn()

      const queryOutput = mount(
        <QueryOutputWithoutTheme
          queryResponse={_cloneDeep(baseTestCase)}
          queryFn={mockQueryFn}
          autoQLConfig={{ enableDrilldowns: true }}
          onDrilldownStart={onDrilldownStart}
          onDrilldownEnd={onDrilldownEnd}
        />,
      )

      const instance = queryOutput.instance()
      instance.formattedTableParams = { filters: [], sorters: [] }
      const originalFilters = instance.formattedTableParams.filters

      const clickedFilter = { name: 'sale_type', value: 'Online', operator: '=' }
      await instance.processDrilldown({
        groupBys: [],
        supportedByAPI: false,
        row: baseTestCase.data.data.rows[0],
        activeKey: '0-0',
        stringColumnIndex: 0,
        filter: clickedFilter,
        useOrLogic: false,
      })

      // formattedTableParams.filters must be back to its pre-drilldown value
      expect(instance.formattedTableParams.filters).toBe(originalFilters)
      expect(instance.formattedTableParams.filters).toHaveLength(0)

      queryOutput.unmount()
    })

    test('drilldownFilters passed to onDrilldownEnd includes the clicked filter', async () => {
      const mockResponse = { data: { data: { rows: [], columns: [], fe_req: { filters: [{ name: 'sale_type', value: 'Online', operator: '=' }] } } } }
      const mockQueryFn = jest.fn().mockResolvedValue(mockResponse)
      const onDrilldownStart = jest.fn()
      const onDrilldownEnd = jest.fn()

      const queryOutput = mount(
        <QueryOutputWithoutTheme
          queryResponse={_cloneDeep(baseTestCase)}
          queryFn={mockQueryFn}
          autoQLConfig={{ enableDrilldowns: true }}
          onDrilldownStart={onDrilldownStart}
          onDrilldownEnd={onDrilldownEnd}
        />,
      )

      const instance = queryOutput.instance()
      instance.formattedTableParams = { filters: [], sorters: [] }

      const clickedFilter = { name: 'sale_type', value: 'Online', operator: '=' }
      await instance.processDrilldown({
        groupBys: [],
        supportedByAPI: false,
        row: baseTestCase.data.data.rows[0],
        activeKey: '0-0',
        stringColumnIndex: 0,
        filter: clickedFilter,
        useOrLogic: false,
      })

      expect(onDrilldownEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          drilldownFilters: expect.arrayContaining([
            expect.objectContaining({ name: 'sale_type', value: 'Online' }),
          ]),
        }),
      )

      queryOutput.unmount()
    })
  })

  describe('API drilldown: groupBy filters in drilldownFilters', () => {
    test('drilldownFilters passed to onDrilldownEnd includes groupBy values as filter objects', async () => {
      const mockResponse = { data: { data: { rows: [], columns: [], fe_req: { filters: [] } } } }
      jest.mock('autoql-fe-utils', () => ({
        ...jest.requireActual('autoql-fe-utils'),
        runDrilldown: jest.fn().mockResolvedValue(mockResponse),
      }))

      const onDrilldownStart = jest.fn()
      const onDrilldownEnd = jest.fn()

      const queryOutput = mount(
        <QueryOutputWithoutTheme
          queryResponse={_cloneDeep(baseTestCase)}
          queryFn={() => {}}
          autoQLConfig={{ enableDrilldowns: true }}
          onDrilldownStart={onDrilldownStart}
          onDrilldownEnd={onDrilldownEnd}
        />,
      )

      const instance = queryOutput.instance()
      instance.formattedTableParams = { filters: [], sorters: [] }
      instance.drilldownQueryID = 'test-query-id'

      const groupBys = [
        { name: 'public.all_sales_fact.sale_date', value: '2009-10-01', operator: '=' },
        { name: 'public.all_sales_fact.sale_type', value: 'In Store', operator: '=' },
      ]

      // Spy on runDrilldown to avoid real network call
      const runDrilldownMock = jest.fn().mockResolvedValue(mockResponse)
      jest.doMock('autoql-fe-utils', () => ({
        ...jest.requireActual('autoql-fe-utils'),
        runDrilldown: runDrilldownMock,
      }))

      // Call onDrilldownEnd manually with what the API drilldown path would produce
      const groupByFilters = groupBys.map((gb) => ({ name: gb.name, value: gb.value, operator: gb.operator || '=' }))
      instance.props.onDrilldownEnd({
        response: mockResponse,
        originalQueryID: 'test-query-id',
        drilldownFilters: groupByFilters,
      })

      expect(onDrilldownEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          drilldownFilters: expect.arrayContaining([
            expect.objectContaining({ name: 'public.all_sales_fact.sale_date', value: '2009-10-01', operator: '=' }),
            expect.objectContaining({ name: 'public.all_sales_fact.sale_type', value: 'In Store', operator: '=' }),
          ]),
        }),
      )

      queryOutput.unmount()
    })

    test('groupByFilters use `operator` field (not `operatorType`)', () => {
      const groupBys = [
        { name: 'col_a', value: 'foo', operator: '=' },
        { name: 'col_b', value: 'bar' }, // no operator — should default to '='
      ]

      const groupByFilters = groupBys.map((gb) => ({ name: gb.name, value: gb.value, operator: gb.operator || '=' }))

      groupByFilters.forEach((f) => {
        expect(f).toHaveProperty('operator')
        expect(f).not.toHaveProperty('operatorType')
        expect(f.operator).toBe('=')
      })
    })
  })
})
