import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { runQuery } from 'autoql-fe-utils'
import { ReportBuilder } from '..'
import { createEmptyReport } from '../model/reportSchema'
import { printFrame } from '../print/printFrame'

jest.mock('autoql-fe-utils', () => ({ ...jest.requireActual('autoql-fe-utils'), runQuery: jest.fn() }))

// Charts are covered in components.test.js; here QueryOutput is a stub so no chart is drawn in jsdom.
jest.mock('../../QueryOutput', () => {
  const mockReact = require('react')
  const calls = []
  const QueryOutput = (props) => {
    calls.push(props)
    return mockReact.createElement('div', { className: 'react-autoql-chart-container' }, 'chart')
  }
  return { QueryOutput, __calls: calls }
})

jest.mock('../print/printFrame', () => {
  const actual = jest.requireActual('../print/printFrame')
  return { ...actual, printFrame: jest.fn(() => ({ printed: Promise.resolve(true), remove: jest.fn() })) }
})

const AUTH = { token: 't', apiKey: 'k', domain: 'https://example.test' }
const COLUMNS = [
  { index: 0, name: 'account', display_name: 'Account', type: 'STRING' },
  { index: 1, name: 'aum', display_name: 'AUM', type: 'DOLLAR_AMT' },
]
const rowsOf = (n) => Array.from({ length: n }, (_, i) => [`A-${i + 1}`, 1000 * (i + 1)])
const responseOf = (rows, countRows = rows.length) => ({
  data: { reference_id: '1.1.200', data: { columns: COLUMNS, rows, count_rows: countRows } },
})

const DASHBOARDS = [
  {
    id: 'd1',
    name: 'Book of business',
    tiles: [
      {
        i: 't1',
        title: 'Accounts by AUM',
        query: 'aum by account',
        displayType: 'table',
        orders: [{ name: 'aum', sort: 'DESC' }],
      },
      { i: 't2', title: 'Revenue', query: 'revenue by month', displayType: 'column' },
      { i: 't3', title: 'Pivot', query: 'aum by region and month', displayType: 'pivot_table' },
    ],
  },
]

const tileSourceOf = (tileKey) => ({ type: 'tile', dashboardId: 'd1', tileKey })

// A host that keeps the report in state, as a real one would.
const Host = React.forwardRef(function Host({ initial, spy, ...props }, ref) {
  const [report, setReport] = React.useState(initial)
  return (
    <ReportBuilder
      ref={ref}
      authentication={AUTH}
      dashboards={DASHBOARDS}
      report={report}
      onChange={(next) => {
        spy?.(next)
        setReport(next)
      }}
      {...props}
    />
  )
})

const setup = (initial = createEmptyReport(), props = {}) => {
  const spy = jest.fn()
  const ref = React.createRef()
  const utils = render(<Host ref={ref} initial={initial} spy={spy} {...props} />)
  return { ...utils, spy, ref, lastReport: () => spy.mock.calls[spy.mock.calls.length - 1]?.[0] }
}

// Running is opt-in (enableRunReport); these tests cover the run model the builder keeps for rerunning.
const setupRunning = (initial, props = {}) => setup(initial, { enableRunReport: true, ...props })

const panel = () => screen.getByTestId('report-builder-panel')
const selectBlock = (label, index = 0) => fireEvent.mouseDown(screen.getAllByRole('group', { name: label })[index])

beforeEach(() => {
  runQuery.mockReset()
  printFrame.mockClear()
})

describe('the palette and its details layer', () => {
  it('opens the details layer on click and inserts nothing until Insert', () => {
    const { spy, lastReport } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Heading' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('A section title. The table of contents is built from these.')).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText('Level'), { target: { value: '1' } })
    expect(spy).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Insert block' }))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(lastReport().blocks).toMatchObject([{ type: 'heading', level: 1, text: '' }])
    expect(screen.queryByRole('dialog')).toBeNull()

    // The new block is selected, and carries what was chosen in the details layer.
    expect(within(panel()).getByLabelText('Level').value).toBe('1')
  })

  it('closes on Escape or a second click, still inserting nothing', () => {
    const { spy } = setupRunning()
    fireEvent.click(screen.getByRole('button', { name: 'Data' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('inserts after the selected block', () => {
    const { lastReport } = setup(
      createEmptyReport({
        blocks: [
          { id: 'a', type: 'heading', text: 'One', level: 2, width: 'full' },
          { id: 'b', type: 'heading', text: 'Two', level: 2, width: 'full' },
        ],
      }),
    )
    selectBlock('Heading', 0)
    fireEvent.click(screen.getByRole('button', { name: 'Page break' }))
    fireEvent.click(screen.getByRole('button', { name: 'Insert block' }))
    expect(lastReport().blocks.map((block) => block.type)).toStrictEqual(['heading', 'pagebreak', 'heading'])
  })
})

describe('the properties panel', () => {
  it('shows page setup when nothing is selected, with no paper picker', () => {
    setup()
    const p = panel()
    expect(within(p).getByText('Page setup')).toBeTruthy()
    expect(within(p).getByLabelText('Margins')).toBeTruthy()
    expect(within(p).getByLabelText('Typeface')).toBeTruthy()
    expect(within(p).getByRole('switch', { name: 'Cover page' })).toBeTruthy()
    expect(within(p).queryByText(/paper|A4/i)).toBeNull()
  })

  it('offers full styling for headings and text', () => {
    setup(createEmptyReport({ blocks: [{ id: 'h', type: 'heading', text: 'Revenue', level: 2, width: 'full' }] }))
    selectBlock('Heading')
    const p = panel()
    expect(within(p).getByLabelText('Level').value).toBe('2')
    ;['Font', 'Size', 'Weight'].forEach((label) => expect(within(p).getByLabelText(label)).toBeTruthy())
    expect(within(p).getByText('Text colour')).toBeTruthy()
    expect(within(p).getByRole('group', { name: 'Align' })).toBeTruthy()
    expect(within(p).getByText('Background')).toBeTruthy()
    expect(within(p).getByRole('button', { name: 'Reset to theme' })).toBeTruthy()
    // Title / Section / Subsection, not markdown-ish levels.
    expect(Array.from(within(p).getByLabelText('Level').options).map((o) => o.text)).toStrictEqual([
      'Title',
      'Section',
      'Subsection',
    ])
  })

  it('lets an empty data block pick a tile, hiding tiles v1 cannot print', () => {
    const { lastReport } = setupRunning(createEmptyReport({ blocks: [{ id: 'd', type: 'data', source: null }] }))
    selectBlock('Data')
    const p = panel()
    expect(within(p).getByLabelText('Ask a question')).toBeTruthy()

    fireEvent.change(within(p).getByTestId('report-builder-dashboard'), { target: { value: 'd1' } })
    const tileOptions = Array.from(within(p).getByTestId('report-builder-tile').options).map((o) => o.text)
    expect(tileOptions).toStrictEqual(['Choose a tile…', 'Accounts by AUM', 'Revenue'])
    expect(within(p).getByText(/1 tile isn’t listed/)).toBeTruthy()

    fireEvent.change(within(p).getByTestId('report-builder-tile'), { target: { value: 't1' } })
    expect(lastReport().blocks[0].source).toMatchObject({
      type: 'tile',
      dashboardId: 'd1',
      tileKey: 't1',
      snapshot: { tileTitle: 'Accounts by AUM', dashboardName: 'Book of business' },
    })
  })

  it('shows a filled data block’s source read-only, with Rows 10/25/50/100 and no styling', () => {
    setupRunning(createEmptyReport({ blocks: [{ id: 'd', type: 'data', source: tileSourceOf('t1') }] }))
    selectBlock('Data')
    const p = panel()
    const source = within(p).getByTestId('report-builder-source')
    expect(within(source).getByText('Book of business')).toBeTruthy()
    expect(within(source).getByText('Accounts by AUM')).toBeTruthy()

    const rows = within(p).getByTestId('report-builder-rows')
    expect(Array.from(rows.options).map((o) => Number(o.value))).toStrictEqual([10, 25, 50, 100])
    expect(rows.value).toBe('25')
    // Not run yet: the order is the tile's, but its column's display name isn't known.
    expect(within(p).getByText(/top rows in the tile’s own order/)).toBeTruthy()

    expect(within(p).queryByText('Align')).toBeNull()
    expect(within(p).queryByText('Background')).toBeNull()
    expect(within(p).queryByRole('button', { name: 'Reset to theme' })).toBeNull()
    expect(within(p).getByRole('group', { name: 'Width' })).toBeTruthy()
  })

  it('has no Rows control for a chart tile — a chart shows its tile as the dashboard does', () => {
    setupRunning(createEmptyReport({ blocks: [{ id: 'd', type: 'data', source: tileSourceOf('t2') }] }))
    selectBlock('Data')
    expect(within(panel()).queryByTestId('report-builder-rows')).toBeNull()
  })
})

describe('running a report', () => {
  const report = () =>
    createEmptyReport({
      title: 'Q3 book',
      blocks: [
        { id: 'h', type: 'heading', text: 'Accounts', level: 1 },
        { id: 'a', type: 'data', source: tileSourceOf('t1'), rows: 25 },
        { id: 'b', type: 'data', source: tileSourceOf('t1'), rows: 10 },
      ],
    })

  it('runs every data block as one run, deduped, and shows a cut-off table with its caption and no total', async () => {
    runQuery.mockResolvedValue(responseOf(rowsOf(100), 30044))
    setupRunning(report())
    expect(screen.getAllByText('Run the report to load this.')).toHaveLength(2)

    fireEvent.click(screen.getByTestId('report-builder-run'))
    await screen.findByText('Top 25 of 30,044 by AUM')

    expect(runQuery).toHaveBeenCalledTimes(1) // two blocks, one tile, one request
    expect(runQuery.mock.calls[0][0]).toMatchObject({
      query: 'aum by account',
      pageSize: 100,
      orders: [{ name: 'aum', sort: 'DESC' }],
      source: 'report_builder.tile',
      enableQueryValidation: false,
      allowSuggestions: false,
    })
    expect(screen.getByText('Top 10 of 30,044 by AUM')).toBeTruthy()
    expect(screen.queryByText('Total')).toBeNull()
    expect(screen.getByText(/^All data as of /)).toBeTruthy()
  })

  it('changes the rows without a re-run', async () => {
    runQuery.mockResolvedValue(responseOf(rowsOf(100), 30044))
    const { container } = setupRunning(report())
    fireEvent.click(screen.getByTestId('report-builder-run'))
    await screen.findByText('Top 25 of 30,044 by AUM')

    selectBlock('Data', 0)
    expect(within(panel()).getByText(/top rows by AUM — the tile’s own order/)).toBeTruthy()
    expect(within(panel()).getByText(/No total is shown while the table is cut off/)).toBeTruthy()
    fireEvent.change(within(panel()).getByTestId('report-builder-rows'), { target: { value: '50' } })
    await screen.findByText('Top 50 of 30,044 by AUM')
    expect(runQuery).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-block-id="a"]').querySelectorAll('tbody tr[data-row]')).toHaveLength(50)
  })

  it('totals a complete result, and only then', async () => {
    runQuery.mockResolvedValue(responseOf(rowsOf(8)))
    setupRunning(report())
    fireEvent.click(screen.getByTestId('report-builder-run'))
    const totals = await screen.findAllByText('Total')
    // Block a shows all 8 rows (complete); block b shows 10-of-8 = all 8 too.
    expect(totals).toHaveLength(2)
    expect(screen.getAllByText('$36,000.00')).toHaveLength(2)
  })

  it('says the template changed when a block would now fetch something else', async () => {
    runQuery.mockResolvedValue(responseOf(rowsOf(100), 30044))
    const { ref } = setupRunning(report())
    await act(() => ref.current.runReport())

    selectBlock('Data', 0)
    fireEvent.click(within(panel()).getByTestId('report-builder-change-source'))
    fireEvent.keyDown(within(panel()).getByTestId('report-builder-question'), {
      key: 'Enter',
      target: { value: 'aum by advisor' },
    })
    expect(screen.getByText(/template edited since/)).toBeTruthy()
    expect(screen.getByText('Changed since the last run. Run the report to update it.')).toBeTruthy()
  })

  it('resolves runReport() with a summary and reports it to the host', async () => {
    runQuery.mockResolvedValueOnce(responseOf(rowsOf(3)))
    const onRunComplete = jest.fn()
    const { ref } = setupRunning(report(), { onRunComplete })
    let summary
    await act(async () => {
      summary = await ref.current.runReport()
    })
    expect(summary).toMatchObject({ status: 'success' })
    expect(summary.blocks.map((b) => b.blockId).sort()).toStrictEqual(['a', 'b'])
    expect(typeof summary.runAt).toBe('string')
    expect(onRunComplete).toHaveBeenCalledWith(summary)
  })

  it('shows a failed query on its block and finishes the rest of the run', async () => {
    runQuery.mockImplementation((request) =>
      request.query === 'bad question'
        ? Promise.reject({ response: { data: { message: 'That didn’t work' } } })
        : Promise.resolve(responseOf(rowsOf(3))),
    )
    const { ref } = setupRunning(
      createEmptyReport({
        blocks: [
          { id: 'a', type: 'data', source: tileSourceOf('t1') },
          { id: 'q', type: 'data', source: { type: 'query', query: 'bad question' } },
        ],
      }),
    )
    let summary
    await act(async () => {
      summary = await ref.current.runReport()
    })
    expect(summary.status).toBe('partial')
    expect(screen.getByText('That didn’t work')).toBeTruthy()
    expect(screen.getByText('A-1')).toBeTruthy()
  })
})

describe('preview and print', () => {
  const withFrontMatter = () =>
    createEmptyReport({
      title: 'Board pack',
      page: { coverPage: true, tableOfContents: true },
      blocks: [
        { id: 'h', type: 'heading', text: 'Performance', level: 1 },
        { id: 'p', type: 'text', text: 'All regions grew.' },
        { id: 'empty', type: 'heading', text: '   ', level: 2 },
      ],
    })

  it('lays out true pages: cover, contents on its own page, then content with page numbers', async () => {
    const { container } = setup(withFrontMatter())
    fireEvent.click(screen.getByTestId('report-builder-open-preview'))

    await waitFor(() => expect(container.querySelectorAll('.react-autoql-report-builder-page')).toHaveLength(3))
    const pages = container.querySelectorAll('.react-autoql-report-builder-page')
    expect(within(pages[0]).getByText('Board pack')).toBeTruthy()
    expect(within(pages[0]).queryByText(/Page \d of/)).toBeNull() // no furniture on the cover
    const toc = within(pages[1]).getByRole('navigation', { name: 'Contents' })
    expect(within(toc).getByText('Performance')).toBeTruthy()
    expect(within(toc).getByText('3')).toBeTruthy()
    expect(within(pages[2]).getByText('Page 3 of 3')).toBeTruthy()
    expect(within(pages[2]).getByText('All regions grew.')).toBeTruthy()
    expect(screen.getByText('Letter · Portrait · 3 pages')).toBeTruthy()

    fireEvent.click(screen.getByTestId('report-builder-close-preview'))
    expect(container.querySelector('.react-autoql-report-builder-page')).toBeNull()
    expect(screen.getByTestId('report-builder-title').value).toBe('Board pack')
  })

  it('splits a long table across pages, repeating its header, with the caption on the last piece', async () => {
    runQuery.mockResolvedValue(responseOf(rowsOf(100), 30044))
    const { container, ref } = setupRunning(
      createEmptyReport({ blocks: [{ id: 'a', type: 'data', source: tileSourceOf('t1'), rows: 100 }] }),
    )
    await act(() => ref.current.runReport())
    await act(() => ref.current.openPrintPreview())

    await waitFor(() =>
      expect(container.querySelectorAll('.react-autoql-report-builder-page').length).toBeGreaterThan(1),
    )
    const pages = Array.from(container.querySelectorAll('.react-autoql-report-builder-page'))
    const rowCounts = pages.map((page) => page.querySelectorAll('tbody tr[data-row]').length)
    expect(rowCounts.reduce((a, b) => a + b, 0)).toBe(100)
    pages.forEach((page) => expect(page.querySelectorAll('thead')).toHaveLength(1))
    expect(within(pages[0]).getByText('Continued on the next page')).toBeTruthy()
    expect(within(pages[pages.length - 1]).getByText('Top 100 of 30,044 by AUM')).toBeTruthy()
    expect(container.querySelector('tr[data-total]')).toBeNull()
  })

  it('prints the preview’s pages, opening the preview first', async () => {
    const { ref, container } = setup(withFrontMatter())
    let printed
    await act(async () => {
      printed = await ref.current.print()
    })
    expect(printed).toBe(true)
    expect(printFrame).toHaveBeenCalledTimes(1)
    const { pages, title, orientation } = printFrame.mock.calls[0][0]
    expect(title).toBe('Board pack')
    expect(orientation).toBe('portrait')
    expect(pages).toHaveLength(3)
    expect(Array.from(pages)).toStrictEqual(Array.from(container.querySelectorAll('.react-autoql-report-builder-page')))
  })
})

describe('a controlled component', () => {
  it('keeps blocks and fields from a newer version through an edit', () => {
    const { lastReport } = setup(
      createEmptyReport({
        futureField: { keep: true },
        blocks: [
          { id: 'x', type: 'callout', text: 'from the future', tone: 'info' },
          { id: 'h', type: 'heading', text: 'Title', level: 1 },
        ],
      }),
    )
    fireEvent.change(screen.getByTestId('report-builder-title'), { target: { value: 'Renamed' } })
    expect(lastReport()).toMatchObject({
      title: 'Renamed',
      futureField: { keep: true },
      blocks: [{ id: 'x', type: 'callout', text: 'from the future', tone: 'info' }, { id: 'h' }],
    })
  })

  it('never puts query results into the report', async () => {
    runQuery.mockResolvedValue(responseOf(rowsOf(3)))
    const { ref, lastReport } = setupRunning(
      createEmptyReport({ blocks: [{ id: 'a', type: 'data', source: tileSourceOf('t1') }] }),
    )
    await act(() => ref.current.runReport())
    fireEvent.change(screen.getByTestId('report-builder-title'), { target: { value: 'After a run' } })
    expect(JSON.stringify(lastReport())).not.toContain('A-1')
    expect(JSON.parse(JSON.stringify(lastReport()))).toStrictEqual(lastReport())
  })
})

describe('blocks that carry what was captured (the default: no Run report)', () => {
  const { __calls: queryOutputCalls } = require('../../QueryOutput')
  const CAPTURED_AT = new Date(2026, 8, 23, 14, 5).toISOString()
  // As QueryOutput.captureForReport makes it: plain JSON, so no undefined values.
  const captureOf = ({
    rows,
    countRows = rows.length,
    displayType = 'table',
    sort = [],
    columnIndices,
    filters,
    config = {},
  }) => ({
    version: 1,
    capturedAt: CAPTURED_AT,
    displayType,
    data: {
      // Transformed columns, as the answer held them (field, is_visible), with the grouping column.
      columns: COLUMNS.map((col, i) => ({ ...col, field: String(i), is_visible: true, groupable: i === 0 })),
      rows,
      count_rows: countRows,
      interpretation: 'total aum by account',
    },
    ...(displayType === 'table'
      ? {
          table: {
            sort,
            filtered: !!filters?.length,
            ...(columnIndices ? { columnIndices } : {}),
            ...(filters ? { filters } : {}),
          },
        }
      : {}),
    config: { displayType, ...config },
  })
  const captured = (capture, extra = {}) =>
    createEmptyReport({
      title: 'Captured',
      blocks: [{ id: 'c', type: 'data', source: tileSourceOf('t1'), rows: 25, capture, ...extra }],
    })

  beforeEach(() => queryOutputCalls.splice(0))

  it('shows the captured rows with no Run report, and offers no Data block to insert', () => {
    const { container } = setup(
      captured(captureOf({ rows: rowsOf(30), countRows: 30044, sort: [{ name: 'aum', sort: 'DESC' }] })),
    )
    expect(screen.queryByTestId('report-builder-run')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Data' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Heading' })).toBeTruthy()

    expect(container.querySelectorAll('tbody tr[data-row]')).toHaveLength(25)
    expect(screen.getByText('Top 25 of 30,044 by AUM · As of 23 Sep 2026, 14:05')).toBeTruthy()
    expect(runQuery).not.toHaveBeenCalled()
  })

  it('says what a captured table was filtered to, since the page can’t show the filters', () => {
    setup(
      captured(
        captureOf({
          rows: rowsOf(30),
          countRows: 7672,
          sort: [{ name: 'aum', sort: 'DESC' }],
          filters: [
            { name: 'account', value: 'A-1' },
            { name: 'aum', value: '>5000' },
          ],
        }),
      ),
    )
    expect(
      screen.getByText('Top 25 of 7,672 by AUM · Filtered: Account “A-1”, AUM “>5000” · As of 23 Sep 2026, 14:05'),
    ).toBeTruthy()
  })

  it('keeps the captured column order and hides what was hidden', () => {
    const { container } = setup(captured(captureOf({ rows: rowsOf(3), columnIndices: [1, 0] })))
    const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent)
    expect(headers).toStrictEqual(['AUM', 'Account'])
  })

  it('totals a capture that holds the whole result', () => {
    setup(captured(captureOf({ rows: rowsOf(8) }), { rows: 10 }))
    expect(screen.getByText('Total')).toBeTruthy()
    expect(screen.getByText('$36,000.00')).toBeTruthy()
  })

  it('still shows what was captured after its tile is removed from the dashboard', () => {
    const report = captured(captureOf({ rows: rowsOf(3) }))
    report.blocks[0].source = { type: 'tile', dashboardId: 'd1', tileKey: 'gone', snapshot: { tileTitle: 'Old tile' } }
    setup(report)
    expect(screen.getByText('A-1')).toBeTruthy()
    expect(screen.queryByText('This tile is no longer on its dashboard.')).toBeNull()
  })

  it('redraws a captured chart with the settings it was captured with', () => {
    const tableConfig = { stringColumnIndex: 0, numberColumnIndices: [1] }
    const legendFilterConfig = { filteredOutLabels: ['A-2'] }
    setup(
      captured(
        captureOf({
          rows: rowsOf(6),
          displayType: 'column',
          config: { dataConfig: { tableConfig }, legendFilterConfig, chartControls: { showAverageLine: true } },
        }),
      ),
    )
    const props = queryOutputCalls[queryOutputCalls.length - 1]
    expect(props).toMatchObject({
      initialDisplayType: 'column',
      legendFilterConfig,
      initialChartControls: { showAverageLine: true },
      allowDisplayTypeChange: false,
    })
    expect(props.initialTableConfigs.tableConfig).toStrictEqual(tableConfig)
    expect(props.queryResponse.data.data.rows).toHaveLength(6)
    expect(screen.getByText('As of 23 Sep 2026, 14:05')).toBeTruthy()
  })

  it('shows when a block was captured, without a source picker', () => {
    setup(captured(captureOf({ rows: rowsOf(30), countRows: 30044 })))
    selectBlock('Data')
    const p = panel()
    const source = within(p).getByTestId('report-builder-source')
    expect(within(source).getByText('Captured')).toBeTruthy()
    expect(within(source).getByText('23 Sep 2026, 14:05')).toBeTruthy()
    expect(within(p).queryByTestId('report-builder-change-source')).toBeNull()
    expect(within(p).queryByLabelText('Ask a question')).toBeNull()
    expect(within(p).getByTestId('report-builder-rows')).toBeTruthy()
  })

  it('says a captured table keeps the order it was sorted in, whatever its source', () => {
    const report = captured(captureOf({ rows: rowsOf(30), countRows: 180, sort: [{ name: 'aum', sort: 'DESC' }] }))
    report.blocks[0].source = { type: 'query', query: 'aum by account' }
    setup(report)
    selectBlock('Data')
    const note = within(panel()).getByText(/A printed page can’t scroll/)
    expect(note.textContent).toContain('These are the top rows by AUM, sorted as the table was when it was added.')
    expect(note.textContent).not.toContain('Nothing sorts a question’s rows')
  })

  it('says an unsorted capture shows its first rows, not a top N', () => {
    setup(captured(captureOf({ rows: rowsOf(30), countRows: 180 })))
    selectBlock('Data')
    expect(within(panel()).getByText(/The table wasn’t sorted when it was added/).textContent).toContain(
      'these are its first 25 rows, not a top 25',
    )
  })

  it('shows every captured row once Rows asks for them', () => {
    const { container } = setup(captured(captureOf({ rows: rowsOf(100), countRows: 180 })))
    selectBlock('Data')
    fireEvent.change(within(panel()).getByTestId('report-builder-rows'), { target: { value: '100' } })
    expect(container.querySelectorAll('tbody tr[data-row]')).toHaveLength(100)
  })

  it('shows a capture as another chart or as a table, redrawn from what it keeps', () => {
    const { container, lastReport } = setup(captured(captureOf({ rows: rowsOf(6), displayType: 'column' })))
    selectBlock('Data')
    const showAs = within(panel()).getByRole('group', { name: 'Show as' })
    expect(
      within(showAs)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toStrictEqual(['Table', 'Column Chart', 'Bar Chart', 'Line Chart', 'Pie Chart', 'Histogram'])
    expect(within(showAs).getByRole('button', { name: 'Column Chart' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(within(showAs).getByRole('button', { name: 'Bar Chart' }))
    expect(lastReport().blocks[0].displayType).toBe('bar')
    expect(queryOutputCalls[queryOutputCalls.length - 1]).toMatchObject({
      initialDisplayType: 'bar',
      allowDisplayTypeChange: false,
    })
    expect(queryOutputCalls[queryOutputCalls.length - 1].queryResponse.data.data.rows).toHaveLength(6)

    fireEvent.click(within(panel()).getByRole('button', { name: 'Table' }))
    expect(lastReport().blocks[0].displayType).toBe('table')
    expect(container.querySelectorAll('tbody tr[data-row]')).toHaveLength(6)
  })

  it('says a chart of a cut-off table draws only the rows the block keeps', () => {
    const capture = captureOf({ rows: rowsOf(30), countRows: 30044, sort: [{ name: 'aum', sort: 'DESC' }] })
    setup(captured(capture, { displayType: 'column' }))
    expect(screen.getByText('Top 30 of 30,044 by AUM · As of 23 Sep 2026, 14:05')).toBeTruthy()
    selectBlock('Data')
    expect(within(panel()).getByText('The chart draws the 30 rows this block keeps, not all 30,044.')).toBeTruthy()
  })

  it('draws a capture as it was captured when the chosen chart doesn’t fit its data', () => {
    setup(captured(captureOf({ rows: rowsOf(6), displayType: 'column' }), { displayType: 'scatterplot' }))
    expect(queryOutputCalls[queryOutputCalls.length - 1]).toMatchObject({ initialDisplayType: 'column' })
  })

  it('says how to add data to a block that has none, rather than offering to run it', () => {
    setup(createEmptyReport({ blocks: [{ id: 'd', type: 'data', source: tileSourceOf('t1') }] }))
    expect(screen.getByText(/No data was kept for this block/)).toBeTruthy()
    expect(screen.queryByText('Run the report to load this.')).toBeNull()
  })

  it('prints no single data time, since each block carries its own', async () => {
    const { container } = setup(captured(captureOf({ rows: rowsOf(3) })))
    fireEvent.click(screen.getByTestId('report-builder-open-preview'))
    await waitFor(() => expect(container.querySelector('.react-autoql-report-builder-page')).not.toBeNull())
    const footer = container.querySelector('.react-autoql-report-builder-running-footer')
    expect(footer.textContent).toMatch(/^Generated /)
    expect(footer.textContent).not.toMatch(/Data as of|Not yet run/)
  })

  it('keeps the capture as plain JSON in the report', () => {
    const { lastReport } = setup(captured(captureOf({ rows: rowsOf(3) })))
    fireEvent.change(screen.getByTestId('report-builder-title'), { target: { value: 'Renamed' } })
    const saved = lastReport()
    expect(saved.blocks[0].capture.data.rows).toHaveLength(3)
    expect(JSON.parse(JSON.stringify(saved))).toStrictEqual(saved)
  })
})
