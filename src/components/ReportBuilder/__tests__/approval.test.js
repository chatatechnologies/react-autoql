import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ReportBuilder } from '..'
import { createEmptyReport, normalizeReport } from '../model/reportSchema'
import { approveReport, heldApproval, normalizeApproval, withoutApproval } from '../model/approval'
import { FOOTER_IN, getPageGeometry } from '../layout/pageGeometry'
import { printFrame } from '../print/printFrame'

// Approval (enableApproval, RW-372): a report prints as a draft, DRAFT across every page, until someone who can edit it
// says "I have reviewed and approved this report."; then it prints "Prepared by {name}, {date}" at the foot of every
// page, and opens as it prints, locked, until Edit… returns it to draft. The approval holds for the report as it was
// approved: changed anywhere, or copied, it's a draft.

// Charts aren't drawn in jsdom: QueryOutput is a stub, as in ReportBuilder.test.js.
jest.mock('../../QueryOutput', () => {
  const mockReact = require('react')
  return { QueryOutput: () => mockReact.createElement('div', { className: 'react-autoql-chart-container' }, 'chart') }
})
jest.mock('../run/brandingApi', () => ({ fetchBranding: jest.fn(), saveBranding: jest.fn() }))
jest.mock('../print/printFrame', () => {
  const actual = jest.requireActual('../print/printFrame')
  return { ...actual, printFrame: jest.fn(() => ({ printed: Promise.resolve(true), remove: jest.fn() })) }
})

const AUTH = { token: 't', apiKey: 'k', domain: 'https://example.test' }
const AT = '2026-11-17T18:00:00.000Z'
const ID = 'cccccccc-0000-4000-8000-000000000003'
const DAY = /\d{1,2} [A-Z][a-z]{2} \d{4}/

const reportOf = (page = {}) =>
  createEmptyReport({
    title: 'Q3 review',
    page,
    blocks: [
      { id: 'h', type: 'heading', text: 'Performance', level: 1 },
      { id: 'p', type: 'text', text: 'All regions grew.' },
    ],
  })

// A host that keeps the report in state, as a real one would.
const Host = React.forwardRef(function Host({ initial, spy, ...props }, ref) {
  const [report, setReport] = React.useState(initial)
  return (
    <ReportBuilder
      ref={ref}
      authentication={AUTH}
      report={report}
      onChange={(next) => {
        spy?.(next)
        setReport(next)
      }}
      {...props}
    />
  )
})

const APPROVAL = { enableApproval: true, approverName: 'Dana Lee', reportId: ID }

const setup = (initial = reportOf(), props = APPROVAL) => {
  const spy = jest.fn()
  const ref = React.createRef()
  const utils = render(<Host ref={ref} initial={initial} spy={spy} {...props} />)
  return { ...utils, spy, ref, lastReport: () => spy.mock.calls[spy.mock.calls.length - 1]?.[0] }
}

const status = () => screen.queryByTestId('report-builder-approval-status')
const pagesOf = (container) => Array.from(container.querySelectorAll('.react-autoql-report-builder-page'))
const footersOf = (container) =>
  pagesOf(container).map((page) => page.querySelector('.react-autoql-report-builder-page-footer')?.textContent ?? null)
const watermarksOf = (container) =>
  pagesOf(container).map((page) => page.querySelector('[data-test="report-page-watermark"]')?.textContent ?? null)
const mode = () => screen.getByTestId('report-builder').getAttribute('data-mode')
const openOptions = () => fireEvent.click(screen.getByRole('button', { name: 'Report options' }))
const option = (name) => screen.queryByRole('menuitem', { name })

beforeEach(() => {
  printFrame.mockClear()
})

describe('an approval (model/approval.js)', () => {
  it('is made of the report as it is, and holds until anything in it changes', () => {
    const report = reportOf()
    const approved = approveReport(report, { name: ' Dana Lee ', at: AT, reportId: ID })
    expect(approved.approval).toStrictEqual({ name: 'Dana Lee', at: AT, fingerprint: expect.any(String) })
    expect(withoutApproval(approved)).toStrictEqual(report)
    expect(heldApproval(approved, ID)).toStrictEqual(approved.approval)

    // Read back from the service, its keys in another order: the same report.
    const readBack = JSON.parse(
      JSON.stringify({
        blocks: approved.blocks.map((block) => Object.fromEntries(Object.entries(block).reverse())),
        approval: approved.approval,
        page: Object.fromEntries(Object.entries(approved.page).reverse()),
        title: approved.title,
        schemaVersion: approved.schemaVersion,
      }),
    )
    expect(heldApproval(readBack, ID)).toStrictEqual(approved.approval)

    // Anything changed: its title, a block, a page setting, what it's for.
    const changed = (patch) => heldApproval({ ...approved, ...patch }, ID)
    expect(changed({ title: 'Q3 review, final' })).toBeNull()
    expect(changed({ blocks: [approved.blocks[0], { ...approved.blocks[1], text: 'Most regions grew.' }] })).toBeNull()
    expect(changed({ blocks: approved.blocks.slice(0, 1) })).toBeNull()
    expect(changed({ page: { ...approved.page, orientation: 'landscape' } })).toBeNull()
    expect(
      changed({ sessionFilterLocks: [{ key: 'household', value: 'Brown Family', filter_type: 'include' }] }),
    ).toBeNull()
  })

  it('holds for the report it was made for only: not a copy kept under another id', () => {
    const approved = approveReport(reportOf(), { name: 'Dana Lee', at: AT, reportId: ID })
    expect(heldApproval(approved, 'dddddddd-0000-4000-8000-000000000004')).toBeNull()
    expect(heldApproval(approved, undefined)).toBeNull()
    // Made where the host keeps no id, it holds there.
    const unkept = approveReport(reportOf(), { name: 'Dana Lee', at: AT })
    expect(heldApproval(unkept)).toStrictEqual(unkept.approval)
  })

  it('isn’t one without a name, a time that can be read, and what was approved; the report keeps only one that is', () => {
    const good = { name: 'Dana Lee', at: AT, fingerprint: 'abc' }
    expect(normalizeApproval(good)).toStrictEqual(good)
    expect(normalizeApproval({ ...good, name: '  ' })).toBeNull()
    expect(normalizeApproval({ ...good, at: 'yesterday' })).toBeNull()
    expect(normalizeApproval({ ...good, fingerprint: undefined })).toBeNull()
    expect(normalizeApproval('Dana Lee')).toBeNull()

    expect(normalizeReport({ ...reportOf(), approval: good }).approval).toStrictEqual(good)
    expect(normalizeReport({ ...reportOf(), approval: { name: 'Dana Lee' } })).not.toHaveProperty('approval')
    expect(normalizeReport(reportOf())).not.toHaveProperty('approval')
    const report = reportOf()
    expect(withoutApproval(report)).toBe(report)
  })

  it('keeps the footer’s room on every page while approval is on, whatever the page setup says', () => {
    const page = { footer: false, pageNumbers: false }
    expect(getPageGeometry(page).footerIn).toBe(0)
    expect(getPageGeometry(page, { approval: true }).footerIn).toBe(FOOTER_IN)
    expect(getPageGeometry(page, { approval: true }).contentHeightIn).toBe(
      getPageGeometry({ footer: true }).contentHeightIn,
    )
  })
})

describe('a draft (enableApproval)', () => {
  it('says it’s a draft, and prints DRAFT across every page, cover and all, with the footer’s room kept', async () => {
    const { container } = setup(reportOf({ coverPage: true, footer: false, pageNumbers: false }))
    expect(status()).toHaveTextContent('Draft')
    expect(status()).toHaveAttribute('data-state', 'draft')

    fireEvent.click(screen.getByTestId('report-builder-open-preview'))
    await waitFor(() => expect(pagesOf(container)).toHaveLength(2))
    expect(watermarksOf(container)).toStrictEqual(['DRAFT', 'DRAFT'])
    // Kept, with nothing in it: a draft says nothing there.
    expect(footersOf(container)).toStrictEqual(['', ''])
  })

  it('prints its pages with DRAFT on them', async () => {
    const { ref } = setup()
    await act(async () => {
      await ref.current.print()
    })
    const { pages } = printFrame.mock.calls[0][0]
    expect(pages.length).toBeGreaterThan(0)
    pages.forEach((page) =>
      expect(page.querySelector('[data-test="report-page-watermark"]')).toHaveTextContent('DRAFT'),
    )
  })

  it('is approved once asked, from Report options, under the host’s name, and shows as it prints from then on', async () => {
    const { container, lastReport, spy } = setup()
    openOptions()
    fireEvent.click(option('Approve…'))
    const dialog = screen.getByTestId('report-builder-approve-dialog')
    expect(dialog).toHaveTextContent('I have reviewed and approved this report.')
    // Going on takes a deliberate choice.
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(spy).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))
    const approved = lastReport()
    expect(approved.approval).toStrictEqual({
      name: 'Dana Lee',
      at: expect.any(String),
      fingerprint: expect.any(String),
    })
    expect(Date.parse(approved.approval.at)).not.toBeNaN()
    expect(heldApproval(approved, ID)).toStrictEqual(approved.approval)
    expect(withoutApproval(approved)).toStrictEqual(normalizeReport(reportOf()))
    expect(screen.queryByTestId('report-builder-approve-dialog')).toBeNull()

    // Locked: as it prints, under its own title, with Print and Edit… but nothing that changes it.
    expect(mode()).toBe('preview')
    expect(screen.getByTestId('report-builder-toolbar-heading')).toHaveTextContent('Q3 review')
    expect(status()).toHaveAttribute('data-state', 'approved')
    expect(status().textContent).toMatch(new RegExp(`^Approved by Dana Lee, ${DAY.source}$`))
    expect(screen.getByTestId('report-builder-print')).toBeTruthy()
    expect(screen.getByTestId('report-builder-edit-approved')).toBeTruthy()
    expect(screen.queryByTestId('report-builder-close-preview')).toBeNull()
    expect(screen.queryByTestId('report-builder-approve')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Report options' })).toBeNull()

    await waitFor(() => expect(pagesOf(container)).toHaveLength(1))
    expect(watermarksOf(container)).toStrictEqual([null])
    expect(footersOf(container)[0]).toMatch(new RegExp(`Prepared by Dana Lee, ${DAY.source} · Page 1 of 1$`))
  })

  it('is approved from the preview too, where it’s reviewed', async () => {
    const { lastReport } = setup()
    fireEvent.click(screen.getByTestId('report-builder-open-preview'))
    fireEvent.click(screen.getByTestId('report-builder-approve'))
    fireEvent.click(
      within(screen.getByTestId('report-builder-approve-dialog')).getByRole('button', { name: 'Approve' }),
    )
    expect(heldApproval(lastReport(), ID)).toBeTruthy()
    expect(screen.getByTestId('report-builder-edit-approved')).toBeTruthy()
  })

  it('stays a draft when the question is cancelled', () => {
    const { spy } = setup()
    openOptions()
    fireEvent.click(option('Approve…'))
    fireEvent.click(screen.getByTestId('report-builder-approve-dialog-cancel'))
    expect(screen.queryByTestId('report-builder-approve-dialog')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    expect(status()).toHaveTextContent('Draft')
  })

  it('can’t be approved while an answer is on its way, which would change it once it is', () => {
    const { ref } = setup()
    act(() => ref.current.setState({ pending: { p: { kind: 'question', seq: 1 } } }))
    openOptions()
    expect(option('Approve…')).toBeNull()
    fireEvent.click(screen.getByTestId('report-builder-open-preview'))
    const approve = screen.getByTestId('report-builder-approve')
    expect(approve).toBeDisabled()
    expect(approve).toHaveAttribute('title', 'Wait for the answers on their way, then approve the report.')

    // One that didn't answer isn't on its way.
    act(() => ref.current.setState({ pending: { p: { kind: 'question', seq: 1, error: 'No answer' } } }))
    expect(screen.getByTestId('report-builder-approve')).toBeEnabled()
  })

  it('can’t be approved without the name of whoever approves it', () => {
    setup(reportOf(), { enableApproval: true, reportId: ID })
    expect(status()).toHaveTextContent('Draft')
    openOptions()
    expect(option('Approve…')).toBeNull()
    fireEvent.click(screen.getByTestId('report-builder-open-preview'))
    expect(screen.queryByTestId('report-builder-approve')).toBeNull()
  })
})

describe('an approved report', () => {
  const approved = (report = reportOf(), reportId = ID) => approveReport(report, { name: 'Dana Lee', at: AT, reportId })

  it('opens as it prints, saying who prepared it at the foot of every page, cover and all, footer off or not', async () => {
    const { container, spy } = setup(approved(reportOf({ coverPage: true, footer: false, pageNumbers: false })))
    expect(mode()).toBe('preview')
    expect(status()).toHaveTextContent(`Approved by Dana Lee, ${new Date(AT).getDate()} Nov 2026`)
    await waitFor(() => expect(pagesOf(container)).toHaveLength(2))
    expect(watermarksOf(container)).toStrictEqual([null, null])
    const prepared = `Prepared by Dana Lee, ${new Date(AT).getDate()} Nov 2026`
    expect(footersOf(container)).toStrictEqual([prepared, prepared])
    expect(spy).not.toHaveBeenCalled()
  })

  it('goes back to draft once asked, from Edit…, and to the editor', () => {
    const { lastReport, spy } = setup(approved())
    fireEvent.click(screen.getByTestId('report-builder-edit-approved'))
    const dialog = screen.getByTestId('report-builder-edit-dialog')
    expect(dialog).toHaveTextContent('This report is approved. Changing it returns it to draft.')

    // Cancelled, it stays approved.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(spy).not.toHaveBeenCalled()
    expect(mode()).toBe('preview')

    fireEvent.click(screen.getByTestId('report-builder-edit-approved'))
    fireEvent.click(screen.getByTestId('report-builder-edit-dialog-confirm'))
    expect(lastReport()).not.toHaveProperty('approval')
    expect(withoutApproval(lastReport())).toStrictEqual(normalizeReport(reportOf()))
    expect(mode()).toBe('edit')
    expect(status()).toHaveTextContent('Draft')
    expect(screen.getByTestId('report-builder-title').value).toBe('Q3 review')
  })

  it('is a draft once it’s changed anywhere, and the first change made here ends the approval it carries', () => {
    const changed = { ...approved(), title: 'Q3 review (with Add to Report)' }
    const { lastReport } = setup(changed)
    expect(mode()).toBe('edit')
    expect(status()).toHaveTextContent('Draft')

    // Changed back, it isn't approved again.
    fireEvent.change(screen.getByTestId('report-builder-title'), { target: { value: 'Q3 review' } })
    expect(lastReport()).not.toHaveProperty('approval')
    expect(status()).toHaveTextContent('Draft')
  })

  it('is a draft as a copy kept under another id: a template made from it, a report started from that', () => {
    setup(approved(reportOf(), 'dddddddd-0000-4000-8000-000000000004'))
    expect(mode()).toBe('edit')
    expect(status()).toHaveTextContent('Draft')
  })

  it('takes Escape to close the question, and keeps the focus inside it on Tab', () => {
    setup(approved())
    fireEvent.click(screen.getByTestId('report-builder-edit-approved'))
    const dialog = screen.getByTestId('report-builder-edit-dialog')
    const buttons = within(dialog).getAllByRole('button')
    buttons[buttons.length - 1].focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(buttons[0]).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByTestId('report-builder-edit-dialog')).toBeNull()
    expect(mode()).toBe('preview')
  })
})

describe('without enableApproval', () => {
  it('changes nothing: no status, no DRAFT, no room kept, and a report’s approval isn’t looked at', async () => {
    const report = approveReport(reportOf({ footer: false, pageNumbers: false }), {
      name: 'Dana Lee',
      at: AT,
      reportId: ID,
    })
    const { container } = setup(report, { reportId: ID, approverName: 'Dana Lee' })
    expect(mode()).toBe('edit')
    expect(status()).toBeNull()
    openOptions()
    expect(option('Approve…')).toBeNull()
    fireEvent.click(screen.getByTestId('report-builder-open-preview'))
    await waitFor(() => expect(pagesOf(container)).toHaveLength(1))
    expect(watermarksOf(container)).toStrictEqual([null])
    expect(footersOf(container)).toStrictEqual([null])
    expect(screen.queryByTestId('report-builder-approve')).toBeNull()
  })
})
