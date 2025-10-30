import { QueryOutput } from '../QueryOutput'
import { ColumnTypes } from 'autoql-fe-utils'

describe.skip('QueryOutput pivot - Add Column reproduction', () => {
  test('pivot sums numeric strings correctly when columns shift after adding columns', () => {
    const instance = new QueryOutput({})

    // Columns: index positions matter; simulate an added column so numeric column is at index 3
    const columns = [
      { name: 'Group', display_name: 'Group', is_visible: true, groupable: true, type: ColumnTypes.STRING },
      { name: 'Extra', display_name: 'Extra', is_visible: true, groupable: true, type: ColumnTypes.STRING },
      { name: 'Meta', display_name: 'Meta', is_visible: true, groupable: false, type: ColumnTypes.STRING },
      // Numeric column sits at index 3 (after two groupables and an extra column)
      { name: 'Value', display_name: 'Value', is_visible: true, groupable: false, type: ColumnTypes.DOLLAR_AMT },
    ]

    // Table config points to which indices are string/legend/number
    instance.getColumns = () => columns
    instance.tableConfig = { legendColumnIndex: 1, stringColumnIndex: 0, numberColumnIndex: 3 }
    instance.formattedTableParams = {}
    instance.setPivotTableConfig = () => {}
    instance._isMounted = false

    // Table data rows: [group, legend, meta, value]
    const tableData = [
      ['A', 'L1', 'x', '$1,724,656.00'],
      ['A', 'L1', 'x', '$526,858.00'],
      ['B', 'L2', 'x', '$392,256.00'],
      ['B', 'L2', 'x', '$375,771.00'],
    ]

    // Call the pivot generator with provided data
    instance.generatePivotTableData({ isFirstGeneration: true, tableData })

    // Expect pivotTableData is defined and has rows for A and B
    expect(instance.pivotTableData).toBeDefined()
    // Debug: pivotTableData inspected during development (removed log)

    // Instead of relying on which axis was chosen (the generator may swap axes),
    // just assert the expected numeric sums are present in the pivot table data
    const flattened = instance.pivotTableData.flat()

    expect(flattened).toContain(1724656 + 526858) // 2,251,514
    expect(flattened).toContain(392256 + 375771) // 768,027
  })
})
