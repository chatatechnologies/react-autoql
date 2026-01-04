import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput } from '../QueryOutput'
import { ColumnTypes, isColumnNumberType } from 'autoql-fe-utils'
import { coerceToNumber, coerceExistingCellToNumber, initPivotNumericCells, ensureRowNumericCells } from '../pivotUtils'

describe('QueryOutput pivot suite', () => {
  describe('pivotUtils', () => {
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

  describe('QueryOutput pivot behavior', () => {
    it('attempts to generate pivot data when missing', () => {
      let props
      props = {
        authentication: {},
        onTableConfigChange: jest.fn(),
        queryResponse: {
          data: {
            data: {
              rows: [['a', 'b', 1]],
              columns: [
                { id: 'c0', index: 0, is_visible: true, type: 'STRING' },
                { id: 'c1', index: 1, is_visible: true, type: 'STRING' },
                { id: 'c2', index: 2, is_visible: true, type: 'NUMBER' },
              ],
            },
          },
        },
      }

      const wrapper = mount(<QueryOutput {...props} />)
      const instance = wrapper.instance()

      const formattedColumns = instance.formatColumnsForTable(props.queryResponse.data.data.columns)
      instance.tableData = props.queryResponse.data.data.rows
      wrapper.setState({ columns: formattedColumns })
      instance.setTableConfig(formattedColumns)

      instance.usePivotDataForChart = () => true
      instance.pivotTableData = []
      instance.pivotTableColumns = []
      instance.pivotTableConfig = undefined

      const genMock = jest.fn()
      instance.generatePivotTableData = genMock
      const configMock = jest.fn()
      instance.onTableConfigChange = configMock

      wrapper.update()
      const res = instance.renderChart()

      expect(res).toBeTruthy()
      expect(genMock).toHaveBeenCalled()

      wrapper.unmount()
    })

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

    test('applies filters correctly during pivot generation', () => {
      const makeInstanceWithColumns = (columns, tableConfig) => {
        const instance = new QueryOutput({})
        instance.getColumns = () => columns
        instance.tableConfig = tableConfig
        instance.formattedTableParams = {}
        instance.setPivotTableConfig = () => {}
        instance._isMounted = false
        return instance
      }

      const cols = [
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

      const inst1 = makeInstanceWithColumns(cols, { legendColumnIndex: 1, stringColumnIndex: 0, numberColumnIndex: 3 })
      inst1.formattedTableParams = { filters: [{ id: 'c1', value: 'L1', operator: '=' }] }
      inst1.queryResponse = { data: { data: { rows: tableData } } }
      inst1.generatePivotTableData({ isFirstGeneration: true })
      const flat1 = inst1.pivotTableData.flat()
      expect(flat1).toContain(300)
      expect(flat1).not.toContain(400)

      const inst2 = makeInstanceWithColumns(cols, { legendColumnIndex: 1, stringColumnIndex: 0, numberColumnIndex: 3 })
      inst2.formattedTableParams = { filters: [{ id: 'c1', value: 'L2', operator: '=' }] }
      inst2.queryResponse = { data: { data: { rows: tableData } } }
      inst2.generatePivotTableData({ isFirstGeneration: true })
      const flat2 = inst2.pivotTableData.flat()
      expect(flat2).toContain(400)
      expect(flat2).not.toContain(300)
    })

    describe('resolveColumnIndices unit tests', () => {
      it('respects explicit numberColumnIndex from tableConfig', () => {
        const instance = new QueryOutput({})
        const columns = [
          { name: 'Group', groupable: true, type: ColumnTypes.STRING },
          { name: 'Value', groupable: false, type: ColumnTypes.DOLLAR_AMT },
        ]

        const resolved = instance.resolveColumnIndices(columns, {
          stringColumnIndex: 0,
          legendColumnIndex: 1,
          numberColumnIndex: 1,
        })

        expect(resolved.sIdx).toBe(0)
        expect(resolved.lIdx).toBe(1)
        expect(resolved.nIdx).toBe(1)
      })

      it('finds a numeric column when number index not provided and avoids overlap', () => {
        const instance = new QueryOutput({})
        const columns = [
          { name: 'Group', groupable: true, type: ColumnTypes.STRING },
          { name: 'Extra', groupable: false, type: ColumnTypes.STRING },
          { name: 'Value', groupable: false, type: ColumnTypes.DOLLAR_AMT },
        ]

        const resolved = instance.resolveColumnIndices(columns, {
          stringColumnIndex: 0,
          legendColumnIndex: 1,
        })

        expect(resolved.sIdx).toBe(0)
        expect(resolved.lIdx).toBe(1)
        expect(resolved.nIdx).toBe(2)
      })

      it('falls back sensibly when no numeric column exists', () => {
        const instance = new QueryOutput({})
        const columns = [
          { name: 'Group', groupable: true, type: ColumnTypes.STRING },
          { name: 'Other', groupable: false, type: ColumnTypes.STRING },
        ]

        const resolved = instance.resolveColumnIndices(columns, {
          stringColumnIndex: 0,
          legendColumnIndex: 1,
        })

        // With only two columns, fallback will return a valid index
        expect(resolved.nIdx).toBeGreaterThanOrEqual(0)
        expect([0, 1]).toContain(resolved.sIdx)
        expect([0, 1]).toContain(resolved.lIdx)
      })

      it('ignores invalid explicit number index and finds first numeric', () => {
        const instance = new QueryOutput({})
        const columns = [
          { name: 'Group', groupable: true, type: ColumnTypes.STRING },
          { name: 'Meta', groupable: false, type: ColumnTypes.STRING },
          { name: 'Value', groupable: false, type: ColumnTypes.DOLLAR_AMT },
        ]

        const resolved = instance.resolveColumnIndices(columns, {
          stringColumnIndex: 0,
          legendColumnIndex: 1,
          numberColumnIndex: 99,
        })

        expect(resolved.nIdx).toBe(2)
      })
    })
  })
})
