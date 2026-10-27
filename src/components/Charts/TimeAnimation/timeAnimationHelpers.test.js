import {
  buildTimeFrames,
  getAvailableGroupings,
  getDefaultGrouping,
  getFrameDrilldown,
  getGroupingOptions,
  getTimeAnimationColumnOptions,
  MAX_TIME_ANIMATION_FRAMES,
} from './timeAnimationHelpers'

const dateColumn = { name: 'sale_date', type: 'DATE', precision: 'DAY', groupable: false }
const columns = [{ name: 'region', type: 'STRING' }, dateColumn, { name: 'amount', type: 'DOLLAR_AMT' }]

const data = [
  ['East', '2024-01-15T00:00:00.000Z', 10],
  ['West', '2024-01-20T00:00:00.000Z', 5],
  // February is empty
  ['East', '2024-03-02T00:00:00.000Z', 7],
  ['West', null, 100],
]

describe('getTimeAnimationColumnOptions', () => {
  test('offers visible date and date string columns, minus the excluded ones', () => {
    const cols = [
      { type: 'STRING' },
      { type: 'DATE' },
      { type: 'DATE_STRING' },
      { type: 'DATE', is_visible: false },
      { type: 'QUANTITY' },
    ]
    expect(getTimeAnimationColumnOptions(cols)).toEqual([1, 2])
    expect(getTimeAnimationColumnOptions(cols, [1])).toEqual([2])
  })
})

describe('getTimeAnimationColumnOptions with every column', () => {
  test('offers date columns first, then the other visible columns, minus the excluded ones', () => {
    const cols = [
      { type: 'STRING' },
      { type: 'QUANTITY' },
      { type: 'DATE' },
      { type: 'STRING', is_visible: false },
      { type: 'DOLLAR_AMT' },
    ]
    expect(getTimeAnimationColumnOptions(cols, [4], true)).toEqual([2, 0, 1])
  })
})

describe('getGroupingOptions', () => {
  test('list data can be grouped into any period at or above the column precision', () => {
    expect(getGroupingOptions({ type: 'DATE', precision: 'DAY' }, false)).toEqual([
      'DAY',
      'WEEK',
      'MONTH',
      'QUARTER',
      'YEAR',
    ])
    expect(getGroupingOptions({ type: 'DATE', precision: 'MONTH' }, false)).toEqual(['MONTH', 'QUARTER', 'YEAR'])
    expect(getGroupingOptions({ type: 'DATE', precision: 'DATE_SECOND' }, false)).toHaveLength(5)
  })

  test('grouped data is locked to the query precision', () => {
    expect(getGroupingOptions({ type: 'DATE', precision: 'MONTH' }, true)).toEqual(['MONTH'])
  })

  test('date strings cannot be regrouped', () => {
    expect(getGroupingOptions({ type: 'DATE_STRING', precision: 'MONTHONLY' }, false)).toEqual([])
  })
})

describe('buildTimeFrames', () => {
  test('one frame per period, including empty periods, leaving out rows with no date', () => {
    const frames = buildTimeFrames({ data, columns, columnIndex: 1, grouping: 'MONTH' })
    expect(frames.map((frame) => frame.label)).toEqual(['January 2024', 'February 2024', 'March 2024'])
    expect(frames.map((frame) => frame.rows.length)).toEqual([2, 0, 1])
    expect(frames[0].start).toBe('2024-01-01T00:00:00.000Z')
    expect(frames[0].end).toBe('2024-01-31T23:59:59.999Z')
  })

  test('running totals hold every row up to each period', () => {
    const frames = buildTimeFrames({ data, columns, columnIndex: 1, grouping: 'MONTH', cumulative: true })
    expect(frames.map((frame) => frame.rows.length)).toEqual([2, 2, 3])
  })

  test('reads epoch-second dates', () => {
    const epochData = [
      ['East', 1705276800, 1],
      ['East', 1709337600, 1],
    ] // Jan 15 and Mar 2 2024
    const frames = buildTimeFrames({ data: epochData, columns, columnIndex: 1, grouping: 'QUARTER' })
    expect(frames).toHaveLength(1)
    expect(frames[0].rows).toHaveLength(2)
  })

  test('date strings make one frame per distinct value, in first-appearance order', () => {
    const cols = [{ name: 'month', type: 'DATE_STRING', precision: 'MONTHONLY' }]
    const frames = buildTimeFrames({ data: [['March'], ['April'], ['March']], columns: cols, columnIndex: 0 })
    expect(frames.map((frame) => frame.rawValue)).toEqual(['March', 'April'])
    expect(frames[0].rows).toHaveLength(2)
  })

  test('any other column makes one frame per distinct value, in first-appearance order', () => {
    const frames = buildTimeFrames({ data, columns, columnIndex: 0, grouping: 'MONTH' })
    expect(frames.map((frame) => frame.rawValue)).toEqual(['East', 'West'])
    expect(frames[0].rows).toHaveLength(2)
  })

  test('a number column steps through its values smallest first, leaving out blanks', () => {
    const cols = [{ name: 'round', type: 'QUANTITY' }]
    const frames = buildTimeFrames({ data: [[3], [1], [null], [2], [1]], columns: cols, columnIndex: 0 })
    expect(frames.map((frame) => frame.rawValue)).toEqual([1, 2, 3])
    expect(frames[0].rows).toHaveLength(2)
  })
})

describe('groupings by frame count', () => {
  const longData = [
    ['East', '2000-01-01T00:00:00.000Z', 1],
    ['East', '2024-01-01T00:00:00.000Z', 1],
  ]

  test('leaves out groupings that would make too many frames', () => {
    const available = getAvailableGroupings(longData, 1, dateColumn, false)
    expect(available).toEqual(['MONTH', 'QUARTER', 'YEAR'])
    const monthFrames = buildTimeFrames({ data: longData, columns, columnIndex: 1, grouping: 'MONTH' })
    expect(monthFrames.length).toBeLessThanOrEqual(MAX_TIME_ANIMATION_FRAMES)
  })

  test('defaults to the finest grouping with a manageable number of frames', () => {
    // 48 days is over the preferred frame count, so weeks
    expect(getDefaultGrouping(data, 1, dateColumn, false)).toBe('WEEK')
    expect(getDefaultGrouping(longData, 1, dateColumn, false)).toBe('YEAR')
  })
})

describe('getFrameDrilldown', () => {
  test('list data filters to the frame period', () => {
    const frames = buildTimeFrames({ data, columns, columnIndex: 1, grouping: 'MONTH' })
    expect(getFrameDrilldown({ frames, frameIndex: 2, column: dateColumn })).toEqual({
      groupBy: null,
      filter: {
        name: 'sale_date',
        operator: 'between',
        value: '2024-03-01T00:00:00.000Z,2024-03-31T23:59:59.999Z',
        column_type: 'DATE',
      },
    })
  })

  test('running totals filter from the first period', () => {
    const frames = buildTimeFrames({ data, columns, columnIndex: 1, grouping: 'MONTH', cumulative: true })
    const { filter } = getFrameDrilldown({ frames, frameIndex: 2, column: dateColumn, cumulative: true })
    expect(filter.value).toBe('2024-01-01T00:00:00.000Z,2024-03-31T23:59:59.999Z')
  })

  test('grouped data groups by the query date value', () => {
    const groupedColumn = { name: 'month', type: 'DATE', precision: 'MONTH', groupable: true, drill_down: 'x' }
    const grouped = [['East', '2024-01-01T00:00:00.000Z', 10]]
    const frames = buildTimeFrames({
      data: grouped,
      columns: [columns[0], groupedColumn],
      columnIndex: 1,
      grouping: 'MONTH',
    })
    const drilldown = getFrameDrilldown({ frames, frameIndex: 0, column: groupedColumn, isAggregated: true })
    expect(drilldown.groupBy).toEqual({ name: 'month', drill_down: 'x', value: '2024-01-01T00:00:00.000Z' })
  })

  test('a value frame of any other column filters on its value', () => {
    const cols = [{ name: 'round', type: 'QUANTITY' }]
    const frames = buildTimeFrames({ data: [[1], [2]], columns: cols, columnIndex: 0 })
    expect(getFrameDrilldown({ frames, frameIndex: 1, column: cols[0], cumulative: false })).toEqual({
      groupBy: null,
      filter: { name: 'round', operator: '=', value: '2' },
    })
  })

  test('a running total over date strings cannot be drilled into', () => {
    const cols = [{ name: 'month', type: 'DATE_STRING' }]
    const frames = buildTimeFrames({ data: [['March'], ['April']], columns: cols, columnIndex: 0, cumulative: true })
    expect(getFrameDrilldown({ frames, frameIndex: 1, column: cols[0], cumulative: true })).toBeNull()
  })
})
