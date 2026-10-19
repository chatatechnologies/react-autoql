import {
  buildSplitSeriesData,
  getSplitSeriesColumnIndices,
  getSplitSeriesValueTitle,
  SPLIT_SERIES_BLANK_KEY,
  SPLIT_SERIES_COUNT,
  SPLIT_SERIES_OTHER_KEY,
} from './splitSeriesUtils'

const columns = [
  { name: 'month', display_name: 'Month', type: 'DATE', is_visible: true, index: 0 },
  { name: 'region', display_name: 'Region', type: 'STRING', is_visible: true, index: 1 },
  { name: 'product', display_name: 'Product', type: 'STRING', is_visible: true, index: 2 },
  { name: 'sales', display_name: 'Sales', type: 'DOLLAR_AMT', aggType: 'SUM', is_visible: true, index: 3 },
]

const rows = [
  ['2024-01-01', 'East', 'A', 10],
  ['2024-01-05', 'West', 'B', 20],
  ['2024-02-01', 'East', 'A', 30],
  ['2024-02-03', null, 'B', 5],
]

describe('getSplitSeriesColumnIndices', () => {
  test('lists visible category columns other than the x-axis column', () => {
    expect(getSplitSeriesColumnIndices(columns, 1)).toEqual([2])
    expect(getSplitSeriesColumnIndices(columns, 0)).toEqual([1, 2])
  })

  test('skips hidden columns', () => {
    const withHidden = columns.map((col, i) => (i === 2 ? { ...col, is_visible: false } : col))
    expect(getSplitSeriesColumnIndices(withHidden, 0)).toEqual([1])
  })
})

describe('getSplitSeriesValueTitle', () => {
  test('names the aggregate', () => {
    expect(getSplitSeriesValueTitle(columns, 3)).toBe('Sales (Sum)')
    expect(getSplitSeriesValueTitle(columns, SPLIT_SERIES_COUNT)).toBe('Count')
  })
})

describe('buildSplitSeriesData', () => {
  test('appends one number column per value and keeps original indices', () => {
    const result = buildSplitSeriesData({ rows, columns, splitColumnIndex: 1, valueColumnIndex: 3 })

    expect(result.seriesColumnIndices).toEqual([4, 5, 6])
    expect(result.columns.slice(0, 4)).toEqual(columns)
    expect(result.columns.slice(4).map((col) => col.display_name)).toEqual(['East', 'West', '(Blank)'])
    expect(result.columns[6].splitSeriesKey).toBe(SPLIT_SERIES_BLANK_KEY)
    expect(result.columns[4].splitSeriesValue).toBe('East')

    // Values are separated, not summed
    expect(result.rows).toEqual([
      ['2024-01-01', 'East', 'A', 10, 10, null, null],
      ['2024-01-05', 'West', 'B', 20, null, 20, null],
      ['2024-02-01', 'East', 'A', 30, 30, null, null],
      ['2024-02-03', null, 'B', 5, null, null, 5],
    ])
  })

  test('count puts a 1 in each row and sums', () => {
    const result = buildSplitSeriesData({
      rows,
      columns,
      splitColumnIndex: 2,
      valueColumnIndex: SPLIT_SERIES_COUNT,
    })

    expect(result.rows.map((row) => row.slice(4))).toEqual([
      [1, null],
      [null, 1],
      [1, null],
      [null, 1],
    ])
    expect(result.columns[4].aggType).toBe('SUM')
    expect(result.columns[4].type).toBe('QUANTITY')
  })

  test('folds the smallest values into Other past the series limit', () => {
    const manyRows = [
      ['2024-01-01', 'A', 'x', 100],
      ['2024-01-01', 'B', 'x', 50],
      ['2024-01-01', 'C', 'x', 2],
      ['2024-01-01', 'D', 'x', 1],
    ]
    const result = buildSplitSeriesData({
      rows: manyRows,
      columns,
      splitColumnIndex: 1,
      valueColumnIndex: 3,
      maxSeries: 2,
    })

    expect(result.columns.slice(4).map((col) => col.display_name)).toEqual(['A', 'B', 'Other (2)'])
    expect(result.columns[6].splitSeriesKey).toBe(SPLIT_SERIES_OTHER_KEY)
    expect(result.columns[6].isPivotOtherColumn).toBe(true)
    expect(result.rows.map((row) => row.slice(4))).toEqual([
      [100, null, null],
      [null, 50, null],
      [null, null, 2],
      [null, null, 1],
    ])
    expect(result.otherSeriesCount).toBe(2)
  })

  test('marks hidden series', () => {
    const result = buildSplitSeriesData({
      rows,
      columns,
      splitColumnIndex: 1,
      valueColumnIndex: 3,
      hiddenSeriesKeys: ['West'],
    })

    expect(result.columns.slice(4).map((col) => !!col.isSeriesHidden)).toEqual([false, true, false])
  })

  test('returns undefined without a usable split or value column', () => {
    expect(buildSplitSeriesData({ rows, columns, splitColumnIndex: 9, valueColumnIndex: 3 })).toBeUndefined()
    expect(buildSplitSeriesData({ rows, columns, splitColumnIndex: 1, valueColumnIndex: 9 })).toBeUndefined()
    expect(buildSplitSeriesData({ rows: [], columns, splitColumnIndex: 1, valueColumnIndex: 3 })).toBeUndefined()
  })
})
