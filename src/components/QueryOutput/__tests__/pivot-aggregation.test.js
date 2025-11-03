import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput as QueryOutputWithoutTheme } from '../../QueryOutput/QueryOutput'

describe('QueryOutput pivot aggregation', () => {
  test('aggregates numeric values for regular pivot table', () => {
    const testCase = {
      data: {
        data: {
          columns: [
            { display_name: 'Category', type: 'STRING', groupable: true, name: 'category' },
            { display_name: 'Series', type: 'STRING', groupable: true, name: 'series' },
            { display_name: 'Amount', type: 'NUMBER', groupable: false, name: 'amount' },
          ],
          rows: [
            ['A', 'X', 10],
            ['A', 'X', 5],
            ['A', 'Y', 3],
            ['B', 'X', 2],
          ],
        },
      },
    }

    const wrapper = mount(
      <QueryOutputWithoutTheme queryResponse={testCase} initialDisplayType='pivot_table' queryFn={() => {}} />,
    )

    const instance = wrapper.instance()
    // pivotTableData row shape: [ rowHeader, col0, col1, ... ]
    // Ensure table config is set for the simple test (string index 0, legend 1, number 2)
    instance.tableConfig = {
      stringColumnIndex: 0,
      stringColumnIndices: [0],
      legendColumnIndex: 1,
      numberColumnIndex: 2,
      numberColumnIndices: [2],
      numberColumnIndices2: [],
    }

    // Trigger pivot generation explicitly (constructor may not have set tableConfig correctly in test env)
    instance.generatePivotData({ isFirstGeneration: true })

    const pivot = instance.pivotTableData
    // pivot table should now be populated
    expect(pivot).toBeDefined()

    const rowIndexA = pivot.findIndex((r) => r[0] === 'A')
    const rowIndexB = pivot.findIndex((r) => r[0] === 'B')

    // Columns order should be sorted: ['X','Y'] -> fields 1 and 2
    expect(pivot[rowIndexA][1]).toBe(15) // 10 + 5
    expect(pivot[rowIndexA][2]).toBe(3)

    expect(pivot[rowIndexB][1]).toBe(2)
    // B has no value for 'Y' so cell should be undefined
    expect(pivot[rowIndexB][2]).toBeUndefined()

    wrapper.unmount()
  })

  test('aggregates numeric values for date pivot table by month/year', () => {
    // Timestamps are in seconds (same format used in responseTestCases)
    const jan2021 = 1609459200 // 2021-01-01
    const feb2021 = 1612137600 // 2021-02-01

    const testCase = {
      data: {
        data: {
          columns: [
            { type: 'DATE', groupable: true, active: false, name: 'transaction_date' },
            { type: 'DOLLAR_AMT', groupable: false, active: false, name: 'sales' },
          ],
          rows: [
            [jan2021, 10],
            [feb2021, 5],
            [jan2021, 20],
          ],
        },
      },
    }

    const wrapper = mount(
      <QueryOutputWithoutTheme queryResponse={testCase} initialDisplayType='pivot_table' queryFn={() => {}} />,
    )

    const instance = wrapper.instance()
    // For date pivot, ensure tableConfig is set and regenerate pivot data
    // For date pivot, set tableConfig to use date column at index 0 and number at index 1
    instance.tableConfig = {
      stringColumnIndex: 0,
      stringColumnIndices: [0],
      legendColumnIndex: 0,
      numberColumnIndex: 1,
      numberColumnIndices: [1],
      numberColumnIndices2: [],
    }

    // Regenerate pivot data explicitly
    instance.generatePivotData({ isFirstGeneration: true })

    const pivot = instance.pivotTableData
    const cols = instance.pivotTableColumns
    // pivotTableData and pivotTableColumns should now be populated

    expect(pivot).toBeDefined()
    expect(cols).toBeDefined()

    // The generator may format date labels differently in test env; assert aggregated sums exist
    const flattened = pivot.flat()
    // Expect aggregated sums 30 and 5 to be present
    expect(flattened).toContain(30)
    expect(flattened).toContain(5)

    wrapper.unmount()
  })
})
