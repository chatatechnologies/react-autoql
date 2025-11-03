import { QueryOutput } from '../QueryOutput'
import { ColumnTypes, isColumnNumberType } from 'autoql-fe-utils'

describe('QueryOutput pivot invariants', () => {
  test('simple pivot generates axis and value columns with defaults', () => {
    // Create a minimal context to call the method without mounting the component
    // instantiate a component instance (class fields are initialized in constructor)
    const instance = new QueryOutput({})

    // Minimal getColumns result: groupable string column + numeric column
    const columns = [
      { name: 'Group', display_name: 'Group', is_visible: true, groupable: true, type: 'STRING' },
      // Use a realistic numeric type from response fixtures so isColumnNumberType returns true
      { name: 'Value', display_name: 'Value', is_visible: true, groupable: false, type: 'DOLLAR_AMT' },
    ]

    // override instance methods/state that generatePivotTableData expects
    instance.getColumns = () => columns
    instance.tableConfig = { legendColumnIndex: 1, stringColumnIndex: 0, numberColumnIndex: 1 }
    instance.formattedTableParams = {}
    instance.setPivotTableConfig = () => {}
    instance._isMounted = false

    // Sample table data: [group, value]
    const tableData = [
      ['A', 10],
      ['B', 5],
      ['A', 3],
    ]

    // Quick pre-checks to catch why pivot generation may no-op
    const colsFromInstance = instance.getColumns()
    expect(colsFromInstance).toBeDefined()
    const visibleGroupables = colsFromInstance.filter((c) => c.is_visible && c.groupable)
    expect(visibleGroupables.length).toBe(1)
    const numberColumnFound = colsFromInstance.find((c) => c.is_visible && !c.groupable && isColumnNumberType(c))
    expect(numberColumnFound).toBeDefined()

    // Call the instance method
    // Provide table data via queryResponse as the generator reads it from there
    instance.queryResponse = { data: { data: { rows: tableData } } }
    instance.generatePivotTableData({ isFirstGeneration: true })

    // Sanity checks
    expect(instance.pivotTableColumns).toBeDefined()
    // Generator may create one axis column + one column per unique legend value
    expect(instance.pivotTableColumns.length).toBeGreaterThanOrEqual(2)

    const axisCol = instance.pivotTableColumns[0]
    const valueCol = instance.pivotTableColumns[1]

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
