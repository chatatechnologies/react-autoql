import { QueryOutput } from '../QueryOutput'

describe('QueryOutput pivot invariants', () => {
  test('simple pivot generates axis and value columns with defaults', () => {
    // Create a minimal context to call the method without mounting the component
    const ctx = {}

    // Minimal getColumns result: groupable string column + numeric column
    const columns = [
      { name: 'Group', display_name: 'Group', is_visible: true, groupable: true, type: 'STRING' },
      { name: 'Value', display_name: 'Value', is_visible: true, groupable: false, type: 'NUMBER' },
    ]

    ctx.getColumns = () => columns
    ctx.tableConfig = { legendColumnIndex: 1, stringColumnIndex: 0, numberColumnIndex: 1 }
    ctx.formattedTableParams = {}
    ctx.setPivotTableConfig = () => {}
    ctx._isMounted = false

    // Sample table data: [group, value]
    const tableData = [
      ['A', 10],
      ['B', 5],
      ['A', 3],
    ]

    // Call the class method with our context
    QueryOutput.prototype.generatePivotTableData.call(ctx, { isFirstGeneration: true, tableData })

    // Sanity checks
    expect(ctx.pivotTableColumns).toBeDefined()
    expect(ctx.pivotTableColumns.length).toBe(2)

    const axisCol = ctx.pivotTableColumns[0]
    const valueCol = ctx.pivotTableColumns[1]

    // Axis column should be pivot category and have expected flags
    expect(axisCol.field).toBe('0')
    expect(axisCol.cssClass).toBe('pivot-category')
    expect(axisCol.pivot === true || axisCol.pivot === undefined).toBeTruthy()
    // visible flag comes from defaults
    expect(axisCol.visible).toBeTruthy()

    // Value column should contain origValues object and origColumn reference
    expect(valueCol.origValues).toBeDefined()
    expect(typeof valueCol.origValues).toBe('object')
    expect(valueCol.origColumn).toBeDefined()
    expect(valueCol.field).toBe('1')
  })
})
