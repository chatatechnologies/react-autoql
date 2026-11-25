import { getSankeyNodeKey, getSankeyNodeSort, shouldFilterLinkDrilldown } from './sankeyNodeOrder'

const dateColumn = { name: 'transfer_date', type: 'DATE', precision: 'DAY' }
const senderColumn = { name: 'sender', type: 'STRING' }
const receiverColumn = { name: 'receiver', type: 'STRING' }
const monthStringColumn = { name: 'month', type: 'DATE_STRING', precision: 'MONTH' }

describe('getSankeyNodeKey', () => {
  test('merges date values that format the same', () => {
    const morning = getSankeyNodeKey({ rawKey: '1762070400', display: 'Nov 2, 2026', column: dateColumn })
    const evening = getSankeyNodeKey({ rawKey: '1762110000', display: 'Nov 2, 2026', column: dateColumn })
    expect(morning).toEqual(evening)
  })

  test('keeps raw values for non-date columns', () => {
    expect(getSankeyNodeKey({ rawKey: 'abc::123', display: 'abc', column: senderColumn })).toEqual('abc::123')
  })

  test('keeps raw values for DATE_STRING columns, even when they format the same', () => {
    const a = getSankeyNodeKey({ rawKey: '2026-11', display: 'November 2026', column: monthStringColumn })
    const b = getSankeyNodeKey({ rawKey: '2026-11-01', display: 'November 2026', column: monthStringColumn })
    expect(a).toEqual('2026-11')
    expect(b).toEqual('2026-11-01')
  })

  test('falls back to the raw value when a date has no display value', () => {
    expect(getSankeyNodeKey({ rawKey: '1762070400', display: '', column: dateColumn })).toEqual('1762070400')
  })
})

describe('getSankeyNodeSort', () => {
  const columns = [senderColumn, dateColumn, receiverColumn]
  const pathColumnIndices = [0, 1, 2]

  test('is undefined when no path column is a date, keeping d3 default ordering', () => {
    expect(getSankeyNodeSort([senderColumn, receiverColumn], [0, 1])).toBeUndefined()
  })

  test('sorts date nodes chronologically', () => {
    const sort = getSankeyNodeSort(columns, pathColumnIndices)
    const nodes = [
      { stage: 1, rawValue: 1763856000, value: 50 }, // Nov 23
      { stage: 1, rawValue: 1761436800, value: 1 }, // Oct 26
      { stage: 1, rawValue: 1762732800, value: 10 }, // Nov 10
    ]
    expect(nodes.sort(sort).map((n) => n.rawValue)).toEqual([1761436800, 1762732800, 1763856000])
  })

  test('sorts ISO date strings chronologically', () => {
    const sort = getSankeyNodeSort(columns, pathColumnIndices)
    const nodes = [
      { stage: 1, rawValue: '2026-11-23T00:00:00Z' },
      { stage: 1, rawValue: '2026-10-26T00:00:00Z' },
      { stage: 1, rawValue: '2026-11-10T00:00:00Z' },
    ]
    expect(nodes.sort(sort).map((n) => n.rawValue)).toEqual([
      '2026-10-26T00:00:00Z',
      '2026-11-10T00:00:00Z',
      '2026-11-23T00:00:00Z',
    ])
  })

  test('puts the largest flows on top in non-date columns', () => {
    const sort = getSankeyNodeSort(columns, pathColumnIndices)
    const nodes = [
      { stage: 0, rawValue: 'a', value: 2 },
      { stage: 0, rawValue: 'b', value: 9 },
      { stage: 0, rawValue: 'c', value: 5 },
    ]
    expect(nodes.sort(sort).map((n) => n.rawValue)).toEqual(['b', 'c', 'a'])
  })
})

describe('shouldFilterLinkDrilldown', () => {
  test('filters on the date range for a link to a DATE node in a list query', () => {
    expect(
      shouldFilterLinkDrilldown({ sourceColumn: senderColumn, targetColumn: dateColumn, isAggregatedData: false }),
    ).toBe(true)
    expect(
      shouldFilterLinkDrilldown({ sourceColumn: dateColumn, targetColumn: receiverColumn, isAggregatedData: false }),
    ).toBe(true)
  })

  test('uses the drilldown endpoint for aggregated data, even with a DATE column', () => {
    expect(
      shouldFilterLinkDrilldown({ sourceColumn: senderColumn, targetColumn: dateColumn, isAggregatedData: true }),
    ).toBe(false)
  })

  test('uses the drilldown endpoint for DATE_STRING columns', () => {
    expect(
      shouldFilterLinkDrilldown({
        sourceColumn: senderColumn,
        targetColumn: monthStringColumn,
        isAggregatedData: false,
      }),
    ).toBe(false)
  })

  test('uses the drilldown endpoint when neither column is a date', () => {
    expect(
      shouldFilterLinkDrilldown({ sourceColumn: senderColumn, targetColumn: receiverColumn, isAggregatedData: false }),
    ).toBe(false)
  })
})
