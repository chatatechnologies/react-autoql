import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { createEmptyReport } from '../model/reportSchema'
import { appendReportBlock, createReport, fetchReports, ReportsApiError } from '../run/reportsApi'
import { AddToReportDialog } from '../workspace/AddToReportDialog'
import { REPORTS_PAGE_SIZE } from '../workspace/constants'
import { REPORT_TITLE_MAX } from '../workspace/documents'
import { REPORTS_STRINGS } from '../workspace/strings'

// AutoQL's report service is stubbed; its error class is the real one, which the dialog tells failures apart by.
jest.mock('../run/reportsApi', () => ({
  ReportsApiError: jest.requireActual('../run/reportsApi').ReportsApiError,
  fetchReports: jest.fn(),
  createReport: jest.fn(),
  appendReportBlock: jest.fn(),
}))

const S = REPORTS_STRINGS.addToReport
const E = REPORTS_STRINGS.errors
const AUTH = { apiKey: 'k', domain: 'https://example.test', token: 't' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// A Data block as "Add to Report…" makes it, still carrying the live response it was captured from — and the
// same block as it's sent.
const capture = (extra = {}) => ({
  version: 1,
  displayType: 'table',
  data: { columns: [{ name: 'account' }, { name: 'aum' }], rows: [['A-1', 1000]], count_rows: 1 },
  config: { displayType: 'table', ...extra },
})
const BLOCK = {
  id: 'block-1',
  type: 'data',
  width: 'full',
  rows: 25,
  source: { type: 'query', query: 'aum by account' },
  queryResponse: { data: { data: { rows: [] } }, refetch: () => {} },
  capture: capture({ queryResponse: { format: () => '' } }),
}
const CLEAN = {
  id: 'block-1',
  type: 'data',
  width: 'full',
  rows: 25,
  source: { type: 'query', query: 'aum by account' },
  capture: capture(),
}

// Most recently saved first, as the service lists them.
const REPORTS = [
  { id: 'r1', title: 'Q3 review', updatedAt: '2026-10-14T15:00:00.000Z' },
  { id: 'r2', title: '', updatedAt: '2026-10-02T09:30:00.000Z' },
  { id: 'r3', title: 'Book of business', updatedAt: '' },
]

const editedOn = (iso) => S.edited(new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }))

const deferred = () => {
  const out = {}
  out.promise = new Promise((resolve, reject) => {
    out.resolve = resolve
    out.reject = reject
  })
  return out
}

// The dialog as a host opens it, with what it's told (onAdded, then onClose) in the order it's told.
const setup = (props = {}) => {
  const told = []
  const onAdded = jest.fn(() => told.push('added'))
  const onClose = jest.fn(() => told.push('close'))
  const base = { authentication: AUTH, block: BLOCK, onAdded, onClose, ...props }
  const utils = render(<AddToReportDialog {...base} />)
  const rerender = (more) => utils.rerender(<AddToReportDialog {...base} {...more} />)
  return { ...utils, rerender, onAdded, onClose, told }
}

const dialog = () => screen.getByTestId('reports-add-to-report')
const status = () => within(dialog()).getByRole('status')
const addButton = () => screen.getByTestId('reports-add-to-report-add')
const nameField = () => screen.getByTestId('reports-add-to-report-name')
const newReport = () => screen.getByRole('radio', { name: S.newReport })
const report = (title) => screen.getByRole('radio', { name: new RegExp(`^${title}`) })
const listed = () => screen.findByRole('radiogroup', { name: S.chooseReport })
const rows = () =>
  screen.getAllByTestId('reports-add-to-report-report').map((row) => ({
    title: row.querySelector('.react-autoql-reports-choice-name').textContent,
    edited: row.querySelector('.react-autoql-reports-choice-aside')?.textContent ?? null,
    checked: within(row).getByRole('radio').checked,
  }))
const chosen = () =>
  screen
    .getAllByRole('radio')
    .filter((radio) => radio.checked)
    .map((radio) => radio.closest('li').querySelector('.react-autoql-reports-choice-name').textContent)

const added = (title, created) => ({ id: expect.stringMatching(UUID), title, created })
const storedAs = async ({ id, report: document }) => ({ id, title: document.title, version: 1, report: document })

beforeEach(() => {
  fetchReports.mockReset()
  createReport.mockReset()
  appendReportBlock.mockReset()
})

describe('AddToReportDialog', () => {
  it('lists the user’s reports as the service sends them, and chooses the most recently saved', async () => {
    fetchReports.mockResolvedValue({ reports: REPORTS })
    setup()
    expect(screen.getByRole('dialog', { name: S.title })).toBeInTheDocument()
    expect(screen.getByText(S.what('“aum by account”'))).toBeInTheDocument()
    expect(screen.getByText(REPORTS_STRINGS.loadingReports)).toBeInTheDocument()
    expect(addButton()).toBeDisabled()

    await listed()
    expect(fetchReports).toHaveBeenCalledTimes(1)
    expect(fetchReports).toHaveBeenCalledWith({ authentication: AUTH, pageSize: REPORTS_PAGE_SIZE })
    expect(rows()).toEqual([
      { title: 'Q3 review', edited: editedOn(REPORTS[0].updatedAt), checked: true },
      { title: REPORTS_STRINGS.untitled, edited: editedOn(REPORTS[1].updatedAt), checked: false },
      // A date that can't be read says nothing.
      { title: 'Book of business', edited: null, checked: false },
    ])
    expect(newReport()).not.toBeChecked()
    expect(screen.queryByTestId('reports-add-to-report-name')).toBeNull()
    expect(addButton()).toBeEnabled()
    expect(addButton()).toHaveTextContent(S.add)
    expect(status()).toBeEmptyDOMElement()
  })

  it('chooses “Create new report” when there are none, and wants a name for it', async () => {
    fetchReports.mockResolvedValue({ reports: [] })
    setup()
    await listed()
    expect(screen.queryAllByTestId('reports-add-to-report-report')).toHaveLength(0)
    expect(newReport()).toBeChecked()
    expect(nameField()).toHaveFocus()
    expect(nameField()).toHaveAttribute('maxLength', String(REPORT_TITLE_MAX))
    expect(nameField()).toHaveAttribute('placeholder', S.newNamePlaceholder)
    expect(screen.getByLabelText(S.newName)).toBe(nameField())
    expect(addButton()).toBeDisabled()
    fireEvent.change(nameField(), { target: { value: '   ' } })
    expect(addButton()).toBeDisabled()
    fireEvent.change(nameField(), { target: { value: 'Q4 review' } })
    expect(addButton()).toBeEnabled()
  })

  it('makes a new report of the block, named as typed and without its live response, then tells the host', async () => {
    fetchReports.mockResolvedValue({ reports: REPORTS })
    const stored = deferred()
    createReport.mockReturnValue(stored.promise)
    const { onAdded, onClose, told } = setup()
    await listed()

    fireEvent.click(newReport())
    expect(chosen()).toEqual([S.newReport])
    expect(nameField()).toHaveFocus()
    fireEvent.change(nameField(), { target: { value: '  Q4 review  ' } })
    fireEvent.click(addButton())

    expect(createReport).toHaveBeenCalledTimes(1)
    const [request] = createReport.mock.calls[0]
    expect(request).toEqual({
      authentication: AUTH,
      id: expect.stringMatching(UUID),
      report: createEmptyReport({ title: 'Q4 review', blocks: [CLEAN] }),
    })
    expect(JSON.stringify(request)).not.toContain('queryResponse')
    // The host's block is left as it was.
    expect(BLOCK.queryResponse).toBeDefined()
    expect(BLOCK.capture.config.queryResponse).toBeDefined()
    expect(addButton()).toBeDisabled()
    expect(addButton()).toHaveTextContent(S.adding)
    expect(onAdded).not.toHaveBeenCalled()

    await act(async () => stored.resolve(await storedAs(request)))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(onAdded).toHaveBeenCalledWith(added('Q4 review', true))
    expect(onAdded.mock.calls[0][0].id).toBe(request.id)
    expect(told).toEqual(['added', 'close'])
    expect(appendReportBlock).not.toHaveBeenCalled()
  })

  it('adds the block at the end of the report chosen, and tells the host which', async () => {
    fetchReports.mockResolvedValue({ reports: REPORTS })
    appendReportBlock.mockResolvedValue({ id: 'r3', version: 4, updatedAt: '', appended: true })
    const { onAdded, onClose, told } = setup()
    await listed()

    fireEvent.click(report('Book of business'))
    expect(chosen()).toEqual(['Book of business'])
    fireEvent.click(addButton())
    expect(appendReportBlock).toHaveBeenCalledTimes(1)
    expect(appendReportBlock).toHaveBeenCalledWith({ authentication: AUTH, id: 'r3', block: CLEAN })

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onAdded).toHaveBeenCalledWith({ id: 'r3', title: 'Book of business', created: false })
    expect(told).toEqual(['added', 'close'])
    expect(createReport).not.toHaveBeenCalled()
  })

  it('calls an untitled report what its row does', async () => {
    fetchReports.mockResolvedValue({ reports: REPORTS })
    appendReportBlock.mockResolvedValue({ id: 'r2', version: 2, updatedAt: '', appended: true })
    const { onAdded } = setup()
    await listed()
    fireEvent.click(report(REPORTS_STRINGS.untitled))
    fireEvent.click(addButton())
    await waitFor(() =>
      expect(onAdded).toHaveBeenCalledWith({ id: 'r2', title: REPORTS_STRINGS.untitled, created: false }),
    )
  })

  it('says why nothing was added, and can be tried again', async () => {
    fetchReports.mockResolvedValue({ reports: REPORTS })
    appendReportBlock.mockRejectedValueOnce(new ReportsApiError({ status: 503 }))
    const { onAdded, onClose } = setup()
    await listed()

    fireEvent.click(addButton())
    await waitFor(() => expect(status()).toHaveTextContent(`${E.lead.add}: ${E.serverFailed}.`))
    expect(status()).toHaveAttribute('data-tone', 'error')
    expect(addButton()).toBeEnabled()
    expect(addButton()).toHaveTextContent(S.add)
    expect(chosen()).toEqual(['Q3 review'])
    expect(onAdded).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    // Only a report that's gone lists them again.
    expect(fetchReports).toHaveBeenCalledTimes(1)

    appendReportBlock.mockResolvedValueOnce({ id: 'r1', version: 2, updatedAt: '', appended: true })
    fireEvent.click(addButton())
    expect(status()).toBeEmptyDOMElement()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onAdded).toHaveBeenCalledWith({ id: 'r1', title: 'Q3 review', created: false })
  })

  it('lists them again when the chosen report turns out to be gone, and chooses nothing in its place', async () => {
    fetchReports
      .mockResolvedValueOnce({ reports: REPORTS })
      .mockResolvedValueOnce({ reports: [REPORTS[0], REPORTS[2]] })
    appendReportBlock.mockRejectedValueOnce(new ReportsApiError({ status: 404, code: 'REPORT_NOT_FOUND' }))
    setup()
    await listed()

    fireEvent.click(report(REPORTS_STRINGS.untitled))
    fireEvent.click(addButton())
    await waitFor(() => expect(fetchReports).toHaveBeenCalledTimes(2))
    expect(fetchReports).toHaveBeenLastCalledWith({ authentication: AUTH, pageSize: REPORTS_PAGE_SIZE })
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(rows().map((row) => row.title)).toEqual(['Q3 review', 'Book of business'])
    expect(chosen()).toEqual([])
    expect(addButton()).toBeDisabled()
    expect(status()).toHaveTextContent(`${E.lead.add}: ${E.notFound}.`)

    // Choosing one clears what went wrong.
    fireEvent.click(report('Q3 review'))
    expect(status()).toBeEmptyDOMElement()
    expect(addButton()).toBeEnabled()
  })

  it('keeps the choice through a reload while it’s still listed', async () => {
    fetchReports
      .mockResolvedValueOnce({ reports: REPORTS })
      .mockResolvedValueOnce({ reports: [REPORTS[1], REPORTS[0]] })
    appendReportBlock.mockRejectedValueOnce(new ReportsApiError({ status: 404, code: 'REPORT_NOT_FOUND' }))
    setup()
    await listed()

    fireEvent.click(addButton())
    await waitFor(() => expect(fetchReports).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(rows()).toHaveLength(2))
    // Not the newest, as on the first list: the one that was chosen.
    expect(chosen()).toEqual(['Q3 review'])
    expect(addButton()).toBeEnabled()
  })

  it('chooses nothing when that reload fails, rather than a report it can’t show', async () => {
    fetchReports.mockResolvedValueOnce({ reports: REPORTS }).mockRejectedValueOnce(new ReportsApiError({ status: 502 }))
    appendReportBlock.mockRejectedValueOnce(new ReportsApiError({ status: 404, code: 'REPORT_NOT_FOUND' }))
    setup()
    await listed()

    fireEvent.click(addButton())
    await waitFor(() => expect(status()).toHaveTextContent(`${E.lead.load}: ${E.serverFailed}.`))
    expect(screen.queryAllByTestId('reports-add-to-report-report')).toHaveLength(0)
    expect(chosen()).toEqual([])
    expect(addButton()).toBeDisabled()
    // A new report can still be made.
    fireEvent.click(newReport())
    fireEvent.change(nameField(), { target: { value: 'Q4 review' } })
    expect(addButton()).toBeEnabled()
  })

  it('still makes a new report when the list can’t be loaded', async () => {
    fetchReports.mockRejectedValue(new ReportsApiError({ status: 0 }))
    createReport.mockImplementation(storedAs)
    const { onAdded, onClose } = setup()
    await listed()

    expect(status()).toHaveTextContent(`${E.lead.load}: ${E.unreachable}.`)
    expect(status()).toHaveAttribute('data-tone', 'error')
    expect(screen.queryAllByTestId('reports-add-to-report-report')).toHaveLength(0)
    expect(newReport()).toBeChecked()
    expect(nameField()).toHaveFocus()

    fireEvent.change(nameField(), { target: { value: 'Q4 review' } })
    fireEvent.click(addButton())
    expect(status()).toBeEmptyDOMElement()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onAdded).toHaveBeenCalledWith(added('Q4 review', true))
  })

  it('can’t be used without a data source: it says so and keeps Add off', async () => {
    const { rerender } = setup({ authentication: undefined })
    expect(status()).toHaveTextContent(S.noDataSource)
    expect(status()).toHaveAttribute('data-tone', 'error')
    expect(newReport()).toBeChecked()
    fireEvent.change(nameField(), { target: { value: 'Q4 review' } })
    expect(addButton()).toBeDisabled()
    fireEvent.keyDown(nameField(), { key: 'Enter' })
    fireEvent.click(addButton())
    expect(fetchReports).not.toHaveBeenCalled()
    expect(createReport).not.toHaveBeenCalled()

    // Nor without a token.
    rerender({ authentication: { apiKey: 'k', domain: 'https://example.test' } })
    expect(status()).toHaveTextContent(S.noDataSource)
    expect(addButton()).toBeDisabled()
    expect(fetchReports).not.toHaveBeenCalled()

    // Once there is one, its reports are listed.
    fetchReports.mockResolvedValue({ reports: REPORTS })
    rerender({ authentication: AUTH })
    await waitFor(() => expect(rows()).toHaveLength(3))
    expect(fetchReports).toHaveBeenCalledWith({ authentication: AUTH, pageSize: REPORTS_PAGE_SIZE })
    expect(chosen()).toEqual(['Q3 review'])
    expect(status()).toBeEmptyDOMElement()
    expect(addButton()).toBeEnabled()
  })

  it('closes on Escape while idle, but not while adding', async () => {
    fetchReports.mockResolvedValue({ reports: REPORTS })
    const appended = deferred()
    appendReportBlock.mockReturnValue(appended.promise)
    const { onClose } = setup()
    await listed()

    fireEvent.keyDown(dialog(), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(addButton())
    fireEvent.keyDown(dialog(), { key: 'Escape' })
    fireEvent.mouseDown(document.querySelector('.react-autoql-reports-modal-backdrop'))
    fireEvent.click(screen.getByTestId('reports-add-to-report-cancel'))
    expect(screen.getByTestId('reports-add-to-report-cancel')).toBeDisabled()
    expect(within(dialog()).getByRole('button', { name: REPORTS_STRINGS.close })).toBeDisabled()
    expect(onClose).toHaveBeenCalledTimes(1)

    await act(async () => appended.resolve({ id: 'r1', version: 2, updatedAt: '', appended: true }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
  })

  it('cancels from its Cancel button', async () => {
    fetchReports.mockResolvedValue({ reports: REPORTS })
    const { onAdded, onClose } = setup()
    await listed()
    fireEvent.click(screen.getByTestId('reports-add-to-report-cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAdded).not.toHaveBeenCalled()
    expect(appendReportBlock).not.toHaveBeenCalled()
  })

  it('adds on Enter in the name field, once there’s a name', async () => {
    fetchReports.mockResolvedValue({ reports: [] })
    createReport.mockImplementation(storedAs)
    const { onAdded, onClose } = setup()
    await listed()

    // An Enter it can't use is left alone (fireEvent is false when the key was taken).
    expect(fireEvent.keyDown(nameField(), { key: 'Enter' })).toBe(true)
    expect(createReport).not.toHaveBeenCalled()
    fireEvent.change(nameField(), { target: { value: 'Q4 review' } })
    // Enter that confirms a character being composed isn't for adding.
    expect(fireEvent.keyDown(nameField(), { key: 'Enter', isComposing: true })).toBe(true)
    expect(createReport).not.toHaveBeenCalled()

    expect(fireEvent.keyDown(nameField(), { key: 'Enter' })).toBe(false)
    expect(createReport).toHaveBeenCalledTimes(1)
    expect(createReport.mock.calls[0][0].report.title).toBe('Q4 review')
    // Once is enough: it's adding now.
    expect(fireEvent.keyDown(nameField(), { key: 'Enter' })).toBe(true)
    expect(createReport).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onAdded).toHaveBeenCalledWith(added('Q4 review', true))
  })

  it('ignores a list that comes back after a newer one was asked for, or after it closed', async () => {
    const older = deferred()
    const newer = deferred()
    fetchReports.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const { rerender, unmount } = setup()

    // Another token: the list is asked for again.
    rerender({ authentication: { ...AUTH, token: 't2' } })
    expect(fetchReports).toHaveBeenCalledTimes(2)
    expect(fetchReports).toHaveBeenLastCalledWith({
      authentication: { ...AUTH, token: 't2' },
      pageSize: REPORTS_PAGE_SIZE,
    })
    await act(async () => newer.resolve({ reports: [REPORTS[2]] }))
    await act(async () => older.resolve({ reports: REPORTS }))
    expect(rows()).toEqual([{ title: 'Book of business', edited: null, checked: true }])

    const late = deferred()
    fetchReports.mockReturnValueOnce(late.promise)
    rerender({ authentication: AUTH })
    unmount()
    const warn = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await act(async () => late.resolve({ reports: REPORTS }))
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})
