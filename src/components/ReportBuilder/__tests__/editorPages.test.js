import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { ReportBuilder } from '..'
import { createEmptyReport } from '../model/reportSchema'
import { getPageGeometry } from '../layout/pageGeometry'
import { pageFills, rowPagesOf, Sheet } from '../components/Sheet'

// The editor's pages: rows go on the page their blocks start on in print, each page is topped up to a
// page's height, and pages are separated by a gap carrying the footer and the next page's header.

const block = (id, text = id) => ({ id, type: 'text', text, width: 'full', style: {} })
const noop = () => {}

describe('rowPagesOf', () => {
  it('puts a row on the page its blocks start on, and keeps a row that doesn’t print with the page before', () => {
    const rows = [[block('a')], [block('empty', '')], [block('b')], [block('c')]]
    expect(rowPagesOf(rows, { a: 0, b: 1, c: 1 })).toStrictEqual([0, 0, 1, 1])
  })

  it('never goes back a page', () => {
    expect(rowPagesOf([[block('a')], [block('b')]], { a: 2, b: 1 })).toStrictEqual([2, 2])
  })
})

describe('pageFills', () => {
  it('tops each page up to its content height, and lets a page that needs more just grow', () => {
    expect(pageFills({ starts: [100, 1200], ends: [700, 2400], contentHeight: 864 })).toStrictEqual([264, 0])
  })
})

describe('Sheet as pages', () => {
  const report = createEmptyReport({
    title: 'Board pack',
    page: { header: true, footer: true, pageNumbers: true },
    blocks: [block('a', 'First'), block('b', 'Second'), block('c', 'Third')],
  })
  const sheet = (props = {}) =>
    render(
      <Sheet
        report={report}
        views={{}}
        geometry={getPageGeometry(report.page)}
        footerLeft='Generated today'
        onSelect={noop}
        onAction={noop}
        onText={noop}
        onAsk={noop}
        {...props}
      />,
    )

  it('is one sheet until it knows where the pages break', () => {
    const { container } = sheet()
    expect(screen.queryByTestId('report-builder-page-gap')).toBeNull()
    expect(container.querySelector('.react-autoql-report-builder-sheet').hasAttribute('data-paged')).toBe(false)
  })

  it('breaks where print does, with each page’s footer and the next page’s header in between', () => {
    const { container } = sheet({ startPages: { a: 0, b: 0, c: 1 }, pageCount: 2 })
    const gaps = screen.getAllByTestId('report-builder-page-gap')
    expect(gaps).toHaveLength(1)
    expect(within(gaps[0]).getByText('Page 1 of 2')).toBeTruthy()
    expect(within(gaps[0]).getByText('Board pack')).toBeTruthy()
    // The gap sits between the rows of "Second" and "Third".
    const order = Array.from(container.querySelectorAll('[data-test="report-builder-page-gap"], textarea')).map((el) =>
      el.tagName === 'TEXTAREA' ? el.value : 'gap',
    )
    expect(order).toStrictEqual(['First', 'Second', 'gap', 'Third'])
    // The last page's footer ends the sheet.
    const footers = container.querySelectorAll('.react-autoql-report-builder-page-footer')
    expect(footers[footers.length - 1].textContent).toContain('Page 2 of 2')
  })

  it('counts the pages printed before the content in its page numbers', () => {
    sheet({ startPages: { a: 0, b: 1, c: 1 }, pageCount: 2, frontPages: 1 })
    expect(within(screen.getByTestId('report-builder-page-gap')).getByText('Page 2 of 3')).toBeTruthy()
  })
})

describe('the builder’s pages', () => {
  afterEach(() => jest.restoreAllMocks())

  it('lays the editor out as pages once it can measure, breaking where print does', async () => {
    // jsdom lays nothing out: every element gets a box 800 wide and 300 tall, so three text blocks
    // don't fit on one Letter page (864px of content) and the third starts a second page.
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 300,
      width: 800,
      height: 300,
    }))
    const report = createEmptyReport({ blocks: [block('a', 'First'), block('b', 'Second'), block('c', 'Third')] })
    render(<ReportBuilder report={report} />)
    await waitFor(() => expect(screen.getByTestId('report-builder-page-gap')).toBeTruthy(), { timeout: 3000 })
    expect(screen.getAllByTestId('report-builder-page-gap')).toHaveLength(1)
    await act(async () => {})
  })

  it('stays one sheet where nothing can be measured', async () => {
    render(<ReportBuilder report={createEmptyReport({ blocks: [block('a'), block('b'), block('c')] })} />)
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(screen.queryByTestId('report-builder-page-gap')).toBeNull()
  })
})
