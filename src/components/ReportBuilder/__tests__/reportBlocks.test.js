import { captureReportBlock, tileBlocks } from '../workspace/reportBlocks'

// Blocks from what "Add to Report…" captures, and from the tiles the dashboard-tiles dialog asks its Dashboard for:
// each a Data block that keeps the answer as it was shown, and where it came from — the tile, or the question.

const capture = (rows, displayType = 'table') => ({
  version: 1,
  capturedAt: '2026-09-29T19:00:00.000Z',
  displayType,
  data: {
    columns: [{ name: 'region' }, { name: 'aum' }],
    rows: Array.from({ length: rows }, (_, i) => [`R-${i + 1}`, i]),
    count_rows: rows,
    text: 'total aum by region',
    query_id: 'q_1',
  },
  config: { displayType },
})

const entry = (overrides = {}) => ({
  tileKey: 'a',
  dashboardId: 'db_1',
  title: 'AUM by region',
  query: 'total aum by region',
  displayType: 'table',
  result: { ok: true, capture: capture(13) },
  ...overrides,
})

const DASHBOARD = {
  id: 'db_1',
  name: 'Firm overview',
  tiles: [
    { i: 'a', key: 'a', title: 'AUM by region', query: 'total aum by region', displayType: 'table' },
    { i: 'b', key: 'b', title: '', query: 'sales by month', displayType: 'column' },
  ],
}

const capturer = (entries) => ({ captureTilesForReport: jest.fn(() => entries) })

// The toolbar's second argument, capturing what it's given.
const extraOf = (result) => ({ captureForReport: jest.fn(() => result) })

describe('tileBlocks', () => {
  it('asks the dashboard for the ticked tiles, in order, with a report’s row limits', () => {
    const dashboard = capturer([])
    tileBlocks(dashboard, ['b', 'a'], DASHBOARD)
    expect(dashboard.captureTilesForReport).toHaveBeenCalledWith({
      tileKeys: ['b', 'a'],
      maxTableRows: 100,
      maxChartRows: 2000,
    })
  })

  it('makes a Data block per tile, with the tile as its source, as “Add to Report…” does', () => {
    const results = tileBlocks(
      capturer([
        entry(),
        entry({
          tileKey: 'b',
          title: 'sales by month',
          query: 'sales by month',
          displayType: 'column',
          result: { ok: true, capture: capture(12, 'column') },
        }),
      ]),
      ['a', 'b'],
      DASHBOARD,
    )

    expect(results.map((r) => r.tileKey)).toEqual(['a', 'b'])
    const [first, second] = results.map((r) => (r.result.ok ? r.result.block : null))
    expect(first).toMatchObject({
      type: 'data',
      width: 'full',
      // A 13-row table fits in 25 rows, so the block shows all of it.
      rows: 25,
      source: {
        type: 'tile',
        dashboardId: 'db_1',
        tileKey: 'a',
        snapshot: { dashboardName: 'Firm overview', tileTitle: 'AUM by region', query: 'total aum by region' },
      },
      capture: capture(13),
    })
    // An untitled tile is named by its question.
    expect(second).toMatchObject({ source: { tileKey: 'b', snapshot: { tileTitle: 'sales by month' } } })
    expect(first?.id).not.toBe(second?.id)
  })

  it('uses the dashboard’s id when the capture carries none', () => {
    const [result] = tileBlocks(capturer([entry({ dashboardId: undefined })]), ['a'], DASHBOARD)
    expect(result.result.ok && result.result.block.source).toMatchObject({ type: 'tile', dashboardId: 'db_1' })
  })

  it('says why a tile can’t be added', () => {
    const results = tileBlocks(
      capturer([
        entry({ result: { ok: false, reason: 'loading' } }),
        entry({ tileKey: 'gone', result: { ok: false, reason: 'not-found' } }),
        entry({ tileKey: 'b', result: { ok: false, reason: 'too-large', rowCount: 4200 } }),
      ]),
      ['a', 'gone', 'b'],
      DASHBOARD,
    )

    expect(results.map((r) => (r.result.ok ? null : r.result.message))).toEqual([
      'This tile hasn’t finished loading.',
      'This tile isn’t on the dashboard any more.',
      expect.stringContaining('4,200 rows'),
    ])
  })
})

describe('captureReportBlock', () => {
  it('keeps an answer as it’s shown, with a report’s row limits, and its question as the source', () => {
    const extra = extraOf({ ok: true, capture: capture(13) })
    const result = captureReportBlock({ data: { query: '  total aum by region ' }, extra })

    expect(extra.captureForReport).toHaveBeenCalledWith({ maxTableRows: 100, maxChartRows: 2000 })
    expect(result).toEqual({
      ok: true,
      block: {
        id: expect.any(String),
        type: 'data',
        width: 'full',
        rows: 25,
        source: { type: 'query', query: 'total aum by region' },
        capture: capture(13),
      },
    })
  })

  it('takes the question from the answer when the toolbar doesn’t say, and has no source without one', () => {
    const withText = captureReportBlock({ data: {}, extra: extraOf({ ok: true, capture: capture(3) }) })
    expect(withText.block.source).toEqual({ type: 'query', query: 'total aum by region' })

    const untold = { ...capture(3), data: { ...capture(3).data, text: undefined } }
    const without = captureReportBlock({ data: { query: '   ' }, extra: extraOf({ ok: true, capture: untold }) })
    expect(without.ok).toBe(true)
    expect(without.block.source).toBeNull()
  })

  it('keeps a dashboard tile as its source, with labels from the dashboard it’s on', () => {
    const result = captureReportBlock({
      data: { query: 'sales by month', tileKey: 'b' },
      extra: extraOf({ ok: true, capture: capture(12, 'column') }),
      dashboard: DASHBOARD,
    })
    expect(result.block.source).toEqual({
      type: 'tile',
      dashboardId: 'db_1',
      tileKey: 'b',
      snapshot: {
        dashboardName: 'Firm overview',
        tileTitle: 'sales by month',
        query: 'sales by month',
        displayType: 'column',
      },
    })
  })

  it('keeps the tile as told when the dashboard doesn’t have it, labelled by the question', () => {
    const result = captureReportBlock({
      data: { query: 'aum by advisor', tileKey: 7, dashboardId: 42 },
      extra: extraOf({ ok: true, capture: capture(5) }),
    })
    expect(result.block.source).toEqual({
      type: 'tile',
      dashboardId: '42',
      tileKey: '7',
      snapshot: {
        dashboardName: undefined,
        tileTitle: 'aum by advisor',
        query: 'aum by advisor',
        displayType: undefined,
      },
    })
  })

  it('prints a table that fits in full, and a longer one or a chart at the builder’s default', () => {
    const rowsFor = (count, displayType) =>
      captureReportBlock({ data: { query: 'q' }, extra: extraOf({ ok: true, capture: capture(count, displayType) }) })
        .block.rows
    expect(rowsFor(8)).toBe(10)
    expect(rowsFor(60)).toBe(100)
    expect(rowsFor(100)).toBe(100)
    expect(rowsFor(101)).toBe(25)
    expect(rowsFor(8, 'column')).toBe(25)
  })

  it('says why an answer can’t be added', () => {
    const messageOf = (extra) => {
      const result = captureReportBlock({ data: { query: 'q' }, extra })
      expect(result.ok).toBe(false)
      return result.message
    }
    const unsupported =
      'This kind of answer can’t be added to a report yet (pivot tables, network graphs, Sankey charts and treemaps).'

    // An older react-autoql passes no way to capture the answer.
    expect(messageOf(undefined)).toBe(unsupported)
    expect(messageOf({})).toBe(unsupported)
    expect(messageOf(extraOf({ ok: false, reason: 'unsupported' }))).toBe(unsupported)
    expect(messageOf(extraOf({ ok: false, reason: 'something new' }))).toBe(unsupported)
    expect(messageOf(extraOf({ ok: false, reason: 'no-data' }))).toBe('This answer has no data to add.')
    expect(messageOf(extraOf({ ok: false, reason: 'too-large', rowCount: 4200 }))).toBe(
      'This chart draws 4,200 rows — more than a report keeps (2,000). Narrow the question, or show it as a table first.',
    )
    expect(messageOf(extraOf({ ok: false, reason: 'too-large' }))).toContain('draws too many rows')
  })

  it('gives every block an id of its own', () => {
    const extra = extraOf({ ok: true, capture: capture(3) })
    const ids = [1, 2, 3].map(() => captureReportBlock({ data: { query: 'q' }, extra }).block.id)
    expect(new Set(ids).size).toBe(3)
  })
})
