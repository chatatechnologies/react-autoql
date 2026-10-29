import { transformQueryResponse } from 'autoql-fe-utils'
import { captureFromResponse, MAX_CHART_ROWS, recaptureFromResponse, rowsForCapture } from '../model/capture'
import { getEffectiveDisplay } from '../model/dataBlock'
import { captureQuestion } from '../run/captureRun'
import { QUESTION_SOURCE } from '../constants'

const AUTH = { token: 't', apiKey: 'k', domain: 'https://example.test' }

const GROUPED = [
  { name: 'region', display_name: 'Region', type: 'STRING', groupable: true, is_visible: true },
  { name: 'aum', display_name: 'AUM', type: 'DOLLAR_AMT', groupable: false, is_visible: true },
]
const LIST = [
  { name: 'account', display_name: 'Account', type: 'STRING', groupable: false, is_visible: true },
  { name: 'advisor', display_name: 'Advisor', type: 'STRING', groupable: false, is_visible: false },
  { name: 'aum', display_name: 'AUM', type: 'DOLLAR_AMT', groupable: false, is_visible: true },
]
const TWO_GROUPS = [
  { name: 'region', display_name: 'Region', type: 'STRING', groupable: true, is_visible: true },
  { name: 'month', display_name: 'Month', type: 'DATE', groupable: true, is_visible: true },
  { name: 'aum', display_name: 'AUM', type: 'DOLLAR_AMT', groupable: false, is_visible: true },
]

// An answer as runQuery hands it over: transformed, so its columns are class instances with `field` and `index`.
const answer = ({ columns = GROUPED, rows, countRows = rows.length, orders } = {}) =>
  transformQueryResponse({
    data: {
      reference_id: '1.1.200',
      message: 'Success',
      data: {
        text: 'total aum by region',
        query_id: 'q_1',
        interpretation: 'total assets under management by region',
        display_type: 'data',
        count_rows: countRows,
        columns,
        rows,
        fe_req: { text: 'total aum by region', ...(orders ? { orders } : {}) },
      },
    },
  })

const grouped = (n) => Array.from({ length: n }, (_, i) => [`R-${i + 1}`, 1000 * (i + 1)])
const listed = (n) => Array.from({ length: n }, (_, i) => [`A-${i + 1}`, `Adv ${i % 4}`, 100 * (i + 1)])

describe('captureFromResponse', () => {
  it('keeps the answer as plain JSON, shown the way AutoQL shows it by default', () => {
    const response = answer({ rows: grouped(6) })
    const result = captureFromResponse(response, { capturedAt: '2026-09-29T20:00:00.000Z' })

    expect(result.ok).toBe(true)
    const { capture } = result
    expect(capture.displayType).toBe(getEffectiveDisplay(response).displayType)
    expect(capture).toMatchObject({
      version: 1,
      capturedAt: '2026-09-29T20:00:00.000Z',
      data: {
        count_rows: 6,
        text: 'total aum by region',
        query_id: 'q_1',
        interpretation: 'total assets under management by region',
      },
      config: { displayType: capture.displayType, columnVisibility: { region: true, aum: true } },
    })
    expect(capture.data.rows).toHaveLength(6)
    expect(capture.data.columns.map((col) => col.name)).toStrictEqual(['region', 'aum'])
    expect(Object.getPrototypeOf(capture.data.columns[0])).toBe(Object.prototype)
    expect(JSON.parse(JSON.stringify(capture))).toStrictEqual(capture)
  })

  it('keeps only what the block needs from the answer', () => {
    const { capture } = captureFromResponse(answer({ rows: grouped(3) }))
    expect(Object.keys(capture.data).sort()).toStrictEqual(
      ['columns', 'count_rows', 'interpretation', 'query_id', 'rows', 'text'].sort(),
    )
    expect(capture).not.toHaveProperty('queryFn')
    expect(JSON.stringify(capture)).not.toContain('Bearer')
  })

  it('keeps a table’s first 100 rows, its order, its hidden columns and the full count', () => {
    const orders = [{ name: 'aum', sort: 'DESC' }]
    const result = captureFromResponse(answer({ columns: LIST, rows: listed(150), countRows: 30044, orders }))

    expect(result.capture.displayType).toBe('table')
    expect(result.capture.data.rows).toHaveLength(100)
    expect(result.capture.data.count_rows).toBe(30044)
    expect(result.capture.table).toStrictEqual({ sort: orders, filtered: false })
    expect(result.capture.config.columnVisibility).toStrictEqual({ account: true, advisor: false, aum: true })
    // Too long to print whole, so it starts at the default.
    expect(result.rows).toBe(25)
  })

  it('shows a result too big for a chart as a table', () => {
    const response = answer({ rows: grouped(MAX_CHART_ROWS), countRows: 4500 })
    expect(getEffectiveDisplay(response).displayType).not.toBe('table')

    const { capture } = captureFromResponse(response)
    expect(capture.displayType).toBe('table')
    expect(capture.data.rows).toHaveLength(100)
    expect(capture.data.count_rows).toBe(4500)
  })

  it('never keeps a display the report can’t print', () => {
    const { capture } = captureFromResponse(
      answer({ columns: TWO_GROUPS, rows: grouped(12).map(([r, v], i) => [r, `2026-0${(i % 9) + 1}-01`, v]) }),
    )
    expect(['pivot_table', 'network_graph', 'sankey', 'treemap']).not.toContain(capture.displayType)
  })

  it('says why when the answer has no data', () => {
    expect(
      captureFromResponse({ data: { reference_id: '1.1.430', message: 'I’m not sure what you mean', data: {} } }),
    ).toStrictEqual({
      ok: false,
      reason: 'error',
      error: { message: 'I’m not sure what you mean', referenceId: '1.1.430' },
    })
    expect(captureFromResponse(answer({ columns: [], rows: [] }))).toStrictEqual({ ok: false, reason: 'no-data' })
  })
})

describe('recaptureFromResponse', () => {
  // What a block of a report made from a template keeps: how it's shown, but no answer.
  const KEPT = {
    version: 1,
    displayType: 'table',
    table: { columnIndices: [2, 0], sort: [{ name: 'aum', sort: 'DESC' }] },
    config: {
      displayType: 'table',
      dataConfig: { tableConfig: { stringColumnIndex: 0, numberColumnIndices: [2] }, columnOverrides: {} },
      columnVisibility: { account: true, advisor: false, aum: true },
      axisSorts: {},
      chartControls: { showAverageLine: false, showRegressionLine: false },
      orders: [{ name: 'aum', sort: 'DESC' }],
    },
  }
  const sorted = [{ name: 'aum', sort: 'DESC' }]

  it('keeps the block’s table and chart settings, and takes the answer and when it came', () => {
    const result = recaptureFromResponse(answer({ columns: LIST, rows: listed(12), orders: sorted }), {
      kept: KEPT,
      orders: sorted,
      capturedAt: '2026-10-28T18:00:00.000Z',
    })

    expect(result.ok).toBe(true)
    expect(result.capture).toStrictEqual({
      version: 1,
      capturedAt: '2026-10-28T18:00:00.000Z',
      displayType: 'table',
      data: expect.objectContaining({ count_rows: 12, query_id: 'q_1', text: 'total aum by region' }),
      table: { columnIndices: [2, 0], sort: sorted, filtered: false },
      config: { ...KEPT.config, columnVisibility: { account: true, advisor: false, aum: true }, orders: sorted },
    })
    expect(result.capture.data.rows).toHaveLength(12)
  })

  it('drops the filters typed against the rows kept before', () => {
    const kept = { ...KEPT, table: { ...KEPT.table, filters: [{ name: 'advisor', value: 'Okafor' }], filtered: true } }
    const { capture } = recaptureFromResponse(answer({ columns: LIST, rows: listed(3) }), { kept, orders: sorted })
    expect(capture.table).toStrictEqual({ columnIndices: [2, 0], sort: sorted, filtered: false })
  })

  it('shows it as the block does, else as it was kept, else as AutoQL would, while the answer can be', () => {
    const response = answer({ rows: grouped(6) })
    const chart = { ...KEPT, displayType: 'column', table: undefined, config: { displayType: 'column' } }

    expect(recaptureFromResponse(response, { kept: chart, displayType: 'bar' }).capture.displayType).toBe('bar')
    expect(recaptureFromResponse(response, { kept: chart }).capture.displayType).toBe('column')
    expect(recaptureFromResponse(response, { kept: {} }).capture.displayType).toBe(
      getEffectiveDisplay(response).displayType,
    )
    // A chart the new answer can't be shown as (it has no numbers now) is a table.
    const names = answer({ columns: LIST.slice(0, 2), rows: listed(6).map(([account, advisor]) => [account, advisor]) })
    expect(recaptureFromResponse(names, { kept: chart }).capture.displayType).toBe('table')
  })

  it('keeps a table, never a chart it can’t print or one of more rows than a chart keeps', () => {
    const big = answer({ rows: grouped(MAX_CHART_ROWS), countRows: 4500 })
    const chart = { displayType: 'column', config: { displayType: 'column' } }
    const { capture } = recaptureFromResponse(big, { kept: chart })
    expect(capture.displayType).toBe('table')
    expect(capture.config.displayType).toBe('table')
    expect(capture.data.rows).toHaveLength(100)
    expect(capture.table).toStrictEqual({ sort: [], filtered: false })

    const pivot = { displayType: 'pivot_table', config: { displayType: 'pivot_table' } }
    expect(recaptureFromResponse(answer({ rows: grouped(6) }), { kept: pivot }).capture.displayType).toBe('table')
  })

  it('leaves the columns to their names when a kept position isn’t a column of the new answer', () => {
    const { capture } = recaptureFromResponse(answer({ rows: grouped(4) }), { kept: KEPT })
    expect(capture.table).not.toHaveProperty('columnIndices')
    // By name: what the block kept for a column still there, and the answer's own for a new one.
    expect(capture.config.columnVisibility).toStrictEqual({ region: true, aum: true })

    const hidden = { ...KEPT, config: { ...KEPT.config, columnVisibility: { aum: false } } }
    expect(
      recaptureFromResponse(answer({ rows: grouped(4) }), { kept: hidden }).capture.config.columnVisibility,
    ).toStrictEqual({ region: true, aum: false })
  })

  it('says the rows are in the order the question was answered in', () => {
    // Asked without the kept sort: the answer's own order.
    const own = [{ name: 'account', sort: 'ASC' }]
    const { capture } = recaptureFromResponse(answer({ columns: LIST, rows: listed(3), orders: own }), {
      kept: KEPT,
    })
    expect(capture.table.sort).toStrictEqual(own)
    expect(capture.config.orders).toStrictEqual(own)
  })

  it('fails as captureFromResponse does', () => {
    const notSure = { data: { reference_id: '1.1.430', message: 'I’m not sure what you mean', data: {} } }
    expect(recaptureFromResponse(notSure, { kept: KEPT })).toMatchObject({ ok: false, reason: 'error' })
    expect(recaptureFromResponse(answer({ columns: [], rows: [] }), { kept: KEPT })).toStrictEqual({
      ok: false,
      reason: 'no-data',
    })
  })
})

describe('rowsForCapture', () => {
  const table = (n) => ({ displayType: 'table', data: { count_rows: n } })

  it('prints all of a table that one of the row options holds', () => {
    expect(rowsForCapture(table(10))).toBe(10)
    expect(rowsForCapture(table(13))).toBe(25)
    expect(rowsForCapture(table(88))).toBe(100)
  })

  it('starts a longer table, or a chart, at the default', () => {
    expect(rowsForCapture(table(101))).toBe(25)
    expect(rowsForCapture({ displayType: 'column', data: { count_rows: 13 } })).toBe(25)
    expect(rowsForCapture(undefined)).toBe(25)
  })
})

describe('captureQuestion', () => {
  it('asks once, as a report’s question, with room for a chart’s rows', async () => {
    const runQueryFn = jest.fn(() => Promise.resolve(answer({ rows: grouped(6) })))

    const result = await captureQuestion({ query: '  total aum by region ', authentication: AUTH, runQueryFn })

    expect(runQueryFn).toHaveBeenCalledTimes(1)
    expect(runQueryFn.mock.calls[0][0]).toMatchObject({
      query: 'total aum by region',
      source: QUESTION_SOURCE,
      pageSize: MAX_CHART_ROWS,
      token: 't',
      apiKey: 'k',
      domain: 'https://example.test',
      enableQueryValidation: false,
      skipQueryValidation: true,
      allowSuggestions: false,
    })
    expect(result.ok).toBe(true)
    expect(result.capture.data.query_id).toBe('q_1')
    expect(result.rows).toBe(25)
  })

  it('stops when its signal fires', async () => {
    const controller = new AbortController()
    const runQueryFn = jest.fn(
      (request) =>
        new Promise((resolve, reject) => {
          request.cancelToken.addEventListener('abort', () => reject(new Error('canceled')))
        }),
    )

    const asking = captureQuestion({
      query: 'aum by region',
      authentication: AUTH,
      signal: controller.signal,
      runQueryFn,
    })
    expect(runQueryFn.mock.calls[0]?.[0]?.cancelToken).toBe(controller.signal)
    controller.abort()

    expect(await asking).toStrictEqual({ ok: false, reason: 'cancelled' })
  })

  it('says why a question didn’t run', async () => {
    const runQueryFn = jest.fn(() =>
      Promise.reject({ data: { message: 'The query timed out.', reference_id: '1.1.504' } }),
    )
    expect(await captureQuestion({ query: 'aum by region', authentication: AUTH, runQueryFn })).toStrictEqual({
      ok: false,
      reason: 'error',
      error: { message: 'The query timed out.', referenceId: '1.1.504' },
    })
  })

  describe('asked again (rerun)', () => {
    const sorted = [{ name: 'aum', sort: 'DESC' }]
    const kept = {
      version: 1,
      displayType: 'table',
      table: { columnIndices: [2, 0], sort: sorted },
      config: { displayType: 'table', columnVisibility: { account: true, advisor: false, aum: true } },
    }

    it('asks in the order its table is sorted by, and keeps the block’s settings', async () => {
      const runQueryFn = jest.fn(() => Promise.resolve(answer({ columns: LIST, rows: listed(3), orders: sorted })))

      const result = await captureQuestion({
        query: 'aum by account',
        authentication: AUTH,
        rerun: { kept, displayType: undefined },
        runQueryFn,
      })

      expect(runQueryFn).toHaveBeenCalledTimes(1)
      expect(runQueryFn.mock.calls[0][0]).toMatchObject({ query: 'aum by account', orders: sorted })
      expect(result.capture.table).toStrictEqual({ columnIndices: [2, 0], sort: sorted, filtered: false })
      expect(result.capture.config.columnVisibility).toStrictEqual(kept.config.columnVisibility)
    })

    it('asks once more without that order when it can’t be asked in it', async () => {
      const own = [{ name: 'account', sort: 'ASC' }]
      const runQueryFn = jest
        .fn()
        .mockImplementationOnce(() => Promise.reject({ data: { message: 'Unknown column', reference_id: '1.1.400' } }))
        .mockImplementationOnce(() => Promise.resolve(answer({ columns: LIST, rows: listed(3), orders: own })))

      const result = await captureQuestion({
        query: 'aum by account',
        authentication: AUTH,
        rerun: { kept },
        runQueryFn,
      })

      expect(runQueryFn).toHaveBeenCalledTimes(2)
      expect(runQueryFn.mock.calls[1][0]).not.toHaveProperty('orders')
      expect(result.ok).toBe(true)
      expect(result.capture.table.sort).toStrictEqual(own)
    })

    it('asks once, with no order, when its table has none', async () => {
      const runQueryFn = jest.fn(() => Promise.reject({ data: { message: 'The query timed out.' } }))
      const result = await captureQuestion({
        query: 'aum by account',
        authentication: AUTH,
        rerun: { kept: { ...kept, table: undefined } },
        runQueryFn,
      })
      expect(runQueryFn).toHaveBeenCalledTimes(1)
      expect(runQueryFn.mock.calls[0][0]).not.toHaveProperty('orders')
      expect(result).toMatchObject({ ok: false, reason: 'error' })
    })
  })

  it('asks nothing without a question', async () => {
    const runQueryFn = jest.fn()
    const result = await captureQuestion({ query: '   ', authentication: AUTH, runQueryFn })
    expect(runQueryFn).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: false, reason: 'error' })
  })
})
