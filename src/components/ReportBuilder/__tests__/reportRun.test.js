import { REQUEST_CANCELLED_ERROR } from 'autoql-fe-utils'
import {
  buildQuestionRequest,
  buildTileRequest,
  classifyError,
  classifyResponse,
  executeReport,
  getRequestKey,
  formatPrintedDate,
  getRunLabel,
  planReportRun,
  summarizeRun,
} from '../run/reportRun'
import { buildTileIndex } from '../model/tiles'
import { normalizeReport } from '../model/reportSchema'
import { QUESTION_SOURCE, TILE_SOURCE } from '../constants'

const AUTH = { token: 't', apiKey: 'k', domain: 'https://d.example' }

const tableTile = {
  i: 'txn',
  query: 'all transactions',
  title: 'Transactions',
  displayType: 'table',
  orders: [{ name: 'amount', sort: 'DESC' }],
  filters: [{ name: 'region', value: 'West' }],
  tableFilters: [{ name: 'status', value: 'open' }],
  columnSelects: [{ columns: ['sum(amount)'] }],
  displayOverrides: [{ index: 1, type: 'QUANTITY' }],
  queryId: 'q-1',
}
const chartTile = { i: 'rev', query: 'revenue by region', displayType: 'column', pageSize: 300 }
const dashboards = [
  { id: 1, name: 'Ops', tiles: [tableTile], slicers: [{ data: { name: 'segment', value: 'SMB' } }] },
  { id: 2, name: 'Q3', tiles: [chartTile, { i: 'piv', query: 'x', displayType: 'pivot_table' }] },
]

describe('buildTileRequest', () => {
  it('runs the tile’s saved config, but a table asks for at most 100 rows', () => {
    const request = buildTileRequest({ tile: tableTile, dashboard: dashboards[0], authentication: AUTH })
    expect(request).toMatchObject({
      ...AUTH,
      query: 'all transactions',
      orders: tableTile.orders,
      tableFilters: tableTile.tableFilters,
      filters: [...tableTile.filters, { name: 'segment', value: 'SMB' }],
      newColumns: tableTile.columnSelects,
      displayOverrides: tableTile.displayOverrides,
      sourceQuery: 'q-1',
      pageSize: 100,
      enableQueryValidation: false,
      allowSuggestions: false,
      source: TILE_SOURCE,
      scope: 'dashboards',
    })
  })

  it('lets a chart keep its own page size, as on its dashboard', () => {
    expect(buildTileRequest({ tile: chartTile, dashboard: dashboards[1], authentication: AUTH }).pageSize).toBe(300)
    expect(
      buildTileRequest({ tile: { ...chartTile, pageSize: undefined }, dashboard: dashboards[1], authentication: AUTH })
        .pageSize,
    ).toBeUndefined()
  })

  it('uses a chosen suggestion over the saved query text', () => {
    const tile = { ...tableTile, defaultSelectedSuggestion: 'all open transactions' }
    expect(buildTileRequest({ tile, dashboard: dashboards[0], authentication: AUTH }).query).toBe(
      'all open transactions',
    )
  })
})

describe('buildQuestionRequest', () => {
  it('runs a question as asked, with no tile config', () => {
    expect(buildQuestionRequest({ query: 'churn by month', authentication: AUTH })).toMatchObject({
      ...AUTH,
      query: 'churn by month',
      source: QUESTION_SOURCE,
      allowSuggestions: false,
    })
  })
})

describe('getRequestKey', () => {
  it('ignores the token and cancel token, but not what would be fetched', () => {
    const request = buildTileRequest({ tile: tableTile, dashboard: dashboards[0], authentication: AUTH })
    expect(getRequestKey({ ...request, token: 'new', cancelToken: {} })).toBe(getRequestKey(request))
    expect(getRequestKey({ ...request, orders: [] })).not.toBe(getRequestKey(request))
  })
})

describe('planReportRun', () => {
  const report = normalizeReport({
    blocks: [
      { id: 'h', type: 'heading', text: 'Title' },
      { id: 'a', type: 'data', source: { type: 'tile', dashboardId: '1', tileKey: 'txn' } },
      { id: 'b', type: 'data', source: { type: 'tile', dashboardId: '1', tileKey: 'txn' }, rows: 10 },
      { id: 'c', type: 'data', source: { type: 'query', query: 'churn by month' } },
      { id: 'd', type: 'data', source: null },
      { id: 'e', type: 'data', source: { type: 'tile', dashboardId: '9', tileKey: 'gone' } },
      { id: 'f', type: 'data', source: { type: 'tile', dashboardId: '2', tileKey: 'piv' } },
    ],
  })
  const plan = planReportRun({ report, tileIndex: buildTileIndex(dashboards), authentication: AUTH })

  it('plans every runnable data block and says why the rest are skipped', () => {
    expect(plan.jobs.map((job) => job.blockId)).toStrictEqual(['a', 'b', 'c'])
    expect(plan.skipped).toStrictEqual([
      { blockId: 'd', reason: 'no-source' },
      { blockId: 'e', reason: 'missing-tile' },
      { blockId: 'f', reason: 'unsupported' },
    ])
  })

  it('gives two blocks of the same tile the same request, whatever rows each shows', () => {
    expect(plan.jobs[0].key).toBe(plan.jobs[1].key)
  })
})

const response = (rows, extra = {}) => ({
  data: {
    reference_id: '1.1.200',
    data: { columns: [{ index: 0, name: 'a' }], rows, count_rows: rows.length, ...extra },
  },
})

describe('classifyResponse', () => {
  it('keeps the server’s full count from the raw response', () => {
    expect(classifyResponse(response([[1], [2]], { count_rows: 30044 }))).toMatchObject({
      status: 'success',
      rowCount: 2,
      countRows: 30044,
    })
  })

  it('treats a zero-row answer as an answer', () => {
    expect(classifyResponse(response([])).status).toBe('success')
  })

  it('treats error envelopes, suggestion lists and validation prompts as errors', () => {
    expect(classifyResponse({ data: { reference_id: '1.1.555', message: 'boom', data: {} } })).toMatchObject({
      status: 'error',
      error: { message: 'boom', referenceId: '1.1.555' },
    })
    expect(classifyResponse({ data: { reference_id: '1.1.200', data: { items: ['x'] } } }).status).toBe('error')
    expect(classifyResponse({ data: { reference_id: '1.1.200', data: { replacements: [] } } }).status).toBe('error')
  })

  it('reports a cancelled request as cancelled', () => {
    // The shape runQuery actually rejects with when its cancel token fires.
    expect(classifyError({ data: { message: REQUEST_CANCELLED_ERROR } })).toStrictEqual({ status: 'cancelled' })
    expect(classifyError(REQUEST_CANCELLED_ERROR)).toStrictEqual({ status: 'cancelled' })
    expect(classifyError({ response: { data: { message: 'nope' } } })).toMatchObject({
      status: 'error',
      error: { message: 'nope' },
    })
  })
})

describe('executeReport', () => {
  const jobs = [
    { blockId: 'a', key: 'k1', request: { query: 'one' } },
    { blockId: 'b', key: 'k1', request: { query: 'one' } },
    { blockId: 'c', key: 'k2', request: { query: 'two' } },
    { blockId: 'd', key: 'k3', request: { query: 'three' } },
  ]

  it('runs each distinct request once and reports every block that shares it', async () => {
    const runQueryFn = jest.fn((request) => Promise.resolve(response([[request.query]])))
    const settled = []
    const results = await executeReport({ jobs, runQueryFn, onSettled: (id) => settled.push(id) })

    expect(runQueryFn).toHaveBeenCalledTimes(3)
    expect(Object.keys(results).sort()).toStrictEqual(['a', 'b', 'c', 'd'])
    expect(results.a.response).toBe(results.b.response)
    expect(results.a.requestKey).toBe('k1')
    expect(settled.sort()).toStrictEqual(['a', 'b', 'c', 'd'])
  })

  it('never has more than `concurrency` queries in flight', async () => {
    let inFlight = 0
    let peak = 0
    const runQueryFn = () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      return new Promise((resolve) =>
        setTimeout(() => {
          inFlight -= 1
          resolve(response([[1]]))
        }, 5),
      )
    }
    const many = Array.from({ length: 10 }, (_, i) => ({ blockId: `b${i}`, key: `k${i}`, request: {} }))
    await executeReport({ jobs: many, runQueryFn, concurrency: 3 })
    expect(peak).toBe(3)
  })

  it('finishes the run when some blocks fail, and passes the cancel token through', async () => {
    const cancelToken = { token: 'x' }
    const runQueryFn = jest.fn((request) =>
      request.query === 'two'
        ? Promise.reject({ response: { data: { message: 'bad' } } })
        : Promise.resolve(response([])),
    )
    const results = await executeReport({ jobs, runQueryFn, cancelToken })

    expect(results.c.status).toBe('error')
    expect(results.a.status).toBe('success')
    expect(runQueryFn.mock.calls[0][0].cancelToken).toBe(cancelToken)
    expect(summarizeRun(results, [{ blockId: 'z' }]).status).toBe('partial')
  })
})

describe('summarizeRun', () => {
  it('is an error only when everything failed, and cancelled wins', () => {
    expect(summarizeRun({ a: { status: 'error' } }).status).toBe('error')
    expect(summarizeRun({ a: { status: 'success' }, b: { status: 'cancelled' } }).status).toBe('cancelled')
    expect(summarizeRun({ a: { status: 'success' } }, [{ blockId: 's' }]).blocks).toStrictEqual([
      { blockId: 'a', status: 'success', rowCount: undefined, countRows: undefined, error: undefined },
      { blockId: 's', status: 'skipped' },
    ])
  })
})

describe('getRunLabel', () => {
  it('tells the author how old the data is', () => {
    expect(getRunLabel({ dataBlockCount: 0 })).toBe('Nothing to run')
    expect(getRunLabel({ dataBlockCount: 2, run: null })).toBe('Never run')
    expect(getRunLabel({ dataBlockCount: 2, run: { status: 'running', done: 1, total: 3 } })).toBe('Running 1 of 3…')
    const run = { status: 'success', runAt: new Date(2026, 8, 23, 14, 5).toISOString() }
    expect(getRunLabel({ dataBlockCount: 2, run })).toBe('All data as of 23 Sep, 14:05')
    expect(getRunLabel({ dataBlockCount: 2, run, isStale: true })).toBe(
      'All data as of 23 Sep, 14:05 · template edited since',
    )
  })
})

describe('formatPrintedDate', () => {
  it('includes the year, since paper outlives the session it was printed in', () => {
    const iso = new Date(2026, 8, 3, 9, 7).toISOString()
    expect(formatPrintedDate(iso)).toBe('3 Sep 2026')
    expect(formatPrintedDate(iso, { time: true })).toBe('3 Sep 2026, 09:07')
    expect(formatPrintedDate('not a date')).toBe('')
  })
})
