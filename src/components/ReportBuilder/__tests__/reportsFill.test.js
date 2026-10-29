import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Reports } from '../workspace/Reports'
import {
  createReportFromTemplate,
  fetchReport,
  fetchReportDataStatus,
  fetchReportFolders,
  fetchReports,
  fetchReportTags,
  ReportsApiError,
  saveReport,
} from '../run/reportsApi'
import { captureQuestion } from '../run/captureRun'

// A report started from a template (enableTemplates): made from it, then shown read-only while AutoQL fills in its data,
// read again as blocks fill, and said how it went. The waits are short here, so the fill can be followed in real time.

jest.mock('../workspace/reportsConstants', () => ({
  ...jest.requireActual('../workspace/reportsConstants'),
  FILL_POLL_MS: 5,
  FILL_POLL_MAX_MS: 20,
  FILL_STALL_MS: 150,
}))

// Questions asked from this page, filling in a report AutoQL doesn't fill itself: they answer when a test says.
jest.mock('../run/captureRun', () => ({ captureQuestion: jest.fn() }))

jest.mock('../run/reportsApi', () => {
  const actual = jest.requireActual('../run/reportsApi')
  return {
    ...actual,
    fetchReports: jest.fn(),
    fetchReport: jest.fn(),
    saveReport: jest.fn(),
    createReport: jest.fn(),
    createReportFromTemplate: jest.fn(),
    fetchReportDataStatus: jest.fn(),
    fetchReportFolders: jest.fn(),
    fetchReportTags: jest.fn(),
  }
})

// The builder is a stand-in that shows what it was given and hands back edits.
const mockBuilder = { props: null }
jest.mock('../ReportBuilder', () => ({
  ReportBuilder: (props) => {
    mockBuilder.props = props
    return (
      <div data-test='builder' data-readonly={props.readOnly || undefined}>
        <span data-test='builder-title'>{props.report?.title}</span>
        {props.toolbarStatus}
      </div>
    )
  },
}))

const mockDialogs = { newReport: null }
jest.mock('../workspace/NewReportDialog', () => ({
  NewReportDialog: (props) => {
    mockDialogs.newReport = props
    return <div data-test='new-report-dialog' />
  },
}))
const b64url = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const AUTH = { apiKey: 'key', domain: 'https://example.test', token: `h.${b64url({ project_id: 'p1' })}.s` }

const T = 'cccccccc-0000-4000-8000-000000000003'
const A = 'aaaaaaaa-0000-4000-8000-000000000001'

const answered = {
  version: 1,
  capturedAt: '2026-10-28T18:00:00Z',
  displayType: 'table',
  data: { columns: [{ name: 'aum' }], rows: [[1]], count_rows: 1 },
  config: {},
}
const dataBlock = (id, capture) => ({
  id,
  type: 'data',
  rows: 25,
  source: { type: 'query', query: `question ${id}` },
  askedHere: true,
  ...(capture ? { capture } : {}),
})
const documentOf = (blocks) => ({ schemaVersion: 1, title: 'Quarterly review', page: {}, blocks })
const stored = ({ id = T, version = 1, dataStatus = 'NONE', dataErrors = [], blocks = [] } = {}) => ({
  id,
  title: 'Quarterly review',
  sizeBytes: 100,
  version,
  folderId: null,
  tagIds: [],
  templateId: 'tp1',
  dataStatus,
  createdAt: '2026-10-28T18:00:00Z',
  updatedAt: '2026-10-28T18:00:00Z',
  projectId: 'p1',
  dataErrors,
  report: documentOf(blocks),
})

const homeProps = { current: null }
const renderHome = (home) => {
  homeProps.current = home
  return <div data-test='home' />
}

const setup = (props = {}) =>
  render(
    <Reports
      authentication={AUTH}
      renderHome={renderHome}
      storageKeyPrefix='test.'
      saveDelay={0}
      enableTemplates
      {...props}
    />,
  )

const fillNotice = () => screen.queryByTestId('reports-fill-notice')

// New report › Start from a template, as the dialog does it.
const startFromTemplate = async () => {
  await waitFor(() => expect(homeProps.current?.reports).not.toBeNull())
  fireEvent.click(within(screen.getByTestId('reports-tabs')).getByRole('button', { name: 'New report' }))
  expect(mockDialogs.newReport.enableTemplates).toBe(true)
  await act(() => mockDialogs.newReport.onStartFromTemplate({ templateId: 'tp1', id: T }))
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  mockBuilder.props = null
  mockDialogs.newReport = null
  homeProps.current = null
  fetchReports.mockResolvedValue({ reports: [] })
  fetchReportFolders.mockResolvedValue([{ id: 'f1', name: 'Clients', reportCount: 0 }])
  fetchReportTags.mockResolvedValue([])
  saveReport.mockImplementation(async ({ id, version }) => ({ id, version: version + 1, updatedAt: 'now' }))
  captureQuestion.mockReturnValue(new Promise(() => {}))
})

describe('starting a report from a template', () => {
  it('makes it in the folder the home page shows, asking in the browser’s time zone, and opens it as it came back', async () => {
    // No questions in it, so there's nothing to fill in.
    createReportFromTemplate.mockResolvedValue({ ...stored(), created: true })
    setup({ newReportFolderId: 'f1' })
    await waitFor(() => expect(homeProps.current?.folders).toHaveLength(1))

    await startFromTemplate()

    expect(createReportFromTemplate).toHaveBeenCalledWith({
      authentication: AUTH,
      id: T,
      templateId: 'tp1',
      folderId: 'f1',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    expect(screen.getByTestId('builder-title')).toHaveTextContent('Quarterly review')
    expect(mockBuilder.props.readOnly).toBe(false)
    expect(mockBuilder.props.dataFill).toBeNull()
    expect(fetchReport).not.toHaveBeenCalled()
    expect(fetchReportDataStatus).not.toHaveBeenCalled()
    expect(homeProps.current.reports[0]).toMatchObject({ id: T, templateId: 'tp1', dataStatus: 'NONE' })
    expect(within(screen.getByTestId('reports-tabs')).getByRole('button', { name: 'Quarterly review' })).toBeTruthy()
  })

  it('hands the dialog why a template couldn’t be started, and opens nothing', async () => {
    createReportFromTemplate.mockRejectedValue(new ReportsApiError({ status: 404, code: 'REPORT_TEMPLATE_NOT_FOUND' }))
    setup()
    await waitFor(() => expect(homeProps.current?.reports).not.toBeNull())
    fireEvent.click(within(screen.getByTestId('reports-tabs')).getByRole('button', { name: 'New report' }))

    await expect(
      act(() => mockDialogs.newReport.onStartFromTemplate({ templateId: 'tp1', id: T })),
    ).rejects.toMatchObject({ code: 'REPORT_TEMPLATE_NOT_FOUND' })
    expect(screen.queryByTestId('builder')).toBeNull()
    expect(screen.getByTestId('new-report-dialog')).toBeTruthy()
  })
})

describe('a report whose data AutoQL fills in', () => {
  it('is read-only while it fills, read again as blocks fill, then says how it went and saves from there', async () => {
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'PENDING', blocks: [dataBlock('d1'), dataBlock('d2')] }),
      created: true,
    })
    fetchReportDataStatus
      .mockResolvedValueOnce({ dataStatus: 'RUNNING', version: 1, dataErrors: [] })
      .mockResolvedValueOnce({ dataStatus: 'RUNNING', version: 2, dataErrors: [] })
      .mockResolvedValue({
        dataStatus: 'PARTIAL',
        version: 3,
        dataErrors: [{ blockId: 'd2', reason: 'not_confident' }],
      })
    fetchReport
      .mockResolvedValueOnce(
        stored({ version: 2, dataStatus: 'RUNNING', blocks: [dataBlock('d1', answered), dataBlock('d2')] }),
      )
      .mockResolvedValue(
        stored({
          version: 3,
          dataStatus: 'PARTIAL',
          dataErrors: [{ blockId: 'd2', reason: 'not_confident' }],
          blocks: [dataBlock('d1', answered), dataBlock('d2')],
        }),
      )
    setup()
    await startFromTemplate()

    expect(mockBuilder.props.readOnly).toBe(true)
    expect(mockBuilder.props.dataFill).toEqual({ state: 'filling' })
    expect(mockBuilder.props.toolbarStatus).toBeUndefined()
    expect(fillNotice()).toHaveTextContent(
      'Filling in your data: 0 of 2 blocks so far. You can edit the report once it’s done.',
    )
    // Nothing changes it meanwhile.
    act(() => mockBuilder.props.onChange(documentOf([])))
    expect(saveReport).not.toHaveBeenCalled()

    await waitFor(() => expect(fillNotice()).toHaveTextContent('Filling in your data: 1 of 2 blocks so far.'))
    await waitFor(() => expect(mockBuilder.props.readOnly).toBe(false))
    expect(fetchReport).toHaveBeenCalledTimes(2)
    expect(mockBuilder.props.dataFill).toEqual({ state: 'filled', errors: { d2: { reason: 'not_confident' } } })
    expect(fillNotice()).toHaveTextContent(
      '1 of 2 blocks were filled in. Select the others to see why, and Rerun them.',
    )

    // Its next save is from the version the fill left.
    act(() => mockBuilder.props.onChange({ ...mockBuilder.props.report, title: 'Q3 review' }))
    await waitFor(() => expect(saveReport).toHaveBeenCalledWith(expect.objectContaining({ id: T, version: 3 })))

    // The home page's list has how it went, too.
    fireEvent.click(within(screen.getByTestId('reports-tabs')).getByRole('button', { name: 'All reports' }))
    expect(homeProps.current.reports[0].dataStatus).toBe('PARTIAL')
  })

  it('says when every block was filled in', async () => {
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'PENDING', blocks: [dataBlock('d1'), dataBlock('d2')] }),
      created: true,
    })
    fetchReportDataStatus.mockResolvedValue({ dataStatus: 'DONE', version: 3, dataErrors: [] })
    fetchReport.mockResolvedValue(
      stored({ version: 3, dataStatus: 'DONE', blocks: [dataBlock('d1', answered), dataBlock('d2', answered)] }),
    )
    setup()
    await startFromTemplate()

    await waitFor(() => expect(fillNotice()).toHaveTextContent('Your data is in: all 2 blocks were filled in.'))
    expect(mockBuilder.props.readOnly).toBe(false)
    expect(mockBuilder.props.dataFill).toBeNull()
  })

  it('says the data is in once the blocks it couldn’t fill were rerun', async () => {
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'PENDING', blocks: [dataBlock('d1'), dataBlock('d2')] }),
      created: true,
    })
    fetchReportDataStatus.mockResolvedValue({
      dataStatus: 'PARTIAL',
      version: 2,
      dataErrors: [{ blockId: 'd2', reason: 'timeout' }],
    })
    fetchReport.mockResolvedValue(
      stored({
        version: 2,
        dataStatus: 'PARTIAL',
        dataErrors: [{ blockId: 'd2', reason: 'timeout' }],
        blocks: [dataBlock('d1', answered), dataBlock('d2')],
      }),
    )
    setup()
    await startFromTemplate()
    await waitFor(() => expect(fillNotice()).toHaveTextContent('1 of 2 blocks were filled in.'))

    // Rerun answered the other one.
    act(() =>
      mockBuilder.props.onChange({
        ...mockBuilder.props.report,
        blocks: [dataBlock('d1', answered), dataBlock('d2', answered)],
      }),
    )
    expect(fillNotice()).toHaveTextContent('Your data is in: all 2 blocks were filled in.')
  })

  it('says when no block could be filled in, whatever the status says', async () => {
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'PENDING', blocks: [dataBlock('d1')] }),
      created: true,
    })
    fetchReportDataStatus.mockResolvedValue({
      dataStatus: 'PARTIAL',
      version: 1,
      dataErrors: [{ blockId: 'd1', reason: 'no_data' }],
    })
    fetchReport.mockResolvedValue(
      stored({ dataStatus: 'PARTIAL', dataErrors: [{ blockId: 'd1', reason: 'no_data' }], blocks: [dataBlock('d1')] }),
    )
    setup()
    await startFromTemplate()
    await waitFor(() =>
      expect(fillNotice()).toHaveTextContent('The block couldn’t be filled in. Select it to see why, and Rerun it.'),
    )
  })

  it('takes a fill with no news for long enough to have stopped, and lets the report be changed', async () => {
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'RUNNING', blocks: [dataBlock('d1')] }),
      created: true,
    })
    fetchReportDataStatus.mockResolvedValue({ dataStatus: 'RUNNING', version: 1, dataErrors: [] })
    setup()
    await startFromTemplate()
    expect(mockBuilder.props.readOnly).toBe(true)

    await waitFor(() => expect(mockBuilder.props.readOnly).toBe(false))
    expect(fillNotice()).toHaveTextContent('Filling in your data stopped before it finished.')
    expect(fetchReport).not.toHaveBeenCalled()
  })

  it('keeps asking, more slowly, when asking fails', async () => {
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'PENDING', blocks: [dataBlock('d1')] }),
      created: true,
    })
    fetchReportDataStatus
      .mockRejectedValueOnce(new ReportsApiError({ status: 0 }))
      .mockResolvedValue({ dataStatus: 'DONE', version: 2, dataErrors: [] })
    fetchReport.mockResolvedValue(stored({ version: 2, dataStatus: 'DONE', blocks: [dataBlock('d1', answered)] }))
    setup()
    await startFromTemplate()

    await waitFor(() => expect(fillNotice()).toHaveTextContent('Your data is in.'))
    expect(fetchReportDataStatus).toHaveBeenCalledTimes(2)
  })

  it('follows the fill of a report opened while it’s filling, and says nothing of a fill that ended before', async () => {
    fetchReports.mockResolvedValue({ reports: [{ ...stored({ id: A }), report: undefined }] })
    fetchReport.mockResolvedValueOnce(stored({ id: A, dataStatus: 'RUNNING', blocks: [dataBlock('d1')] }))
    fetchReport.mockResolvedValue(
      stored({ id: A, version: 2, dataStatus: 'DONE', blocks: [dataBlock('d1', answered)] }),
    )
    fetchReportDataStatus.mockResolvedValue({ dataStatus: 'DONE', version: 2, dataErrors: [] })
    setup({ shownReportId: A })

    await waitFor(() => expect(mockBuilder.props?.readOnly).toBe(true))
    await waitFor(() => expect(fillNotice()).toHaveTextContent('Your data is in.'))
    expect(mockBuilder.props.readOnly).toBe(false)
  })

  it('shows why blocks weren’t filled in when a report is opened after its fill, without a word over it', async () => {
    fetchReports.mockResolvedValue({ reports: [{ ...stored({ id: A }), report: undefined }] })
    fetchReport.mockResolvedValue(
      stored({
        id: A,
        dataStatus: 'FAILED',
        dataErrors: [{ blockId: 'd1', reason: 'query_failed', message: 'Column not found' }],
        blocks: [dataBlock('d1')],
      }),
    )
    setup({ shownReportId: A })

    await waitFor(() => expect(mockBuilder.props?.report).toBeTruthy())
    expect(mockBuilder.props.readOnly).toBe(false)
    expect(mockBuilder.props.dataFill).toEqual({
      state: 'filled',
      errors: { d1: { reason: 'query_failed', message: 'Column not found' } },
    })
    expect(fillNotice()).toBeNull()
    expect(fetchReportDataStatus).not.toHaveBeenCalled()
  })
})

describe('a report made from a template that AutoQL doesn’t fill in (NONE)', () => {
  // Answers that come when told to.
  const answers = () => {
    const waiting = []
    captureQuestion.mockImplementation(
      (request) => new Promise((resolve) => waiting.push({ query: request.query, request, resolve })),
    )
    return waiting
  }
  const answeredAt = (capturedAt) => ({ ok: true, capture: { ...answered, capturedAt } })

  it('asks its questions from here, read-only until every one has answered, all as of when it was started', async () => {
    const waiting = answers()
    createReportFromTemplate.mockResolvedValue({
      ...stored({ blocks: [dataBlock('d1'), dataBlock('d2')] }),
      created: true,
    })
    setup()
    const before = Date.now()
    await startFromTemplate()

    expect(mockBuilder.props.readOnly).toBe(true)
    expect(mockBuilder.props.dataFill).toEqual({ state: 'filling' })
    expect(fillNotice()).toHaveTextContent('Filling in your data: 0 of 2 blocks so far.')
    expect(waiting.map((w) => w.query)).toEqual(['question d1', 'question d2'])
    const [first, second] = waiting.map((w) => w.request)
    expect(first).toMatchObject({ authentication: AUTH, rerun: { kept: undefined } })
    expect(first.capturedAt).toBe(second.capturedAt)
    expect(Date.parse(first.capturedAt)).toBeGreaterThanOrEqual(before - 1000)
    // Nothing changes it meanwhile but the answers.
    act(() => mockBuilder.props.onChange({ ...mockBuilder.props.report, title: 'Changed' }))

    await act(async () => waiting[0].resolve(answeredAt(first.capturedAt)))
    expect(fillNotice()).toHaveTextContent('Filling in your data: 1 of 2 blocks so far.')
    await act(async () => waiting[1].resolve(answeredAt(first.capturedAt)))

    expect(fillNotice()).toHaveTextContent('Your data is in: all 2 blocks were filled in.')
    expect(mockBuilder.props.readOnly).toBe(false)
    expect(mockBuilder.props.dataFill).toBeNull()
    await waitFor(() => expect(saveReport).toHaveBeenCalled())
    const saved = saveReport.mock.calls[saveReport.mock.calls.length - 1][0].report
    expect(saved.title).toBe('Quarterly review')
    expect(saved.blocks.map((block) => block.capture?.capturedAt)).toEqual([first.capturedAt, first.capturedAt])
  })

  it('says why a question didn’t fill its block, as AutoQL says it', async () => {
    const waiting = answers()
    createReportFromTemplate.mockResolvedValue({
      ...stored({ blocks: [dataBlock('d1'), dataBlock('d2'), dataBlock('d3')] }),
      created: true,
    })
    setup()
    await startFromTemplate()
    await act(async () => {
      waiting[0].resolve(answeredAt('2026-10-29T10:00:00.000Z'))
      waiting[1].resolve({ ok: false, reason: 'error', error: { message: 'Not sure', referenceId: '1.1.430' } })
      waiting[2].resolve({ ok: false, reason: 'error', error: { message: 'Column gone', referenceId: '1.1.500' } })
    })

    expect(mockBuilder.props.readOnly).toBe(false)
    expect(mockBuilder.props.dataFill).toEqual({
      state: 'filled',
      errors: {
        d2: { reason: 'not_confident', message: undefined },
        d3: { reason: 'query_failed', message: 'Column gone' },
      },
    })
    expect(fillNotice()).toHaveTextContent('1 of 3 blocks were filled in.')
  })

  it('leaves the filling to AutoQL where it fills reports in itself', async () => {
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'PENDING', blocks: [dataBlock('d1')] }),
      created: true,
    })
    fetchReportDataStatus.mockReturnValue(new Promise(() => {}))
    setup()
    await startFromTemplate()
    expect(mockBuilder.props.readOnly).toBe(true)
    expect(captureQuestion).not.toHaveBeenCalled()
  })
})
