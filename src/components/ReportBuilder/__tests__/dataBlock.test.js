import {
  computeTotalRow,
  getEffectiveDisplay,
  getInterpretationText,
  getOrderLabel,
  getPrintableColumns,
  getRowOptions,
  getSliceCaption,
  isResultComplete,
} from '../model/dataBlock'
import { buildTileIndex, getTileSupport, resolveTile, tileSource } from '../model/tiles'

const COLUMNS = [
  { index: 0, name: 'reference', display_name: 'Reference', type: 'STRING' },
  { index: 1, name: 'amount', display_name: 'Amount', type: 'DOLLAR_AMT' },
  { index: 2, name: 'margin', display_name: 'Margin', type: 'PERCENT' },
  { index: 3, name: 'units', display_name: 'Units', type: 'QUANTITY' },
]

describe('getOrderLabel', () => {
  it('names the ordering column, direction and tie-breakers', () => {
    expect(getOrderLabel([{ name: 'amount', sort: 'DESC' }], COLUMNS)).toBe('Amount')
    expect(getOrderLabel([{ name: 'amount', sort: 'ASC' }], COLUMNS)).toBe('Amount, lowest first')
    expect(
      getOrderLabel(
        [
          { name: 'amount', sort: 'DESC' },
          { name: 'reference', sort: 'ASC' },
        ],
        COLUMNS,
      ),
    ).toBe('Amount, then Reference')
  })

  it('is null when nothing orders the rows', () => {
    expect(getOrderLabel([], COLUMNS)).toBeNull()
    expect(getOrderLabel(undefined, COLUMNS)).toBeNull()
  })
})

describe('getSliceCaption', () => {
  it('says "Top" only when an ordering was applied', () => {
    const orders = [{ name: 'amount', sort: 'DESC' }]
    expect(getSliceCaption({ shown: 25, total: 30044, complete: false, orders, columns: COLUMNS })).toBe(
      'Top 25 of 30,044 by Amount',
    )
    expect(getSliceCaption({ shown: 25, total: 84120, complete: false, orders: [], columns: COLUMNS })).toBe(
      'First 25 of 84,120 rows as returned',
    )
  })

  it('never starts with "Top" without an ordering', () => {
    ;[undefined, [], [{ sort: 'DESC' }]].forEach((orders) => {
      expect(getSliceCaption({ shown: 10, total: 50, complete: false, orders, columns: COLUMNS })).toMatch(/^First /)
    })
  })

  it('copes with an unknown total', () => {
    expect(getSliceCaption({ shown: 100, total: null, complete: false, orders: [], columns: COLUMNS })).toBe(
      'First 100 rows as returned',
    )
  })

  it('says nothing when the whole result is shown', () => {
    expect(getSliceCaption({ shown: 6, total: 6, complete: true, orders: [], columns: COLUMNS })).toBeNull()
  })
})

describe('isResultComplete', () => {
  it('trusts the server’s full count when there is one', () => {
    expect(isResultComplete({ included: 25, fetched: 100, countRows: 30044, pageSize: 100 })).toBe(false)
    expect(isResultComplete({ included: 6, fetched: 6, countRows: 6, pageSize: 100 })).toBe(true)
  })

  it('without one, treats a short page as everything and a full page as maybe more', () => {
    expect(isResultComplete({ included: 40, fetched: 40, countRows: null, pageSize: 100 })).toBe(true)
    expect(isResultComplete({ included: 100, fetched: 100, countRows: null, pageSize: 100 })).toBe(false)
    expect(isResultComplete({ included: 25, fetched: 40, countRows: null, pageSize: 100 })).toBe(false)
  })
})

describe('getRowOptions', () => {
  it('offers 10 / 25 / 50 / 100 for a large result', () => {
    expect(getRowOptions(30044).map(([n]) => n)).toStrictEqual([10, 25, 50, 100])
  })

  it('stops at the first option that holds the whole result', () => {
    expect(getRowOptions(30)).toStrictEqual([
      [10, '10 rows'],
      [25, '25 rows'],
      [50, 'All 30 rows'],
    ])
    expect(getRowOptions(6)).toStrictEqual([[10, 'All 6 rows']])
  })
})

describe('getPrintableColumns', () => {
  it('uses the tile’s visibility, order and frozen columns', () => {
    const tile = {
      columnVisibility: { margin: false },
      columnOrder: ['units', 'amount', 'reference'],
      frozenColumns: ['reference'],
    }
    expect(getPrintableColumns(COLUMNS, tile).map((c) => c.name)).toStrictEqual(['reference', 'units', 'amount'])
  })

  it('shows every column when the tile says nothing', () => {
    expect(getPrintableColumns(COLUMNS, {}).map((c) => c.name)).toStrictEqual([
      'reference',
      'amount',
      'margin',
      'units',
    ])
  })
})

describe('computeTotalRow', () => {
  const rows = [
    ['A', 100, 0.5, 2],
    ['B', 50.5, 0.25, 3],
  ]

  it('shows no total for a cut-off table — a sum of a slice reads as the total', () => {
    expect(computeTotalRow({ rows, columns: COLUMNS, complete: false })).toBeNull()
  })

  it('sums only amounts and quantities, and labels the first other column', () => {
    expect(computeTotalRow({ rows, columns: COLUMNS, complete: true })).toStrictEqual({
      labelIndex: 0,
      sums: { 1: 150.5, 3: 5 },
    })
  })

  it('skips averaged and custom columns', () => {
    const columns = [COLUMNS[0], { ...COLUMNS[1], custom: true }, COLUMNS[3]]
    expect(computeTotalRow({ rows, columns, aggConfig: { units: 'AVG' }, complete: true })).toBeNull()
  })

  it('needs more than one row and somewhere to put the label', () => {
    expect(computeTotalRow({ rows: [rows[0]], columns: COLUMNS, complete: true })).toBeNull()
    expect(computeTotalRow({ rows, columns: [COLUMNS[1]], complete: true })).toBeNull()
  })
})

describe('getInterpretationText', () => {
  it('falls back to plain interpretation text when there is no parsed interpretation', () => {
    expect(getInterpretationText({ data: { data: { interpretation: ' total sales by region ' } } })).toBe(
      'total sales by region',
    )
  })

  it('is empty, not a crash, for a response without either', () => {
    expect(getInterpretationText({ data: { data: {} } })).toBe('')
    expect(getInterpretationText(undefined)).toBe('')
  })
})

describe('getEffectiveDisplay', () => {
  it('prints a table as a table', () => {
    expect(getEffectiveDisplay({ data: { data: { rows: [], columns: [] } } }, 'table')).toStrictEqual({
      kind: 'table',
      displayType: 'table',
    })
  })

  it('falls back to a table when the saved chart is not valid for the data', () => {
    const response = { data: { data: { display_type: 'data', rows: [['x']], columns: [COLUMNS[0]] } } }
    expect(getEffectiveDisplay(response, 'column').kind).toBe('table')
  })
})

describe('tiles', () => {
  const dashboards = [
    { id: 1, name: 'Ops', tiles: [{ i: 'a', query: 'transactions', displayType: 'table', title: 'Transactions' }] },
    { id: 2, name: 'Q3', tiles: [{ key: 'b', i: 'ignored', query: 'x', displayType: 'pivot_table' }] },
  ]
  const index = buildTileIndex(dashboards)

  it('finds a block’s tile by dashboard id and tile key', () => {
    expect(resolveTile(index, { type: 'tile', dashboardId: '1', tileKey: 'a' }).tile.title).toBe('Transactions')
    expect(resolveTile(index, { type: 'tile', dashboardId: '2', tileKey: 'b' })).not.toBeNull()
    expect(resolveTile(index, { type: 'tile', dashboardId: '1', tileKey: 'zz' })).toBeNull()
    expect(resolveTile(index, { type: 'query', query: 'x' })).toBeNull()
  })

  it('says which tiles v1 can print', () => {
    expect(getTileSupport(dashboards[0].tiles[0])).toStrictEqual({ supported: true })
    expect(getTileSupport(dashboards[1].tiles[0])).toStrictEqual({ supported: false, reason: 'unsupported' })
    expect(getTileSupport({ displayType: 'table' })).toStrictEqual({ supported: false, reason: 'no-query' })
  })

  it('records where a block came from, with labels for if the tile disappears', () => {
    expect(tileSource({ dashboard: dashboards[0], tile: dashboards[0].tiles[0] })).toStrictEqual({
      type: 'tile',
      dashboardId: '1',
      tileKey: 'a',
      snapshot: { dashboardName: 'Ops', tileTitle: 'Transactions', query: 'transactions', displayType: 'table' },
    })
  })
})
