import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput } from '../QueryOutput'
import { ColumnTypes, isColumnNumberType } from 'autoql-fe-utils'
import { coerceToNumber, coerceExistingCellToNumber, initPivotNumericCells, ensureRowNumericCells } from '../pivotUtils'

function makeInstanceWithColumns(columns, tableConfig) {
  const instance = new QueryOutput({})
  instance.getColumns = () => columns
  instance.tableConfig = tableConfig
  instance.formattedTableParams = {}
  instance.setPivotTableConfig = () => {}
  instance._isMounted = false
  return instance
}

describe('pivotUtils helpers', () => {
  test('coerceToNumber parses formatted numeric strings and numbers', () => {
    expect(coerceToNumber(123)).toBe(123)
    expect(coerceToNumber('$1,234.56')).toBeCloseTo(1234.56)
    expect(Number.isNaN(coerceToNumber('abc'))).toBeTruthy()
  })

  test('coerceExistingCellToNumber handles null/empty/string/number', () => {
    expect(coerceExistingCellToNumber(null)).toBe(0)
    expect(coerceExistingCellToNumber(undefined)).toBe(0)
    expect(coerceExistingCellToNumber('')).toBe(0)
    expect(coerceExistingCellToNumber('$2,000')).toBe(2000)
    expect(coerceExistingCellToNumber(42)).toBe(42)
  })

  test('initPivotNumericCells initializes numeric cells to null', () => {
    const matrix = [[], [], []]
    initPivotNumericCells(matrix, 3, 4)
    for (let r = 0; r < 3; r++) {
      expect(matrix[r][0]).toBeNull()
      expect(matrix[r][1]).toBeNull()
      expect(matrix[r][2]).toBeNull()
      expect(matrix[r][3]).toBeNull()
    }
  })

  test('ensureRowNumericCells ensures row has numeric nulls for missing indices', () => {
    const row = ['header']
    ensureRowNumericCells(row, 4)
    expect(row[0]).toBe('header')
    expect(row[1]).toBeNull()
    expect(row[2]).toBeNull()
    expect(row[3]).toBeNull()
  })
})

describe('QueryOutput pivot invariants', () => {
  test('simple pivot generates axis and value columns with defaults', () => {
    const instance = new QueryOutput({})

    const columns = [
      { name: 'Group', display_name: 'Group', is_visible: true, groupable: true, type: 'STRING' },
      { name: 'Value', display_name: 'Value', is_visible: true, groupable: false, type: 'DOLLAR_AMT' },
    ]

    instance.getColumns = () => columns
    instance.tableConfig = { legendColumnIndex: 1, stringColumnIndex: 0, numberColumnIndex: 1 }
    instance.formattedTableParams = {}
    instance.setPivotTableConfig = () => {}
    instance._isMounted = false

    const tableData = [
      ['A', 10],
      ['B', 5],
      ['A', 3],
    ]

    const colsFromInstance = instance.getColumns()
    expect(colsFromInstance).toBeDefined()
    const visibleGroupables = colsFromInstance.filter((c) => c.is_visible && c.groupable)
    expect(visibleGroupables.length).toBe(1)
    const numberColumnFound = colsFromInstance.find((c) => c.is_visible && !c.groupable && isColumnNumberType(c))
    expect(numberColumnFound).toBeDefined()

    instance.queryResponse = { data: { data: { rows: tableData } } }
    instance.generatePivotTableData({ isFirstGeneration: true })

    expect(instance.pivotTableColumns).toBeDefined()
    expect(instance.pivotTableColumns.length).toBeGreaterThanOrEqual(2)

    const axisCol = instance.pivotTableColumns[0]
    const valueCol = instance.pivotTableColumns[1]

    expect(axisCol.field).toBe('0')
    expect(axisCol.cssClass).toBe('pivot-category')
    expect(axisCol.pivot === true || axisCol.pivot === undefined).toBeTruthy()
    expect(axisCol.visible).toBeTruthy()

    expect(valueCol.origValues).toBeDefined()
    expect(typeof valueCol.origValues).toBe('object')
    expect(valueCol.origColumn).toBeDefined()
    expect(valueCol.field).toBe('1')
  })
})

describe('QueryOutput pivot - Reorder robustness', () => {
  test('pivot still generates when columns are reordered visually', () => {
    const instance = new QueryOutput({})

    const oldColumns = [
      { name: 'Group', display_name: 'Group', is_visible: true, groupable: true, type: ColumnTypes.STRING },
      { name: 'Legend', display_name: 'Legend', is_visible: true, groupable: true, type: ColumnTypes.STRING },
      { name: 'Value', display_name: 'Value', is_visible: true, groupable: false, type: ColumnTypes.DOLLAR_AMT },
    ]

    const newColumns = [oldColumns[2], oldColumns[0], oldColumns[1]]

    instance.getColumns = () => newColumns
    instance.tableConfig = { legendColumnIndex: 1, stringColumnIndex: 0, numberColumnIndex: 2 }
    instance.formattedTableParams = {}
    instance.setPivotTableConfig = () => {}
    instance._isMounted = false

    const tableData = [
      [1724656, 'A', 'L1'],
      [526858, 'A', 'L1'],
      [392256, 'B', 'L2'],
      [375771, 'B', 'L2'],
    ]

    instance.queryResponse = { data: { data: { rows: tableData } } }
    instance.tableData = tableData
    instance.props.onTableConfigChange = () => {}

    instance.generatePivotTableData({ isFirstGeneration: true })

    expect(instance.pivotTableData).toBeDefined()
    const flattened = instance.pivotTableData.flat()
    expect(flattened).toContain(1724656 + 526858)
    expect(flattened).toContain(392256 + 375771)
  })
})

describe('QueryOutput pivot - Add Column reproduction', () => {
  test('pivot sums numeric strings correctly when columns shift after adding columns', () => {
    const instance = new QueryOutput({})

    const columns = [
      { name: 'Group', display_name: 'Group', is_visible: true, groupable: true, type: ColumnTypes.STRING },
      { name: 'Extra', display_name: 'Extra', is_visible: true, groupable: true, type: ColumnTypes.STRING },
      { name: 'Meta', display_name: 'Meta', is_visible: true, groupable: false, type: ColumnTypes.STRING },
      { name: 'Value', display_name: 'Value', is_visible: true, groupable: false, type: ColumnTypes.DOLLAR_AMT },
    ]

    instance.getColumns = () => columns
    instance.tableConfig = { legendColumnIndex: 1, stringColumnIndex: 0, numberColumnIndex: 3 }
    instance.formattedTableParams = {}
    instance.setPivotTableConfig = () => {}
    instance._isMounted = false

    const tableData = [
      ['A', 'L1', 'x', 1724656],
      ['A', 'L1', 'x', 526858],
      ['B', 'L2', 'x', 392256],
      ['B', 'L2', 'x', 375771],
    ]

    instance.queryResponse = { data: { data: { rows: tableData } } }
    instance.generatePivotTableData({ isFirstGeneration: true })

    expect(instance.pivotTableData).toBeDefined()

    const flattened = instance.pivotTableData.flat()
    expect(flattened).toContain(1724656 + 526858)
    expect(flattened).toContain(392256 + 375771)
  })
})

describe('QueryOutput filter behavior in pivot generation', () => {
  const columns = [
    {
      id: 'c0',
      name: 'Group',
      display_name: 'Group',
      is_visible: true,
      groupable: true,
      type: ColumnTypes.STRING,
      field: '0',
      index: 0,
    },
    {
      id: 'c1',
      name: 'Legend',
      display_name: 'Legend',
      is_visible: true,
      groupable: true,
      type: ColumnTypes.STRING,
      field: '1',
      index: 1,
    },
    {
      id: 'c2',
      name: 'Meta',
      display_name: 'Meta',
      is_visible: true,
      groupable: false,
      type: ColumnTypes.STRING,
      field: '2',
      index: 2,
    },
    {
      id: 'c3',
      name: 'Value',
      display_name: 'Value',
      is_visible: true,
      groupable: false,
      type: ColumnTypes.DOLLAR_AMT,
      field: '3',
      index: 3,
    },
  ]

  const tableData = [
    ['A', 'L1', 'x', 100],
    ['A', 'L1', 'x', 200],
    ['B', 'L2', 'x', 400],
  ]

  test("applies filter when filter references column by string field '1'", () => {
    const instance = makeInstanceWithColumns(columns, {
      legendColumnIndex: 1,
      stringColumnIndex: 0,
      numberColumnIndex: 3,
    })
    instance.formattedTableParams = { filters: [{ id: 'c1', value: 'L1', operator: '=' }] }
    instance.queryResponse = { data: { data: { rows: tableData } } }
    instance.generatePivotTableData({ isFirstGeneration: true })

    const flattened = instance.pivotTableData.flat()
    expect(flattened).toContain(300)
    expect(flattened).not.toContain(400)
  })

  test('applies filter when filter references column by id', () => {
    const instance = makeInstanceWithColumns(columns, {
      legendColumnIndex: 1,
      stringColumnIndex: 0,
      numberColumnIndex: 3,
    })
    instance.formattedTableParams = { filters: [{ id: 'c1', value: 'L2', operator: '=' }] }
    instance.queryResponse = { data: { data: { rows: tableData } } }
    instance.generatePivotTableData({ isFirstGeneration: true })

    const flattened = instance.pivotTableData.flat()
    expect(flattened).toContain(400)
    expect(flattened).not.toContain(300)
  })

  test('applies filter when filter references column by name', () => {
    const instance = makeInstanceWithColumns(columns, {
      legendColumnIndex: 1,
      stringColumnIndex: 0,
      numberColumnIndex: 3,
    })
    instance.formattedTableParams = { filters: [{ id: 'c1', value: 'L1', operator: '=' }] }
    instance.queryResponse = { data: { data: { rows: tableData } } }
    instance.generatePivotTableData({ isFirstGeneration: true })

    const flattened = instance.pivotTableData.flat()
    expect(flattened).toContain(300)
    expect(flattened).not.toContain(400)
  })
})

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

    const wrapper = mount(<QueryOutput queryResponse={testCase} initialDisplayType='pivot_table' queryFn={() => {}} />)

    const instance = wrapper.instance()
    instance.getColumns = () =>
      testCase.data.data.columns.map((col, i) => ({
        ...col,
        field: `${i}`,
        id: `col-${i}`,
        index: i,
        is_visible: true,
      }))
    instance.tableConfig = {
      stringColumnIndex: 0,
      stringColumnIndices: [0],
      legendColumnIndex: 1,
      numberColumnIndex: 2,
      numberColumnIndices: [2],
      numberColumnIndices2: [],
    }
    instance.tableData = testCase.data.data.rows

    instance.generatePivotData({ isFirstGeneration: true })

    const pivot = instance.pivotTableData
    expect(pivot).toBeDefined()

    const rowIndexA = pivot.findIndex((r) => r[0] === 'A')
    const rowIndexB = pivot.findIndex((r) => r[0] === 'B')

    expect(pivot[rowIndexA][1]).toBe(15)
    expect(pivot[rowIndexA][2]).toBe(3)
    expect(pivot[rowIndexB][1]).toBe(2)
    expect(pivot[rowIndexB][2]).toBeUndefined()

    wrapper.unmount()
  })

  test('aggregates numeric values for date pivot table by month/year', () => {
    const jan2021 = 1609459200
    const feb2021 = 1612137600

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

    const wrapper = mount(<QueryOutput queryResponse={testCase} initialDisplayType='pivot_table' queryFn={() => {}} />)

    const instance = wrapper.instance()
    instance.tableConfig = {
      stringColumnIndex: 0,
      stringColumnIndices: [0],
      legendColumnIndex: 0,
      numberColumnIndex: 1,
      numberColumnIndices: [1],
      numberColumnIndices2: [],
    }

    instance.generatePivotData({ isFirstGeneration: true })

    const pivot = instance.pivotTableData
    const cols = instance.pivotTableColumns

    expect(pivot).toBeDefined()
    expect(cols).toBeDefined()

    const flattened = pivot.flat()
    expect(flattened).toContain(30)
    expect(flattened).toContain(5)

    wrapper.unmount()
  })
})
