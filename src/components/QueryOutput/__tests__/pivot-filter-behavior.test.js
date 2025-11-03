import { QueryOutput } from '../QueryOutput'
import { ColumnTypes } from 'autoql-fe-utils'

function makeInstanceWithColumns(columns, tableConfig) {
  const instance = new QueryOutput({})
  instance.getColumns = () => columns
  instance.tableConfig = tableConfig
  instance.formattedTableParams = {}
  instance.setPivotTableConfig = () => {}
  instance._isMounted = false
  return instance
}

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

describe('QueryOutput filter behavior in pivot generation', () => {
  test("applies filter when filter references column by string field '1'", () => {
    const instance = makeInstanceWithColumns(columns, {
      legendColumnIndex: 1,
      stringColumnIndex: 0,
      numberColumnIndex: 3,
    })
    // Use column id filtering (supported by generator)
    instance.formattedTableParams = { filters: [{ id: 'c1', value: 'L1', operator: '=' }] }

    // Provide queryResponse rows so generator has data to operate on
    instance.queryResponse = { data: { data: { rows: tableData } } }
    instance.generatePivotTableData({ isFirstGeneration: true })

    // Expect only L1 values present (100 + 200 = 300)
    const flattened = instance.pivotTableData.flat()
    // debug output removed
    // Ensure expected sum present and other legend sum absent
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

    // Expect only L2 values present (400)
    const flattened = instance.pivotTableData.flat()
    // debug removed
    expect(flattened).toContain(400)
    expect(flattened).not.toContain(300)
  })

  test('applies filter when filter references column by name', () => {
    const instance = makeInstanceWithColumns(columns, {
      legendColumnIndex: 1,
      stringColumnIndex: 0,
      numberColumnIndex: 3,
    })
    // Use column id filtering (supported by generator)
    instance.formattedTableParams = { filters: [{ id: 'c1', value: 'L1', operator: '=' }] }
    instance.queryResponse = { data: { data: { rows: tableData } } }
    instance.generatePivotTableData({ isFirstGeneration: true })

    const flattened = instance.pivotTableData.flat()
    // debug removed
    expect(flattened).toContain(300)
    expect(flattened).not.toContain(400)
  })
})
