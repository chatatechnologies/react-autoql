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
