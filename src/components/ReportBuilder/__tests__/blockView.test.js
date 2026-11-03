import { getDataBlockView } from '../model/blockView'
import { buildTileIndex } from '../model/tiles'
import { executeReport } from '../run/reportRun'

const COLUMNS = [
  { index: 0, name: 'account', display_name: 'Account', type: 'STRING' },
  { index: 1, name: 'aum', display_name: 'AUM', type: 'DOLLAR_AMT' },
  { index: 2, name: 'opened', display_name: 'Opened', type: 'DATE' },
]
const rowsOf = (n) => Array.from({ length: n }, (_, i) => [`A-${i + 1}`, 1000 * (i + 1), '2026-01-01T00:00:00.000Z'])
const responseOf = (rows, extra = {}) => ({
  data: { reference_id: '1.1.200', data: { columns: COLUMNS, rows, count_rows: rows.length, ...extra } },
})
const success = (rows, { countRows = rows.length, requestKey = 'k', pageSize = 100 } = {}) => ({
  status: 'success',
  response: responseOf(rows, { count_rows: countRows }),
  rowCount: rows.length,
  countRows,
  requestKey,
  pageSize,
})

const tableTile = {
  i: 't1',
  title: 'Accounts by AUM',
  query: 'aum by account',
  displayType: 'table',
  orders: [{ name: 'aum', sort: 'DESC' }],
}
const unsortedTile = { i: 't2', title: 'Accounts', query: 'all accounts', displayType: 'table' }
const pivotTile = { i: 't3', title: 'Pivot', query: 'x', displayType: 'pivot_table' }
const tileIndex = buildTileIndex([{ id: 'd1', name: 'Book', tiles: [tableTile, unsortedTile, pivotTile] }])

const block = (source, rest = {}) => ({ id: 'b', type: 'data', width: 'full', rows: 25, source, ...rest })
const tileBlock = (tileKey, rest) => block({ type: 'tile', dashboardId: 'd1', tileKey }, rest)
const view = (b, result, extra = {}) => getDataBlockView({ block: b, tileIndex, result, requestKey: 'k', ...extra })

describe('getDataBlockView states', () => {
  it('is empty with no source', () => {
    expect(view(block(null))).toStrictEqual({ state: 'empty' })
  })

  it('says a tile is missing, keeping the labels it was saved with', () => {
    const b = block({
      type: 'tile',
      dashboardId: 'd1',
      tileKey: 'gone',
      snapshot: { tileTitle: 'Old tile', dashboardName: 'Book' },
    })
    expect(view(b)).toMatchObject({ state: 'missing', title: 'Old tile', dashboardName: 'Book' })
  })

  it('refuses tiles v1 cannot print', () => {
    expect(view(tileBlock('t3'))).toMatchObject({
      state: 'unsupported',
      reason: 'unsupported',
      displayType: 'pivot_table',
    })
  })

  it('is not run, then loading while a run fetches exactly what it asks for', () => {
    expect(view(tileBlock('t1')).state).toBe('not-run')
    expect(view(tileBlock('t1'), undefined, { running: true }).state).toBe('loading')
  })

  it('is stale once it asks for something other than what last ran', () => {
    expect(view(tileBlock('t1'), success(rowsOf(3), { requestKey: 'old' })).state).toBe('stale')
  })

  it('shows an error, and treats a cancelled request as not run', () => {
    expect(view(tileBlock('t1'), { status: 'error', error: { message: 'boom' }, requestKey: 'k' })).toMatchObject({
      state: 'error',
      error: { message: 'boom' },
    })
    expect(view(tileBlock('t1'), { status: 'cancelled', requestKey: 'k' }).state).toBe('not-run')
  })

  it('titles a question block with its question', () => {
    expect(view(block({ type: 'query', query: 'aum by account' }))).toMatchObject({
      state: 'not-run',
      title: 'aum by account',
      sourceType: 'query',
    })
  })
})

describe('a table view', () => {
  it('cuts to the block’s rows, says "Top" because the tile is ordered, and shows no total', () => {
    const v = view(tileBlock('t1'), success(rowsOf(100), { countRows: 30044 }))
    expect(v).toMatchObject({ state: 'ready', kind: 'table', complete: false, countRows: 30044, split: true })
    expect(v.rows).toHaveLength(25)
    expect(v.caption).toBe('Top 25 of 30,044 by AUM')
    expect(v.total).toBeNull()
  })

  it('says "First … as returned" when the tile is not ordered', () => {
    const v = view(tileBlock('t2'), success(rowsOf(100), { countRows: 84120 }))
    expect(v.caption).toBe('First 25 of 84,120 rows as returned')
  })

  it('never says "Top" for a question, which nothing orders', () => {
    const v = view(
      block({ type: 'query', query: 'aum by account' }),
      success(rowsOf(60), { countRows: 60, pageSize: undefined }),
    )
    expect(v.caption).toBe('First 25 of 60 rows as returned')
  })

  it('totals a complete result across every row, with no caption', () => {
    const v = view(tileBlock('t1'), success(rowsOf(8)))
    expect(v).toMatchObject({ complete: true, caption: null })
    expect(v.total).toStrictEqual({ labelIndex: 0, sums: { 1: 36000 } })
  })

  it('uses the tile’s saved column overrides when formatting', () => {
    const tile = { ...tableTile, dataConfig: { columnOverrides: { 2: { type: 'DATE', precision: 'MONTH' } } } }
    const index = buildTileIndex([{ id: 'd1', name: 'Book', tiles: [tile] }])
    const v = getDataBlockView({
      block: tileBlock('t1'),
      tileIndex: index,
      result: success(rowsOf(3)),
      requestKey: 'k',
    })
    expect(v.columns.find((col) => col.name === 'opened').precision).toBe('MONTH')
  })

  it('hides columns the tile hides, like QueryOutput', () => {
    const tile = { ...tableTile, columnVisibility: { opened: false } }
    const index = buildTileIndex([{ id: 'd1', name: 'Book', tiles: [tile] }])
    const v = getDataBlockView({
      block: tileBlock('t1'),
      tileIndex: index,
      result: success(rowsOf(3)),
      requestKey: 'k',
    })
    expect(v.columns.map((col) => col.name)).toStrictEqual(['account', 'aum'])
  })

  it('only splits across pages at full width', () => {
    expect(view(tileBlock('t1', { width: 'half' }), success(rowsOf(3))).split).toBe(false)
  })
})

describe('showing a block another way', () => {
  const question = (rest) => block({ type: 'query', query: 'aum by account' }, rest)
  // Shaped as an answer arrives (and as a capture keeps it): a data display type, and visible columns.
  const ANSWER_COLUMNS = [
    { index: 0, name: 'account', display_name: 'Account', type: 'STRING', groupable: true, is_visible: true },
    { index: 1, name: 'aum', display_name: 'AUM', type: 'DOLLAR_AMT', groupable: false, is_visible: true },
  ]
  const answer = (n, countRows = n) => ({
    ...success(rowsOf(n), { countRows }),
    response: {
      data: {
        reference_id: '1.1.200',
        data: {
          display_type: 'data',
          columns: ANSWER_COLUMNS,
          rows: rowsOf(n).map(([account, aum]) => [account, aum]),
          count_rows: countRows,
        },
      },
    },
  })

  it('offers table and the charts its data supports that a report can print', () => {
    // One string and one number column, six rows: no pivot, so no stacked charts, and one number, so no
    // scatterplot or combo chart; more than five rows, so a histogram.
    expect(view(question(), answer(6)).displayOptions).toStrictEqual([
      'table',
      'column',
      'bar',
      'line',
      'pie',
      'histogram',
    ])
  })

  it('shows it as the block says, as a chart or as a table', () => {
    expect(view(question({ displayType: 'bar' }), answer(6))).toMatchObject({ kind: 'chart', displayType: 'bar' })
    const table = view(question({ displayType: 'table' }), answer(6))
    expect(table).toMatchObject({ kind: 'table', displayType: 'table' })
    expect(table.rows).toHaveLength(6)
  })

  it('ignores a choice its data can’t be drawn as', () => {
    const plain = view(question(), answer(6))
    expect(view(question({ displayType: 'scatterplot' }), answer(6))).toMatchObject({
      kind: plain.kind,
      displayType: plain.displayType,
    })
  })

  it('says how much of the result a chart of a cut-off result draws', () => {
    const chart = view(question({ displayType: 'column' }), answer(30, 30044))
    expect(chart).toMatchObject({ kind: 'chart', rowCount: 30, countRows: 30044, complete: false })
    expect(chart.caption).toBe('First 30 of 30,044 rows as returned')
  })
})

describe('executeReport', () => {
  it('records the page size each result was fetched with', async () => {
    const jobs = [{ blockId: 'a', key: 'k', request: { query: 'q', pageSize: 100 } }]
    const results = await executeReport({ jobs, runQueryFn: () => Promise.resolve(responseOf(rowsOf(2))) })
    expect(results.a.pageSize).toBe(100)
  })
})
