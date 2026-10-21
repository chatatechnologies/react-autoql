import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { ReportTable } from '../components/ReportTable'
import { ReportChart, READ_ONLY_QUERY_OUTPUT_PROPS } from '../components/ReportChart'
import { CHART_BOX_ATTRIBUTE } from '../print/waitForCharts'
import { readMeasurements } from '../layout/measure'
import { footerText } from '../components/PageFurniture'

jest.mock('../../QueryOutput', () => {
  const mockReact = require('react')
  const calls = []
  const QueryOutput = (props) => {
    calls.push(props)
    return mockReact.createElement('div', { 'data-test': 'query-output' })
  }
  return { QueryOutput, __calls: calls }
})

const COLUMNS = [
  { index: 0, name: 'account', display_name: 'Account', type: 'STRING' },
  { index: 1, name: 'aum', display_name: 'AUM', type: 'DOLLAR_AMT' },
  { index: 2, name: 'units', display_name: 'Units', type: 'QUANTITY' },
]
const ROWS = [
  ['A-1', 1500.5, 3],
  ['A-2', 2000, null],
]

describe('ReportTable', () => {
  it('is a plain table of formatted cells, numbers right-aligned', () => {
    const { container } = render(<ReportTable columns={COLUMNS} rows={ROWS} />)
    const table = container.querySelector('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toStrictEqual(['Account', 'AUM', 'Units'])

    const cells = Array.from(table.querySelectorAll('tbody tr')[0].children)
    expect(cells.map((td) => td.textContent)).toStrictEqual(['A-1', '$1,500.50', '3'])
    expect(cells[0].hasAttribute('data-numeric')).toBe(false)
    expect(cells[1].hasAttribute('data-numeric')).toBe(true)
    expect(table.querySelectorAll('tbody tr')[1].children[2].textContent).toBe('')
  })

  it('draws every row it is given, since nothing is virtualised', () => {
    const rows = Array.from({ length: 100 }, (_, i) => [`A-${i}`, i, i])
    const { container } = render(<ReportTable columns={COLUMNS} rows={rows} />)
    expect(container.querySelectorAll('tbody tr[data-row]')).toHaveLength(100)
  })

  it('adds a total row only when given one, labelled in its label column', () => {
    const { container, rerender } = render(<ReportTable columns={COLUMNS} rows={ROWS} />)
    expect(container.querySelector('tr[data-total]')).toBeNull()

    rerender(<ReportTable columns={COLUMNS} rows={ROWS} total={{ labelIndex: 0, sums: { 1: 3500.5, 2: 3 } }} />)
    const total = container.querySelector('tr[data-total]')
    expect(Array.from(total.children).map((td) => td.textContent)).toStrictEqual(['Total', '$3,500.50', '3'])
  })

  it('can leave out its header, for a continuation that does not repeat it', () => {
    const { container } = render(<ReportTable columns={COLUMNS} rows={ROWS} showHeader={false} />)
    expect(container.querySelector('thead')).toBeNull()
  })
})

describe('ReportChart', () => {
  const { __calls: calls } = require('../../QueryOutput')
  beforeEach(() => calls.splice(0))

  const response = { data: { data: { columns: COLUMNS, rows: ROWS } } }
  const tile = {
    i: 'c1',
    query: 'aum by account',
    displayType: 'column',
    pageSize: 300,
    orders: [{ name: 'aum', sort: 'DESC' }],
    tableFilters: [{ name: 'region', value: 'West' }],
    columnVisibility: { units: false },
  }

  it('shows the tile’s own QueryOutput with everything that could change it turned off', () => {
    const { container } = render(
      <ReportChart
        view={{ tile, response, displayType: 'bar', height: 220 }}
        autoQLConfig={{ enableDrilldowns: true, projectId: 'p' }}
      />,
    )
    const box = container.querySelector(`[${CHART_BOX_ATTRIBUTE}]`)
    expect(box.style.height).toBe('220px')

    const props = calls[calls.length - 1]
    expect(props).toMatchObject(READ_ONLY_QUERY_OUTPUT_PROPS)
    expect(props).toMatchObject({
      allowDisplayTypeChange: false,
      enableDynamicCharting: false,
      enableChartControls: false,
      enableTableSorting: false,
      enableTableContextMenu: false,
      useInfiniteScroll: false,
      queryResponse: response,
      initialDisplayType: 'bar',
      dataPageSize: 300,
    })
    expect(props.autoQLConfig).toMatchObject({ enableDrilldowns: false, projectId: 'p' })
    expect(props.initialTableConfigs.columnVisibility).toStrictEqual({ units: false })
    expect(props.lockedFilters).toStrictEqual(tile.tableFilters)
  })

  it('shows a question with AutoQL’s defaults, since it has no tile', () => {
    render(<ReportChart view={{ tile: undefined, response, displayType: 'column', height: 280 }} />)
    const props = calls[calls.length - 1]
    expect(props).toMatchObject({
      queryResponse: response,
      initialDisplayType: 'column',
      allowDisplayTypeChange: false,
    })
    expect(props.initialTableConfigs).toBeUndefined()
  })

  it('does not redraw for an unrelated re-render', () => {
    const view = { tile, response, displayType: 'bar', height: 220 }
    const { rerender } = render(<ReportChart view={view} dataFormatting={{ currencyCode: 'USD' }} />)
    const before = calls.length
    rerender(<ReportChart view={view} dataFormatting={{ currencyCode: 'USD' }} />)
    expect(calls.length).toBe(before)
    rerender(<ReportChart view={{ ...view, height: 280 }} dataFormatting={{ currencyCode: 'USD' }} />)
    expect(calls.length).toBe(before + 1)
  })
})

describe('readMeasurements', () => {
  // A fake layout: each element reports the rect it's given.
  const box = (el, top, height, width = 600) => {
    el.getBoundingClientRect = () => ({ top, bottom: top + height, height, width, left: 0, right: width })
    return el
  }

  it('is null without layout, so the estimator is used instead', () => {
    const root = document.createElement('div')
    expect(readMeasurements(root)).toBeNull()
    expect(readMeasurements(null)).toBeNull()
  })

  it('reads block heights and splits a table into what each piece needs', () => {
    const root = box(document.createElement('div'), 0, 1000)
    root.innerHTML = `
      <div data-measure-id="h"></div>
      <div data-measure-id="t" data-measure-split="">
        <table data-measure-table="">
          <thead></thead>
          <tbody><tr data-row=""></tr><tr data-row=""></tr><tr data-total=""></tr></tbody>
        </table>
        <div data-measure-tail=""></div>
      </div>
      <div data-measure-continued=""></div>`
    box(root.querySelector('[data-measure-id="h"]'), 0, 30)
    // cell 100..240: title 100..120, table 120..200 (header 20, rows 25 + 25, total 10), tail 200..230, padding 10
    box(root.querySelector('[data-measure-id="t"]'), 100, 140)
    box(root.querySelector('table'), 120, 80)
    box(root.querySelector('thead'), 120, 20)
    const [r1, r2] = root.querySelectorAll('tr[data-row]')
    box(r1, 140, 25)
    box(r2, 165, 25)
    box(root.querySelector('tr[data-total]'), 190, 10)
    box(root.querySelector('[data-measure-tail]'), 200, 30)
    box(root.querySelector('[data-measure-continued]'), 300, 16)

    const m = readMeasurements(root)
    expect(m.blocks).toStrictEqual({ h: 30, t: 140 })
    expect(m.tables.t).toStrictEqual({ chrome: 30, header: 20, rows: [25, 25], tail: 40, continued: 16 })
    // Every part of the table is counted once.
    const t = m.tables.t
    expect(t.chrome + t.header + t.rows[0] + t.rows[1] + t.tail).toBe(m.blocks.t)
  })
})

describe('footerText', () => {
  it('dates the data once run, says so before, and says nothing about data a report does not have', () => {
    expect(footerText({ generated: '23 Sep 2026', dataAsOf: '23 Sep 2026, 14:05' })).toBe(
      'Generated 23 Sep 2026 · Data as of 23 Sep 2026, 14:05',
    )
    expect(footerText({ generated: '23 Sep 2026', dataAsOf: null })).toBe('Generated 23 Sep 2026 · Not yet run')
    expect(footerText({ generated: '23 Sep 2026', dataAsOf: null, hasData: false })).toBe('Generated 23 Sep 2026')
  })
})
