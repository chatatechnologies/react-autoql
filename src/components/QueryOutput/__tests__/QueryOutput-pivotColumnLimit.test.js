import { QueryOutput } from '../QueryOutput'
import {
  PIVOT_OTHER_COLUMN_NAME,
  naturalCompare,
  isOrdinalPivotHeader,
  getPivotColumnMagnitudes,
  selectPivotColumnHeaders,
  canAggregateIntoOther,
} from '../pivotUtils'

// The pivot keeps at most MAX_PIVOT_TABLE_COLUMNS columns, and the chart is drawn from the
// pivot. Cutting the alphabetical tail dropped "Temple" - the biggest participant - from a
// stacked bar chart of a 10k-row answer.

describe('pivotUtils column limit helpers', () => {
  test('naturalCompare orders counters numerically', () => {
    expect(['Round 10', 'Round 2', 'Round 1'].sort(naturalCompare)).toEqual(['Round 1', 'Round 2', 'Round 10'])
    expect(['b', 'a', 'C'].sort(naturalCompare)).toEqual(['a', 'b', 'C'])
  })

  describe('isOrdinalPivotHeader', () => {
    test('dates are ordinal', () => {
      expect(isOrdinalPivotHeader(['x'], true)).toBe(true)
    })

    test('plain numbers are ordinal', () => {
      expect(isOrdinalPivotHeader(['1', '2', 10])).toBe(true)
    })

    test('a shared label with a counter is ordinal', () => {
      expect(isOrdinalPivotHeader(['Round 1', 'round 2', 'Round 12'])).toBe(true)
    })

    test('names are not', () => {
      expect(isOrdinalPivotHeader(['Temple', 'Ames'])).toBe(false)
      expect(isOrdinalPivotHeader(['Round 1', 'Week 2'])).toBe(false)
      expect(isOrdinalPivotHeader([])).toBe(false)
    })
  })

  test('getPivotColumnMagnitudes sums absolute values per header', () => {
    const magnitudes = getPivotColumnMagnitudes(
      [
        ['r1', 'A', 5],
        ['r2', 'A', -7],
        ['r1', 'B', 1],
        ['r1', 'C', 'not a number'],
      ],
      1,
      2,
    )
    expect(magnitudes.get('A')).toBe(12)
    expect(magnitudes.get('B')).toBe(1)
    expect(magnitudes.has('C')).toBe(false)
  })

  describe('selectPivotColumnHeaders', () => {
    const headers = ['a', 'b', 'c', 'd', 'e']
    const magnitudes = new Map([
      ['a', 1],
      ['b', 50],
      ['c', 2],
      ['d', 3],
      ['e', 40],
    ])

    test('leaves headers alone under the limit', () => {
      expect(selectPivotColumnHeaders({ headers, maxColumns: 5, magnitudes })).toEqual({
        keptHeaders: headers,
        droppedHeaders: [],
      })
    })

    test('keeps the largest, in display order', () => {
      expect(selectPivotColumnHeaders({ headers, maxColumns: 3, magnitudes })).toEqual({
        keptHeaders: ['b', 'd', 'e'],
        droppedHeaders: ['a', 'c'],
      })
    })

    test('gives one slot of the limit to "Other"', () => {
      expect(selectPivotColumnHeaders({ headers, maxColumns: 3, magnitudes, reserveOther: true })).toEqual({
        keptHeaders: ['b', 'e'],
        droppedHeaders: ['a', 'c', 'd'],
      })
    })

    test('keeps ordinal headers in order regardless of size', () => {
      expect(selectPivotColumnHeaders({ headers, maxColumns: 3, magnitudes, isOrdinal: true })).toEqual({
        keptHeaders: ['a', 'b', 'c'],
        droppedHeaders: ['d', 'e'],
      })
    })
  })

  test('canAggregateIntoOther only allows values that add up', () => {
    expect(canAggregateIntoOther({ type: 'QUANTITY' })).toBe(true)
    expect(canAggregateIntoOther({ type: 'DOLLAR_AMT', aggType: 'SUM' })).toBe(true)
    expect(canAggregateIntoOther({ type: 'QUANTITY', aggType: 'COUNT' })).toBe(true)
    expect(canAggregateIntoOther({ type: 'DOLLAR_AMT', aggType: 'AVG' })).toBe(false)
    expect(canAggregateIntoOther({ type: 'PERCENT' })).toBe(false)
    expect(canAggregateIntoOther({ type: 'RATIO' })).toBe(false)
    expect(canAggregateIntoOther(undefined)).toBe(false)
  })
})

describe('QueryOutput pivot column limit', () => {
  const MAX = 100
  const ROWS = ['Week A', 'Week B']

  // "Aaa", "Aab", ... all sort before "Temple".
  const smallNames = (count) =>
    Array.from(
      { length: count },
      (_, i) => `A${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`,
    )

  const buildPivot = ({ legendValues, valueFor, numberColumn = {} }) => {
    const instance = new QueryOutput({})
    const columns = [
      { name: 'week', display_name: 'Week', is_visible: true, groupable: true, type: 'STRING' },
      { name: 'participant', display_name: 'Participant', is_visible: true, groupable: true, type: 'STRING' },
      { name: 'trades', display_name: 'Trades', is_visible: true, type: 'QUANTITY', ...numberColumn },
    ]

    instance.getColumns = () => columns
    instance.tableConfig = { stringColumnIndex: 0, legendColumnIndex: 1, numberColumnIndex: 2 }
    instance.formattedTableParams = {}
    instance.setPivotTableConfig = () => {}
    instance._isMounted = false

    const rows = []
    ROWS.forEach((week) => legendValues.forEach((name) => rows.push([week, name, valueFor(name)])))
    instance.queryResponse = { data: { data: { rows } } }
    instance.generatePivotTableData({ isFirstGeneration: true })
    return instance
  }

  const columnTitles = (instance) => instance.pivotTableColumns.slice(1).map((col) => col.title)
  const rowFor = (instance, week) => instance.pivotTableData.find((row) => row[0] === week)

  test('keeps the largest column even when it sorts last alphabetically', () => {
    const names = [...smallNames(120), 'Temple']
    const instance = buildPivot({ legendValues: names, valueFor: (name) => (name === 'Temple' ? 1000 : 1) })

    expect(instance.pivotTableColumns.length - 1).toBe(MAX)
    expect(columnTitles(instance)).toContain('Temple')
    expect(instance.pivotTableDataLimited).toBe(true)
    expect(instance.pivotTableTotalColumns).toBe(121)
  })

  test('kept columns stay alphabetical with "Other" last', () => {
    const names = [...smallNames(120), 'Temple']
    const instance = buildPivot({ legendValues: names, valueFor: (name) => (name === 'Temple' ? 1000 : 1) })
    const titles = columnTitles(instance)
    const kept = titles.slice(0, -1)

    expect([...kept].sort(naturalCompare)).toEqual(kept)
    expect(titles[titles.length - 1]).toBe('Other (22)')
  })

  test('"Other" holds the total of the dropped columns, so row totals are unchanged', () => {
    const names = smallNames(150)
    const instance = buildPivot({ legendValues: names, valueFor: () => 2 })
    const other = instance.pivotTableColumns[instance.pivotTableColumns.length - 1]

    expect(other.isPivotOtherColumn).toBe(true)
    expect(other.name).toBe(PIVOT_OTHER_COLUMN_NAME)
    expect(other.title).toBe('Other (51)')

    const row = rowFor(instance, 'Week A')
    expect(row[other.index]).toBe(51 * 2)
    const rowTotal = row.slice(1).reduce((sum, v) => sum + (Number(v) || 0), 0)
    expect(rowTotal).toBe(150 * 2)
  })

  test('ordinal columns keep the first rounds in order, not the largest', () => {
    const names = Array.from({ length: 120 }, (_, i) => `Round ${120 - i}`)
    const instance = buildPivot({ legendValues: names, valueFor: (name) => (name === 'Round 120' ? 1000 : 1) })
    const titles = columnTitles(instance)

    expect(titles.slice(0, 3)).toEqual(['Round 1', 'Round 2', 'Round 3'])
    expect(titles).toContain('Round 99')
    expect(titles).not.toContain('Round 120')
    expect(instance.pivotTableColumnsKeptInOrder).toBe(true)
  })

  test('no "Other" when the values do not add up', () => {
    const names = [...smallNames(120), 'Temple']
    const instance = buildPivot({
      legendValues: names,
      valueFor: (name) => (name === 'Temple' ? 1000 : 1),
      numberColumn: { aggType: 'AVG' },
    })

    expect(instance.pivotTableColumns.length - 1).toBe(MAX)
    expect(instance.pivotTableColumns.some((col) => col.isPivotOtherColumn)).toBe(false)
    expect(columnTitles(instance)).toContain('Temple')
  })

  test('no "Other" and no limit under the column limit', () => {
    const instance = buildPivot({ legendValues: smallNames(10), valueFor: () => 1 })

    expect(instance.pivotTableDataLimited).toBe(false)
    expect(instance.pivotTableColumns.some((col) => col.isPivotOtherColumn)).toBe(false)
    expect(instance.getPivotColumnLimitMessage()).toBeUndefined()
  })

  describe('limit message', () => {
    test('names the column limit, not the row limit', () => {
      const instance = buildPivot({ legendValues: smallNames(150), valueFor: () => 1 })
      const message = instance.getPivotColumnLimitMessage()

      expect(message).toMatch(/limited to <em>100<\/em> columns/)
      expect(message).toMatch(/<em>150<\/em>/)
      expect(message).toMatch(/largest totals/)
      expect(message).toMatch(/combined into "Other"/)
      expect(message).not.toMatch(/rows/)
    })

    test('says ordinal columns are kept in order', () => {
      const names = Array.from({ length: 120 }, (_, i) => `Round ${i + 1}`)
      const message = buildPivot({ legendValues: names, valueFor: () => 1 }).getPivotColumnLimitMessage()
      expect(message).toMatch(/first <em>99<\/em> are shown in order/)
    })

    test('says columns are left out when there is no "Other"', () => {
      const message = buildPivot({
        legendValues: smallNames(150),
        valueFor: () => 1,
        numberColumn: { type: 'PERCENT' },
      }).getPivotColumnLimitMessage()
      expect(message).toMatch(/other <em>50<\/em> are left out/)
    })
  })

  describe('drilldown on "Other"', () => {
    test('is ignored from the chart', () => {
      const instance = buildPivot({ legendValues: smallNames(150), valueFor: () => 1 })
      instance.processDrilldown = jest.fn()
      const columns = instance.pivotTableColumns
      const otherIndex = columns.length - 1

      instance.onChartClick({
        row: rowFor(instance, 'Week A'),
        columnIndex: otherIndex,
        columns,
        stringColumnIndex: 0,
        legendColumn: instance.getColumns()[1],
      })
      expect(instance.processDrilldown).not.toHaveBeenCalled()

      instance.onChartClick({
        row: rowFor(instance, 'Week A'),
        columnIndex: 1,
        columns,
        stringColumnIndex: 0,
        legendColumn: instance.getColumns()[1],
      })
      expect(instance.processDrilldown).toHaveBeenCalled()
    })

    test('is ignored from the table', () => {
      const instance = buildPivot({ legendValues: smallNames(150), valueFor: () => 1 })
      instance.processDrilldown = jest.fn()
      const cell = {
        getColumn: () => ({ getDefinition: () => ({ isPivotOtherColumn: true }) }),
        getValue: () => 5,
      }

      instance.onTableCellClick(cell)
      expect(instance.processDrilldown).not.toHaveBeenCalled()
    })
  })
})
