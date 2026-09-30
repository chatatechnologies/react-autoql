import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { fetchLLMSummary, runQuery } from 'autoql-fe-utils'
import { ReportBuilder } from '..'
import { createEmptyReport } from '../model/reportSchema'
import { printFrame } from '../print/printFrame'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  runQuery: jest.fn(),
  fetchLLMSummary: jest.fn(),
}))

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
  fetchLLMSummary.mockReset()
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

// jsdom measures nothing, so the panel starts from its own width (15rem, 240px) and may reach 40rem (640px).
describe('the properties panel’s width', () => {
  const KEY = 'react-autoql-report-builder-panel-width'
  const edge = () => screen.getByTestId('report-builder-panel-resizer')
  const drag = (from, to, buttons = 1) => {
    fireEvent.mouseDown(edge(), { button: 0, clientX: from })
    fireEvent.mouseMove(document, { clientX: to, buttons })
  }

  afterEach(() => localStorage.clear())

  it('widens as its edge is dragged left, and remembers the width once let go', () => {
    setup()
    expect(edge().getAttribute('role')).toBe('separator')
    expect(edge().getAttribute('aria-controls')).toBe(panel().id)
    expect(panel().style.width).toBe('')

    drag(1000, 900)
    expect(panel().style.width).toBe('340px')
    expect(edge().getAttribute('aria-valuenow')).toBe('340')
    expect(localStorage.getItem(KEY)).toBeNull()

    fireEvent.mouseUp(document)
    expect(localStorage.getItem(KEY)).toBe('340')
    fireEvent.mouseMove(document, { clientX: 700, buttons: 1 })
    expect(panel().style.width).toBe('340px')
  })

  it('stays between its own width and 40rem', () => {
    setup()
    drag(1000, -3000)
    expect(panel().style.width).toBe('640px')
    fireEvent.mouseUp(document)

    drag(1000, 3000)
    expect(panel().style.width).toBe('240px')
    fireEvent.mouseUp(document)
  })

  it('covers the window only once the edge moves, so a click or double-click still gets through', () => {
    setup()
    const overlay = () => document.querySelector('.react-autoql-report-builder-panel-resize-overlay')
    fireEvent.mouseDown(edge(), { button: 0, clientX: 1000 })
    expect(overlay()).toBeNull()
    fireEvent.mouseUp(document)

    drag(1000, 990)
    expect(overlay()).not.toBeNull()
    expect(edge().hasAttribute('data-dragging')).toBe(true)
    fireEvent.mouseUp(document)
    expect(overlay()).toBeNull()
    expect(edge().hasAttribute('data-dragging')).toBe(false)
  })

  it('ends a drag let go outside the window', () => {
    setup()
    drag(1000, 950)
    fireEvent.mouseMove(document, { clientX: 800, buttons: 0 })
    expect(panel().style.width).toBe('290px')
    expect(localStorage.getItem(KEY)).toBe('290')
    fireEvent.mouseMove(document, { clientX: 700, buttons: 1 })
    expect(panel().style.width).toBe('290px')
  })

  it('resizes from the keyboard, and goes back to its own width on a double-click', () => {
    setup()
    fireEvent.keyDown(edge(), { key: 'ArrowLeft' })
    expect(panel().style.width).toBe('256px')
    fireEvent.keyDown(edge(), { key: 'ArrowLeft', shiftKey: true })
    expect(panel().style.width).toBe('320px')
    fireEvent.keyDown(edge(), { key: 'ArrowRight' })
    expect(panel().style.width).toBe('304px')
    expect(localStorage.getItem(KEY)).toBe('304')
    fireEvent.keyDown(edge(), { key: 'End' })
    expect(panel().style.width).toBe('640px')
    fireEvent.keyDown(edge(), { key: 'Home' })
    expect(panel().style.width).toBe('240px')

    fireEvent.doubleClick(edge())
    expect(panel().style.width).toBe('')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('opens at the width it was left at, and ignores a width it can’t use', () => {
    localStorage.setItem(KEY, '420')
    const first = setup()
    expect(panel().style.width).toBe('420px')
    first.unmount()

    localStorage.setItem(KEY, 'wide')
    const second = setup()
    expect(panel().style.width).toBe('')
    second.unmount()

    const blocked = () => {
      throw new Error('blocked')
    }
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    try {
      setup()
      expect(panel().style.width).toBe('')
      drag(1000, 900)
      fireEvent.mouseUp(document)
      expect(panel().style.width).toBe('340px')
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })

  it('stops following the mouse once the builder is gone', () => {
    const { unmount } = setup()
    const remove = jest.spyOn(document, 'removeEventListener')
    try {
      drag(1000, 900)
      unmount()
      expect(remove).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(remove).toHaveBeenCalledWith('mouseup', expect.any(Function))
    } finally {
      remove.mockRestore()
    }
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
    interpretation = 'total aum by account',
  }) => ({
    version: 1,
    capturedAt: CAPTURED_AT,
    displayType,
    data: {
      // Transformed columns, as the answer held them (field, is_visible), with the grouping column.
      columns: COLUMNS.map((col, i) => ({ ...col, field: String(i), is_visible: true, groupable: i === 0 })),
      rows,
      count_rows: countRows,
      interpretation,
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

  const interpretationOf = (container) => container.querySelector('.react-autoql-report-builder-interpretation')

  it('shows how the question was read under its answer', () => {
    const { container } = setup(captured(captureOf({ rows: rowsOf(3) })))
    expect(interpretationOf(container).textContent).toBe('Interpreted as total aum by account')
  })

  // A dashboard tile's answer arrives with an empty interpretation, so the setting printed nothing and
  // looked broken. The editor says why; nothing is added to what prints.
  it('says in the editor why a dashboard tile’s answer has no interpretation to print', () => {
    const { container } = setup(captured(captureOf({ rows: rowsOf(3), interpretation: '' })))
    const note = interpretationOf(container)
    expect(note.hasAttribute('data-missing')).toBe(true)
    expect(note.textContent).toBe('No interpretation to print: dashboard tiles don’t come with one yet.')
  })

  it('says nothing about interpretations once they are turned off', () => {
    const withOne = captured(captureOf({ rows: rowsOf(3) }))
    withOne.page.showInterpretation = false
    const withNone = captured(captureOf({ rows: rowsOf(3), interpretation: '' }))
    withNone.page.showInterpretation = false
    expect(interpretationOf(setup(withOne).container)).toBeNull()
    expect(interpretationOf(setup(withNone).container)).toBeNull()
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

describe('Data blocks made in the builder (enableDataBlocks)', () => {
  const deferred = () => {
    let resolve
    let reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  // A tile block as the host's picker makes it: the tile as its source, what it showed as its capture.
  const pickedBlock = (id, tileKey, rows) => ({
    id,
    type: 'data',
    width: 'full',
    rows: 25,
    source: tileSourceOf(tileKey),
    capture: {
      version: 1,
      capturedAt: new Date(2026, 8, 29, 13, 0).toISOString(),
      displayType: 'table',
      data: { columns: COLUMNS, rows: rowsOf(rows), count_rows: rows },
      table: { sort: [], filtered: false },
      config: { displayType: 'table' },
    },
  })

  const EMPTY = { id: 'e', type: 'data', source: null, rows: 25, width: 'full' }
  const around = (block) =>
    createEmptyReport({
      blocks: [
        { id: 'a', type: 'heading', text: 'Before', level: 2, width: 'full' },
        block,
        { id: 'z', type: 'heading', text: 'After', level: 2, width: 'full' },
      ],
    })

  const setupPicking = (initial, props = {}) =>
    setup(initial, { enableDataBlocks: true, pickDashboardTiles: jest.fn(() => null), ...props })

  it('offers a Data block, described by what can fill it', () => {
    const { unmount } = setup(createEmptyReport(), { enableDataBlocks: true })
    expect(screen.getByRole('button', { name: 'Data' })).toBeTruthy()
    expect(screen.getByText(/a question you ask here, or an answer added with/)).toBeTruthy()
    unmount()

    setupPicking()
    expect(screen.getByText(/a question you ask here, dashboard tiles you pick, or an answer/)).toBeTruthy()
  })

  it('inserts an empty Data block that asks a question or picks tiles, on the page and in the panel', () => {
    const { lastReport } = setupPicking()
    fireEvent.click(screen.getByRole('button', { name: 'Data' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/ask a question, or pick dashboard tiles/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Insert block' }))

    expect(lastReport().blocks).toMatchObject([{ type: 'data', source: null }])
    expect(screen.getByTestId('report-builder-ask')).toBeTruthy()
    expect(screen.getByTestId('report-builder-pick-tiles').textContent).toBe('Pick dashboard tiles…')
    expect(within(panel()).getByTestId('report-builder-question')).toBeTruthy()
    expect(within(panel()).getByTestId('report-builder-panel-pick-tiles')).toBeTruthy()
    expect(within(panel()).getByText(/Each tile you pick becomes a Data block of its own/)).toBeTruthy()
  })

  it('asks without a tile picker, too', () => {
    setup(createEmptyReport({ blocks: [EMPTY] }), { enableDataBlocks: true })
    expect(screen.getByTestId('report-builder-ask')).toBeTruthy()
    expect(screen.queryByTestId('report-builder-pick-tiles')).toBeNull()
  })

  it('puts the picked tiles in the empty block’s place, in order, and selects the first', async () => {
    const pick = deferred()
    const pickDashboardTiles = jest.fn(() => pick.promise)
    const { lastReport } = setupPicking(around(EMPTY), { pickDashboardTiles })

    fireEvent.click(screen.getByTestId('report-builder-pick-tiles'))
    expect(pickDashboardTiles).toHaveBeenCalledTimes(1)

    await act(async () => pick.resolve([pickedBlock('p1', 't1', 3), pickedBlock('p2', 't2', 4)]))

    await waitFor(() => expect(lastReport().blocks.map((block) => block.id)).toStrictEqual(['a', 'p1', 'p2', 'z']))
    expect(lastReport().blocks[1]).toMatchObject({ type: 'data', source: tileSourceOf('t1') })
    expect(lastReport().blocks[1].capture.data.rows).toHaveLength(3)
    // The first picked block is selected: the panel shows what it captured.
    expect(within(panel()).getByText('Captured')).toBeTruthy()
  })

  it('asks the host once while its picker is open', async () => {
    const pick = deferred()
    const pickDashboardTiles = jest.fn(() => pick.promise)
    setupPicking(around(EMPTY), { pickDashboardTiles })

    fireEvent.click(screen.getByTestId('report-builder-pick-tiles'))
    const button = await screen.findByText('Picking tiles…')
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(pickDashboardTiles).toHaveBeenCalledTimes(1)

    await act(async () => pick.resolve(null))
    await waitFor(() => expect(screen.getByTestId('report-builder-pick-tiles').disabled).toBe(false))
  })

  it('leaves the block as it is when the picker closes with nothing', async () => {
    const pick = deferred()
    const { spy } = setupPicking(around(EMPTY), { pickDashboardTiles: () => pick.promise })
    fireEvent.click(screen.getByTestId('report-builder-pick-tiles'))
    await act(async () => pick.resolve([]))
    await waitFor(() =>
      expect(screen.getByTestId('report-builder-pick-tiles').textContent).toBe('Pick dashboard tiles…'),
    )
    expect(spy).not.toHaveBeenCalled()
  })

  it('drops the tiles when the block was deleted while picking', async () => {
    const pick = deferred()
    const { lastReport } = setupPicking(around(EMPTY), { pickDashboardTiles: () => pick.promise })
    selectBlock('Data')
    fireEvent.click(screen.getByTestId('report-builder-pick-tiles'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(lastReport().blocks.map((block) => block.id)).toStrictEqual(['a', 'z'])

    await act(async () => pick.resolve([pickedBlock('p1', 't1', 3)]))
    expect(lastReport().blocks.map((block) => block.id)).toStrictEqual(['a', 'z'])
  })

  it('does nothing once the builder has gone away', async () => {
    const pick = deferred()
    const { spy, unmount } = setupPicking(around(EMPTY), { pickDashboardTiles: () => pick.promise })
    fireEvent.click(screen.getByTestId('report-builder-pick-tiles'))
    unmount()
    await act(async () => pick.resolve([pickedBlock('p1', 't1', 3)]))
    expect(spy).not.toHaveBeenCalled()
  })

  it('reports a picker that failed, and keeps the block', async () => {
    const pick = deferred()
    const onErrorCallback = jest.fn()
    const { spy } = setupPicking(around(EMPTY), { pickDashboardTiles: () => pick.promise, onErrorCallback })
    fireEvent.click(screen.getByTestId('report-builder-pick-tiles'))
    const error = new Error('no dashboards')
    await act(async () => pick.reject(error))
    await waitFor(() => expect(onErrorCallback).toHaveBeenCalledWith(error))
    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByTestId('report-builder-pick-tiles').disabled).toBe(false)
  })

  it('builds on what it last emitted when the host passes it back late', async () => {
    // A host that applies each change only when told to.
    let flush = () => {}
    const spy = jest.fn()
    const LateHost = ({ initial, ...props }) => {
      const [report, setReport] = React.useState(initial)
      flush = () => setReport(spy.mock.calls[spy.mock.calls.length - 1][0])
      return <ReportBuilder authentication={AUTH} dashboards={DASHBOARDS} report={report} onChange={spy} {...props} />
    }
    const pick = deferred()
    render(<LateHost initial={around(EMPTY)} enableDataBlocks pickDashboardTiles={() => pick.promise} />)

    fireEvent.click(screen.getByTestId('report-builder-pick-tiles'))
    fireEvent.change(screen.getByTestId('report-builder-title'), { target: { value: 'Q3 review' } })
    await act(async () => pick.resolve([pickedBlock('p1', 't1', 3)]))

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    const last = spy.mock.calls[1][0]
    expect(last.title).toBe('Q3 review')
    expect(last.blocks.map((block) => block.id)).toStrictEqual(['a', 'p1', 'z'])
    act(() => flush())
  })

  it('gives a picked block a new id when it would clash with one in the report', async () => {
    const pick = deferred()
    const { lastReport } = setupPicking(around(EMPTY), { pickDashboardTiles: () => pick.promise })
    fireEvent.click(screen.getByTestId('report-builder-pick-tiles'))
    await act(async () => pick.resolve([pickedBlock('a', 't1', 3), pickedBlock('a', 't2', 2)]))
    await waitFor(() => expect(lastReport().blocks).toHaveLength(4))
    const ids = lastReport().blocks.map((block) => block.id)
    expect(new Set(ids).size).toBe(4)
    expect(ids[0]).toBe('a')
  })

  it('keeps running reports’ own Data block when both are on', () => {
    setup(createEmptyReport({ blocks: [EMPTY] }), {
      enableRunReport: true,
      enableDataBlocks: true,
      pickDashboardTiles: jest.fn(),
    })
    expect(screen.queryByTestId('report-builder-pick-tiles')).toBeNull()
    expect(screen.queryByTestId('report-builder-ask')).toBeNull()
    expect(screen.getByPlaceholderText('Type a query in your own words')).toBeTruthy()
  })
})

describe('questions asked in the builder (enableDataBlocks)', () => {
  const EMPTY = { id: 'e', type: 'data', source: null, rows: 25, width: 'full' }
  const captureOfRows = (n) => ({
    version: 1,
    capturedAt: new Date(2026, 8, 29, 13, 0).toISOString(),
    displayType: 'table',
    data: { columns: COLUMNS, rows: rowsOf(n), count_rows: n },
    table: { sort: [], filtered: false },
    config: { displayType: 'table' },
  })
  const ASKED = {
    id: 'q',
    type: 'data',
    width: 'full',
    rows: 25,
    source: { type: 'query', query: 'aum by account' },
    capture: captureOfRows(2),
    askedHere: true,
  }

  const setupAsking = (initial, props = {}) => setup(initial, { enableDataBlocks: true, ...props })
  const ask = (text) => {
    const input = screen.getByTestId('report-builder-ask')
    fireEvent.change(input, { target: { value: text } })
    fireEvent.keyDown(input, { key: 'Enter' })
  }

  it('asks a question once and keeps the answer, marked as asked here', async () => {
    runQuery.mockResolvedValue(responseOf(rowsOf(3)))
    const { lastReport } = setupAsking(createEmptyReport({ blocks: [EMPTY] }))

    ask('aum by account')
    expect(screen.getByText('Asking “aum by account”…')).toBeTruthy()

    await waitFor(() =>
      expect(lastReport()?.blocks[0]).toMatchObject({
        id: 'e',
        type: 'data',
        source: { type: 'query', query: 'aum by account' },
        askedHere: true,
        // Three rows fit the smallest option, so the block prints them all.
        rows: 10,
      }),
    )
    expect(runQuery).toHaveBeenCalledTimes(1)
    expect(runQuery.mock.calls[0][0]).toMatchObject({
      query: 'aum by account',
      source: 'report_builder.question',
      pageSize: 2000,
    })
    expect(lastReport().blocks[0].capture.data.rows).toHaveLength(3)
    expect(JSON.parse(JSON.stringify(lastReport()))).toStrictEqual(lastReport())
    expect(screen.getByText('“aum by account”')).toBeTruthy()
  })

  it('asks from the panel as well', async () => {
    runQuery.mockResolvedValue(responseOf(rowsOf(3)))
    const { lastReport } = setupAsking(createEmptyReport({ blocks: [EMPTY] }))
    selectBlock('Data')
    const box = within(panel()).getByTestId('report-builder-question')
    fireEvent.change(box, { target: { value: 'aum by account' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(lastReport()?.blocks[0].askedHere).toBe(true))
  })

  it('keeps a question that failed in the block, with why, to be asked again', async () => {
    runQuery.mockRejectedValue({ data: { message: 'The query timed out.', reference_id: '1.1.504' } })
    const { spy } = setupAsking(createEmptyReport({ blocks: [EMPTY] }))

    ask('aum by account')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('That question didn’t run. The query timed out.')
    expect(screen.getByTestId('report-builder-ask').value).toBe('aum by account')
    expect(spy).not.toHaveBeenCalled()

    runQuery.mockResolvedValue(responseOf(rowsOf(3)))
    ask('aum by account')
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
  })

  it('reruns only a question asked here, keeping how the block is shown', async () => {
    const added = { ...ASKED, id: 'x', askedHere: undefined }
    const tile = { ...ASKED, id: 't', source: tileSourceOf('t1'), askedHere: undefined }
    const { lastReport } = setupAsking(createEmptyReport({ blocks: [{ ...ASKED, rows: 50 }, added, tile] }))

    selectBlock('Data', 1)
    expect(within(panel()).queryByTestId('report-builder-rerun')).toBeNull()
    selectBlock('Data', 2)
    expect(within(panel()).queryByTestId('report-builder-rerun')).toBeNull()

    selectBlock('Data', 0)
    runQuery.mockResolvedValue(responseOf(rowsOf(5)))
    fireEvent.click(within(panel()).getByTestId('report-builder-rerun'))
    expect(within(panel()).getByTestId('report-builder-rerun').textContent).toBe('Asking again…')

    await waitFor(() => expect(lastReport()?.blocks[0].capture.data.rows).toHaveLength(5))
    expect(runQuery.mock.calls[0][0]).toMatchObject({ query: 'aum by account' })
    expect(lastReport().blocks[0]).toMatchObject({ id: 'q', rows: 50, askedHere: true })
    expect(within(panel()).getByTestId('report-builder-rerun').textContent).toBe('Rerun')
  })

  it('drops the answer for a block deleted while asking', async () => {
    let answer
    runQuery.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    const { lastReport } = setupAsking(
      createEmptyReport({ blocks: [EMPTY, { id: 'z', type: 'heading', text: 'After', level: 2, width: 'full' }] }),
    )
    selectBlock('Data')
    ask('aum by account')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await act(async () => answer(responseOf(rowsOf(3))))
    expect(lastReport().blocks.map((block) => block.id)).toStrictEqual(['z'])
  })

  it('stops asking when the builder goes away', async () => {
    let request
    runQuery.mockImplementation((req) => {
      request = req
      return new Promise((resolve, reject) => {
        req.cancelToken.addEventListener('abort', () => reject(new Error('canceled')))
      })
    })
    const { spy, unmount } = setupAsking(createEmptyReport({ blocks: [EMPTY] }))
    ask('aum by account')
    unmount()

    expect(request.cancelToken.aborted).toBe(true)
    await act(async () => {})
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('analysis blocks (enableAnalysis)', () => {
  const CAPTURED_AT = new Date(2026, 8, 29, 13, 0).toISOString()
  const resultBlock = (extra = {}) => ({
    id: 'd',
    type: 'data',
    width: 'full',
    rows: 25,
    source: { type: 'query', query: 'aum by account' },
    capture: {
      version: 1,
      capturedAt: CAPTURED_AT,
      displayType: 'table',
      data: { columns: COLUMNS, rows: rowsOf(30), count_rows: 30, text: 'aum by account', query_id: 'q_1' },
      table: { sort: [], filtered: false },
      config: { displayType: 'table' },
    },
    ...extra,
  })
  const analysisBlock = (extra = {}) => ({
    id: 'a',
    type: 'analysis',
    width: 'full',
    target: 'd',
    focus: '',
    text: '',
    ...extra,
  })
  const reportOf = (...blocks) => createEmptyReport({ title: 'Q3', blocks })
  const summary = (text) => Promise.resolve({ data: { data: { summary: text } } })
  const analysisIn = (report) => report.blocks.find((block) => block.type === 'analysis')

  it('offers an Analysis block only with enableAnalysis, and says it costs a credit', () => {
    const { unmount } = setup()
    expect(screen.queryByRole('button', { name: 'Analysis' })).toBeNull()
    unmount()

    setup(createEmptyReport(), { enableAnalysis: true })
    fireEvent.click(screen.getByRole('button', { name: 'Analysis' }))
    expect(within(screen.getByRole('dialog')).getByText('Each run uses one Auto Analyze credit.')).toBeTruthy()
  })

  it('writes about the chosen result, from the rows the block shows', async () => {
    fetchLLMSummary.mockReturnValue(summary('**Leader** leads.\n\n- one\n- two'))
    const { lastReport } = setup(reportOf(resultBlock(), analysisBlock()), { enableAnalysis: true })

    selectBlock('Analysis')
    expect(within(panel()).getByTestId('report-builder-analysis-target').value).toBe('d')
    fireEvent.click(within(panel()).getByTestId('report-builder-analyze'))
    expect(within(panel()).getByTestId('report-builder-analyze').textContent).toBe('Analyzing…')

    await waitFor(() => expect(analysisIn(lastReport())?.text).toBe('**Leader** leads.\n\n- one\n- two'))
    expect(fetchLLMSummary).toHaveBeenCalledTimes(1)
    const [request] = fetchLLMSummary.mock.calls[0]
    expect(request.queryID).toBe('q_1')
    expect(request.data.rows).toHaveLength(25)
    expect(request.data.columns).toHaveLength(2)
    expect(request.data.additional_context).toMatchObject({
      text: 'aum by account, first 25 of 30 rows',
      focus_prompt: '',
    })
    expect(analysisIn(lastReport())).toMatchObject({
      targetAsOf: CAPTURED_AT,
      targetTitle: 'aum by account',
      focusUsed: '',
      rowsAnalyzed: 25,
    })
    expect(screen.getByText('Leader').tagName).toBe('STRONG')
    expect(screen.getByText('✦ Auto Analyze · from “aum by account”')).toBeTruthy()
    expect(within(panel()).getByTestId('report-builder-analyze').textContent).toBe('Analyze again')
  })

  it('asks again with the focus given, and replaces the wording', async () => {
    fetchLLMSummary.mockReturnValue(summary('Growth was uneven.'))
    const { lastReport } = setup(reportOf(resultBlock(), analysisBlock({ text: 'Old words.' })), {
      enableAnalysis: true,
    })

    selectBlock('Analysis')
    fireEvent.change(within(panel()).getByTestId('report-builder-analysis-focus'), { target: { value: 'growth' } })
    fireEvent.click(within(panel()).getByTestId('report-builder-analyze'))

    await waitFor(() => expect(analysisIn(lastReport()).text).toBe('Growth was uneven.'))
    expect(fetchLLMSummary.mock.calls[0][0].data.additional_context.focus_prompt).toBe('growth')
    expect(analysisIn(lastReport()).focusUsed).toBe('growth')
    expect(screen.getByText('✦ Auto Analyze · from “aum by account” · focus: growth')).toBeTruthy()
  })

  it('says why Auto Analyze didn’t write, and changes nothing', async () => {
    fetchLLMSummary.mockReturnValue(
      Promise.reject({ data: { code: 'BILLING_USAGE_CEILING_REACHED', outcome: 'BLOCK_CEILING_EXCEEDED' } }),
    )
    const { spy } = setup(reportOf(resultBlock(), analysisBlock()), { enableAnalysis: true })
    selectBlock('Analysis')
    fireEvent.click(within(panel()).getByTestId('report-builder-analyze'))

    expect(await within(panel()).findByText(/at or over its monthly quota/)).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
    expect(within(panel()).getByTestId('report-builder-analyze').disabled).toBe(false)
  })

  it('adds an analysis after a result from its toolbar, and writes it', async () => {
    fetchLLMSummary.mockReturnValue(summary('A-30 is largest.'))
    const tail = { id: 'z', type: 'heading', text: 'After', level: 2, width: 'full' }
    const { lastReport } = setup(reportOf(resultBlock(), tail), { enableAnalysis: true })

    selectBlock('Data')
    fireEvent.click(screen.getByTestId('report-builder-analyze-result'))

    expect(lastReport().blocks.map((block) => block.type)).toStrictEqual(['data', 'analysis', 'heading'])
    expect(analysisIn(lastReport()).target).toBe('d')
    await waitFor(() => expect(analysisIn(lastReport()).text).toBe('A-30 is largest.'))
    expect(fetchLLMSummary).toHaveBeenCalledTimes(1)
  })

  it('can’t analyze a result kept without a query id', () => {
    const noId = resultBlock()
    delete noId.capture.data.query_id
    setup(reportOf(noId, analysisBlock()), { enableAnalysis: true })

    selectBlock('Data')
    expect(screen.queryByTestId('report-builder-analyze-result')).toBeNull()
    selectBlock('Analysis')
    expect(within(panel()).getByTestId('report-builder-analyze').disabled).toBe(true)
    expect(within(panel()).getByText(/without the query id Auto Analyze needs/)).toBeTruthy()
  })

  it('shows and prints an analysis without enableAnalysis, but won’t write one', async () => {
    const written = analysisBlock({ text: 'Up **18%** on Q2.', targetTitle: 'aum by account', targetAsOf: CAPTURED_AT })
    const { container } = setup(reportOf(resultBlock(), written))
    expect(screen.getByText('18%').tagName).toBe('STRONG')

    selectBlock('Analysis')
    expect(within(panel()).queryByTestId('report-builder-analyze')).toBeNull()
    selectBlock('Data')
    expect(screen.queryByTestId('report-builder-analyze-result')).toBeNull()

    fireEvent.click(screen.getByTestId('report-builder-open-preview'))
    await waitFor(() => expect(container.querySelector('.react-autoql-report-builder-page')).not.toBeNull())
    const pages = [...container.querySelectorAll('.react-autoql-report-builder-page')]
    expect(pages.some((page) => page.textContent.includes('Up 18% on Q2.'))).toBe(true)
  })

  it('notes in the editor when its result has changed since, or was removed', () => {
    const changed = analysisBlock({ text: 'Old.', targetAsOf: '2026-09-01T00:00:00.000Z' })
    const { unmount } = setup(reportOf(resultBlock(), changed), { enableAnalysis: true })
    expect(screen.getByText(/Its result has changed since this was written/)).toBeTruthy()
    unmount()

    setup(reportOf(analysisBlock({ text: 'Orphan.', target: 'gone' })), { enableAnalysis: true })
    expect(screen.getByText(/has been removed from the report/)).toBeTruthy()
  })

  it('drops the wording for an analysis deleted while it was being written', async () => {
    let answer
    fetchLLMSummary.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    const { lastReport } = setup(reportOf(resultBlock(), analysisBlock()), { enableAnalysis: true })
    selectBlock('Analysis')
    fireEvent.click(within(panel()).getByTestId('report-builder-analyze'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await act(async () => answer({ data: { data: { summary: 'Too late.' } } }))
    expect(lastReport().blocks.map((block) => block.id)).toStrictEqual(['d'])
  })

  it('keeps Auto Analyze’s wording with real line breaks', async () => {
    fetchLLMSummary.mockReturnValue(summary('First.\\nSecond.'))
    const { lastReport } = setup(reportOf(resultBlock(), analysisBlock()), { enableAnalysis: true })
    selectBlock('Analysis')
    fireEvent.click(within(panel()).getByTestId('report-builder-analyze'))
    await waitFor(() => expect(analysisIn(lastReport())?.text).toBe('First.\nSecond.'))
  })

  describe('editing the wording on the page', () => {
    // As some answers come back: with the characters "\n" rather than a line break.
    const written = (text = 'Up **18%** on Q2.\\n- one') =>
      reportOf(resultBlock(), analysisBlock({ text, targetTitle: 'aum by account', targetAsOf: CAPTURED_AT }))
    const wording = () => screen.getByTestId('report-builder-analysis-wording')
    const editor = () => screen.queryByTestId('report-builder-analysis-edit')

    it('edits its Markdown in place, and shows it printed again once left', () => {
      const { lastReport } = setup(written())
      selectBlock('Analysis')
      expect(within(panel()).getByTestId('report-builder-analysis-text').value).toBe('Up **18%** on Q2.\n- one')

      fireEvent.click(wording())
      expect(editor().value).toBe('Up **18%** on Q2.\n- one')
      expect(document.activeElement).toBe(editor())
      // jsdom can't say where a click fell, so the caret goes to the end.
      expect(editor().selectionStart).toBe(editor().value.length)
      expect(screen.getByText(/Click away or press Esc/)).toBeTruthy()

      fireEvent.change(editor(), { target: { value: 'Up **20%** on Q2.' } })
      expect(analysisIn(lastReport()).text).toBe('Up **20%** on Q2.')
      fireEvent.blur(editor())
      expect(editor()).toBeNull()
      expect(screen.getByText('20%').tagName).toBe('STRONG')
    })

    it('puts the caret where the wording was clicked', () => {
      setup(written('Up **18%** on Q2.'))
      const node = wording().querySelector('p').lastChild // " on Q2."
      document.caretRangeFromPoint = jest.fn(() => {
        const range = document.createRange()
        range.setStart(node, 4)
        range.collapse(true)
        return range
      })
      try {
        fireEvent.click(wording(), { clientX: 40, clientY: 12 })
        expect(editor().selectionStart).toBe('Up **18%** on '.length)
      } finally {
        delete document.caretRangeFromPoint
      }
    })

    it('stays open while the wording is emptied, and closes on Esc', () => {
      setup(written())
      fireEvent.click(wording())
      fireEvent.change(editor(), { target: { value: '' } })
      expect(editor()).not.toBeNull()
      expect(screen.queryByText('Nothing written yet')).toBeNull()

      fireEvent.keyDown(editor(), { key: 'Escape' })
      expect(editor()).toBeNull()
      expect(screen.getByText('Nothing written yet')).toBeTruthy()
      expect(document.activeElement).toBe(screen.getByRole('group', { name: 'Analysis' }))
    })

    it('edits from the keyboard', () => {
      setup(written())
      wording().focus()
      fireEvent.keyDown(wording(), { key: 'Enter' })
      expect(document.activeElement).toBe(editor())
    })

    it('leaves alone a drag that selected some of the wording', () => {
      setup(written())
      const getSelection = jest
        .spyOn(window, 'getSelection')
        .mockReturnValue({ isCollapsed: false, toString: () => 'Up 18%' })
      try {
        fireEvent.click(wording())
        expect(editor()).toBeNull()
      } finally {
        getSelection.mockRestore()
      }
    })

    it('closes, and can’t be opened, while Auto Analyze rewrites it', async () => {
      let answer
      fetchLLMSummary.mockReturnValue(new Promise((resolve) => (answer = resolve)))
      setup(written(), { enableAnalysis: true })
      selectBlock('Analysis')
      fireEvent.click(wording())
      expect(editor()).not.toBeNull()

      fireEvent.click(within(panel()).getByTestId('report-builder-analyze'))
      expect(editor()).toBeNull()
      expect(screen.queryByTestId('report-builder-analysis-wording')).toBeNull()

      await act(async () => answer({ data: { data: { summary: 'New words.' } } }))
      expect(wording().textContent).toBe('New words.')
    })

    it('can’t be edited in the preview', async () => {
      const { container } = setup(written())
      fireEvent.click(screen.getByTestId('report-builder-open-preview'))
      await waitFor(() => expect(container.querySelector('.react-autoql-report-builder-page')).not.toBeNull())
      expect(container.querySelector('[data-editable]')).toBeNull()
      expect(editor()).toBeNull()
    })
  })
})

describe('Get started (onGetStarted)', () => {
  it('offers a new report when the host can start one', () => {
    const { unmount } = setup()
    expect(screen.queryByTestId('report-builder-get-started')).toBeNull()
    unmount()

    const onGetStarted = jest.fn()
    setup(createEmptyReport(), { onGetStarted })
    expect(screen.getByText('Start from a question, a dashboard, or a blank page.')).toBeTruthy()
    fireEvent.click(screen.getByTestId('report-builder-get-started'))
    expect(onGetStarted).toHaveBeenCalledTimes(1)
  })
})
