import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Reports } from '../workspace/Reports'
import {
  createReportFolder,
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
    createReportFolder: jest.fn(),
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

const mockDialogs = { newReport: null, saveAsTemplate: null, manage: null }
jest.mock('../workspace/NewReportDialog', () => ({
  NewReportDialog: (props) => {
    mockDialogs.newReport = props
    return <div data-test='new-report-dialog' />
  },
}))
jest.mock('../workspace/SaveAsTemplateDialog', () => ({
  SaveAsTemplateDialog: (props) => {
    mockDialogs.saveAsTemplate = props
    return <div data-test='save-as-template-dialog' />
  },
}))
jest.mock('../workspace/ManageTemplatesDialog', () => ({
  ManageTemplatesDialog: (props) => {
    mockDialogs.manage = props
    return <div data-test='manage-templates-dialog' />
  },
}))

// The template editor is a stand-in too, which shows what it was given.
const mockEditor = { props: null, saveNow: jest.fn(), unsaved: false }
jest.mock('../workspace/TemplateEditor', () => {
  const React = require('react')
  class TemplateEditor extends React.Component {
    saveNow = () => mockEditor.saveNow()
    hasUnsaved = () => mockEditor.unsaved
    render() {
      mockEditor.props = this.props
      return <div data-test='template-editor' />
    }
  }
  return { TemplateEditor }
})

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

// A fill's heartbeat (data_heartbeat_at), the nth time it moved on.
const heartbeat = (n) => new Date(Date.UTC(2026, 10, 9, 18) + n * 1000).toISOString()

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
  mockEditor.props = null
  mockEditor.unsaved = false
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

describe('a report started from a template for a filter lock (RW-351)', () => {
  const BROWN = { key: 'household', value: 'Brown Family', filter_type: 'include', format_txt: 'Brown Family' }
  const startFor = async (locks) => {
    await waitFor(() => expect(homeProps.current?.reports).not.toBeNull())
    fireEvent.click(within(screen.getByTestId('reports-tabs')).getByRole('button', { name: 'New report' }))
    await act(() => mockDialogs.newReport.onStartFromTemplate({ templateId: 'tp1', id: T, sessionFilterLocks: locks }))
  }
  const filledLater = (report) => {
    fetchReportDataStatus.mockResolvedValue({ dataStatus: 'DONE', version: 3, dataErrors: [] })
    fetchReport.mockResolvedValue({ ...stored({ version: 3, dataStatus: 'DONE' }), report })
  }

  it('asks AutoQL to make it for the lock, and leaves a report it made that way as it is', async () => {
    const report = { ...documentOf([dataBlock('d1', answered)]), sessionFilterLocks: [BROWN] }
    createReportFromTemplate.mockResolvedValue({ ...stored({ dataStatus: 'PENDING' }), report, created: true })
    filledLater(report)
    setup({ enableFilterLocks: true })
    expect(mockDialogs.newReport).toBeNull()
    await startFor([{ ...BROWN, isSession: true }])

    expect(createReportFromTemplate).toHaveBeenCalledWith(expect.objectContaining({ sessionFilterLocks: [BROWN] }))
    await waitFor(() => expect(mockBuilder.props.readOnly).toBe(false))
    expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([BROWN])
    expect(saveReport).not.toHaveBeenCalled()
  })

  it('puts the lock on a report AutoQL made without it, once its fill is over, and saves it', async () => {
    const report = documentOf([dataBlock('d1', answered)])
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'PENDING', blocks: [dataBlock('d1')] }),
      created: true,
    })
    filledLater(report)
    setup({ enableFilterLocks: true })
    await startFor([BROWN])

    // Not while it's filled in: what the fill leaves would take its place.
    expect(mockBuilder.props.readOnly).toBe(true)
    expect(mockBuilder.props.report.sessionFilterLocks).toBeUndefined()

    await waitFor(() => expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([BROWN]))
    expect(mockBuilder.props.readOnly).toBe(false)
    // The builder hears when, to offer Rerun all for the answers the fill left.
    expect(typeof mockBuilder.props.lockChangedAt).toBe('number')
    await waitFor(() =>
      expect(saveReport).toHaveBeenCalledWith(
        expect.objectContaining({
          id: T,
          version: 3,
          report: expect.objectContaining({ sessionFilterLocks: [BROWN] }),
        }),
      ),
    )
  })

  it('asks every question with the lock from the start when it’s filled in here', async () => {
    createReportFromTemplate.mockResolvedValue({ ...stored({ blocks: [dataBlock('d1')] }), created: true })
    setup({ enableFilterLocks: true })
    await startFor([BROWN])

    expect(captureQuestion).toHaveBeenCalledWith(expect.objectContaining({ query: 'question d1', filters: [BROWN] }))
    expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([BROWN])
    // Asked with it from the start: nothing to rerun.
    expect(mockBuilder.props.lockChangedAt).toBeUndefined()
  })

  // A template that kept a lock, which AutoQL's copy of it then comes with: what's picked is what the report is for.
  const copyLockedTo = (lock, { dataStatus } = {}) => ({
    ...stored({ dataStatus, blocks: [dataBlock('d1')] }),
    report: { ...documentOf([dataBlock('d1')]), sessionFilterLocks: [lock] },
    created: true,
  })

  it('makes it for everything when no lock is picked, even if AutoQL’s copy came with one', async () => {
    createReportFromTemplate.mockResolvedValue(copyLockedTo(BROWN))
    setup({ enableFilterLocks: true })
    await startFor(undefined)

    expect(createReportFromTemplate).toHaveBeenCalledWith(
      expect.not.objectContaining({ sessionFilterLocks: expect.anything() }),
    )
    expect(captureQuestion.mock.calls.map(([options]) => options.filters)).toStrictEqual([undefined])
    expect(mockBuilder.props.report.sessionFilterLocks).toBeUndefined()
    expect(mockBuilder.props.lockChangedAt).toBeUndefined()
  })

  it('sends none picked over a template’s own lock as it is, and makes it for everything', async () => {
    createReportFromTemplate.mockResolvedValue(copyLockedTo(BROWN))
    setup({ enableFilterLocks: true })
    await startFor([])

    expect(createReportFromTemplate).toHaveBeenCalledWith(expect.objectContaining({ sessionFilterLocks: [] }))
    expect(captureQuestion.mock.calls.map(([options]) => options.filters)).toStrictEqual([undefined])
    expect(mockBuilder.props.report.sessionFilterLocks).toBeUndefined()
  })

  it('takes a lock AutoQL’s copy came with off when none is picked, once its fill is over', async () => {
    createReportFromTemplate.mockResolvedValue(copyLockedTo(BROWN, { dataStatus: 'PENDING' }))
    filledLater({ ...documentOf([dataBlock('d1', answered)]), sessionFilterLocks: [BROWN] })
    setup({ enableFilterLocks: true })
    await startFor(undefined)

    expect(mockBuilder.props.readOnly).toBe(true)
    expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([BROWN])

    await waitFor(() => expect(mockBuilder.props.report.sessionFilterLocks).toBeUndefined())
    expect(mockBuilder.props.readOnly).toBe(false)
    // The answers the fill left may be for the copy's lock: the builder offers Rerun all.
    expect(typeof mockBuilder.props.lockChangedAt).toBe('number')
    await waitFor(() =>
      expect(saveReport).toHaveBeenCalledWith(
        expect.objectContaining({
          id: T,
          version: 3,
          report: expect.not.objectContaining({ sessionFilterLocks: expect.anything() }),
        }),
      ),
    )
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

  it('counts a heartbeat that moves on as news, so a slow fill isn’t taken to have stopped (RW-366)', async () => {
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'RUNNING', blocks: [dataBlock('d1')] }),
      created: true,
    })
    // No block filled for twice as long as a fill can go without news, but its questions asked all along.
    const started = Date.now()
    let beats = 0
    fetchReportDataStatus.mockImplementation(async () =>
      Date.now() - started < 300
        ? { dataStatus: 'RUNNING', version: 1, dataHeartbeatAt: heartbeat(++beats), dataErrors: [] }
        : { dataStatus: 'DONE', version: 2, dataHeartbeatAt: null, dataErrors: [] },
    )
    fetchReport.mockResolvedValue(stored({ version: 2, dataStatus: 'DONE', blocks: [dataBlock('d1', answered)] }))
    setup()
    await startFromTemplate()

    await act(() => new Promise((resolve) => setTimeout(resolve, 250)))
    expect(mockBuilder.props.readOnly).toBe(true)
    await waitFor(() => expect(fillNotice()).toHaveTextContent('Your data is in.'))
  })

  it('takes a fill whose heartbeat stopped moving to have stopped, as one with no news', async () => {
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'RUNNING', blocks: [dataBlock('d1')] }),
      created: true,
    })
    fetchReportDataStatus.mockResolvedValue({
      dataStatus: 'RUNNING',
      version: 1,
      dataHeartbeatAt: heartbeat(1),
      dataErrors: [],
    })
    setup()
    await startFromTemplate()

    await waitFor(() => expect(mockBuilder.props.readOnly).toBe(false))
    expect(fillNotice()).toHaveTextContent('Filling in your data stopped before it finished.')
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

describe('templates, for those who manage them (canManageTemplates)', () => {
  it('saves the report shown as a template, from what it saved first', async () => {
    createReportFromTemplate.mockResolvedValue({ ...stored(), created: true })
    setup({ canManageTemplates: true })
    await startFromTemplate()

    act(() => mockBuilder.props.onChange({ ...mockBuilder.props.report, title: 'Q3 review' }))
    act(() => mockBuilder.props.onSaveAsTemplate())
    expect(screen.getByTestId('save-as-template-dialog')).toBeTruthy()
    expect(mockDialogs.saveAsTemplate).toMatchObject({ authentication: AUTH, reportId: T })
    expect(mockDialogs.saveAsTemplate.report.title).toBe('Q3 review')
    await expect(mockDialogs.saveAsTemplate.flush()).resolves.toBe(true)
    expect(saveReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: T, report: expect.objectContaining({ title: 'Q3 review' }) }),
    )

    // Made: Manage templates is where it's published.
    act(() => mockDialogs.saveAsTemplate.onManage())
    expect(screen.queryByTestId('save-as-template-dialog')).toBeNull()
    expect(screen.getByTestId('manage-templates-dialog')).toBeTruthy()
    act(() => mockDialogs.manage.onClose())
    expect(screen.queryByTestId('manage-templates-dialog')).toBeNull()
  })

  it('offers neither while a report fills, nor to those who don’t manage templates', async () => {
    createReportFromTemplate.mockResolvedValue({
      ...stored({ dataStatus: 'RUNNING', blocks: [dataBlock('d1')] }),
      created: true,
    })
    fetchReportDataStatus.mockReturnValue(new Promise(() => {}))
    const { unmount } = setup({ canManageTemplates: true })
    await startFromTemplate()
    expect(mockBuilder.props.onSaveAsTemplate).toBeUndefined()
    unmount()

    createReportFromTemplate.mockResolvedValue({ ...stored({ blocks: [dataBlock('d1')] }), created: true })
    setup()
    await startFromTemplate()
    expect(mockBuilder.props.onSaveAsTemplate).toBeUndefined()
    expect(mockDialogs.newReport.onManageTemplates).toBeUndefined()
  })

  it('opens Manage templates from the home page and from the templates', async () => {
    setup({ canManageTemplates: true })
    await waitFor(() => expect(homeProps.current?.reports).not.toBeNull())
    act(() => homeProps.current.manageTemplates())
    expect(screen.getByTestId('manage-templates-dialog')).toBeTruthy()
    act(() => mockDialogs.manage.onClose())

    fireEvent.click(within(screen.getByTestId('reports-tabs')).getByRole('button', { name: 'New report' }))
    act(() => mockDialogs.newReport.onManageTemplates())
    expect(screen.queryByTestId('new-report-dialog')).toBeNull()
    expect(screen.getByTestId('manage-templates-dialog')).toBeTruthy()
  })

  it('edits a template from Manage templates in place of the tabs, and goes back to Manage templates after', async () => {
    createReportFromTemplate.mockResolvedValue({ ...stored(), created: true })
    setup({ canManageTemplates: true, autoQLConfig: { enableDrilldowns: true } })
    await startFromTemplate()
    act(() => mockBuilder.props.onChange({ ...mockBuilder.props.report, title: 'Q3 review' }))
    act(() => homeProps.current.manageTemplates())
    expect(mockDialogs.manage.onEdit).toEqual(expect.any(Function))

    act(() => mockDialogs.manage.onEdit({ id: 'tp9', title: 'Monthly review', status: 'DRAFT' }))
    expect(screen.queryByTestId('manage-templates-dialog')).toBeNull()
    expect(screen.queryByTestId('reports-tabs')).toBeNull()
    expect(screen.queryByTestId('builder')).toBeNull()
    expect(screen.getByTestId('template-editor')).toBeTruthy()
    expect(mockEditor.props).toMatchObject({
      authentication: AUTH,
      templateId: 'tp9',
      title: 'Monthly review',
      builderProps: { authentication: AUTH, autoQLConfig: { enableDrilldowns: true } },
    })
    // What was waiting in the report shown was saved first.
    await waitFor(() =>
      expect(saveReport).toHaveBeenCalledWith(
        expect.objectContaining({ id: T, report: expect.objectContaining({ title: 'Q3 review' }) }),
      ),
    )

    // ⌘S saves the template, not the report.
    saveReport.mockClear()
    const press = fireEvent.keyDown(window, { key: 's', metaKey: true })
    expect(press).toBe(false)
    expect(mockEditor.saveNow).toHaveBeenCalledTimes(1)
    expect(saveReport).not.toHaveBeenCalled()

    // Its changes that aren't saved count, for the host and the browser.
    mockEditor.unsaved = true
    expect(screen.getByTestId('template-editor')).toBeTruthy()
    const leaving = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(leaving)
    expect(leaving.defaultPrevented).toBe(true)

    act(() => mockEditor.props.onClose())
    expect(screen.queryByTestId('template-editor')).toBeNull()
    expect(screen.getByTestId('manage-templates-dialog')).toBeTruthy()
    expect(screen.getByTestId('reports-tabs')).toBeTruthy()
    expect(screen.getByTestId('builder-title')).toHaveTextContent('Q3 review')
  })
})

describe('a report for each household from a template (RW-353)', () => {
  const lock = (value) => ({ key: 'household', value, filter_type: 'include', format_txt: value })
  const BROWN = lock('Brown Family')
  const NGUYEN = lock('Nguyen Family')
  const R1 = 'aaaaaaaa-0000-4000-8000-0000000000b1'
  const R2 = 'aaaaaaaa-0000-4000-8000-0000000000b2'
  const STARTS = [
    { id: R1, lock: BROWN },
    { id: R2, lock: NGUYEN },
  ]
  const FOLDER = /^Monthly review — [A-Z][a-z]{2} \d{1,2}, \d{4}$/
  // A report AutoQL made from the template for the lock asked for, in the folder asked for.
  const made = ({ id, sessionFilterLocks, folderId }, rest = {}) => {
    const report = stored({ id, blocks: [dataBlock('d1'), dataBlock('d2')], ...rest })
    return { ...report, folderId, report: { ...report.report, sessionFilterLocks }, created: true }
  }
  const startEach = async (starts = STARTS) => {
    await waitFor(() => expect(homeProps.current?.reports).not.toBeNull())
    fireEvent.click(within(screen.getByTestId('reports-tabs')).getByRole('button', { name: 'New report' }))
    await act(() =>
      mockDialogs.newReport.onStartEachFromTemplate({ templateId: 'tp1', title: 'Monthly review', starts }),
    )
  }
  const listed = (id) => homeProps.current.reports.find((report) => report.id === id)
  const lastSaveOf = (id) =>
    saveReport.mock.calls
      .map(([call]) => call)
      .filter((call) => call.id === id)
      .pop()

  beforeEach(() => {
    createReportFolder.mockImplementation(async ({ id, name }) => ({ id, name, reportCount: 0, created: true }))
    captureQuestion.mockImplementation(async ({ filters }) => ({
      ok: true,
      capture: { ...answered, config: { household: filters?.[0]?.value } },
    }))
  })

  it('makes one for each in a folder of their own, fills in those AutoQL leaves to the page, and names each', async () => {
    createReportFromTemplate.mockImplementation(async (start) => made(start))
    setup({ enableFilterLocks: true })
    await startEach()

    expect(screen.queryByTestId('new-report-dialog')).toBeNull()
    expect(createReportFolder).toHaveBeenCalledWith(expect.objectContaining({ name: expect.stringMatching(FOLDER) }))
    const folderId = createReportFolder.mock.calls[0][0].id
    await waitFor(() => expect(homeProps.current.notices[0].text).toMatch(/^Both reports are in “Monthly review — /))
    expect(homeProps.current.notices).toHaveLength(1)

    expect(createReportFromTemplate).toHaveBeenCalledWith({
      authentication: AUTH,
      id: R1,
      templateId: 'tp1',
      folderId,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      sessionFilterLocks: [BROWN],
    })
    expect(createReportFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: R2, sessionFilterLocks: [NGUYEN] }),
    )
    // Each question asked one at a time, with the household its report is for.
    expect(captureQuestion).toHaveBeenCalledTimes(4)
    expect(captureQuestion).toHaveBeenCalledWith(expect.objectContaining({ query: 'question d1', filters: [BROWN] }))
    expect(captureQuestion).toHaveBeenCalledWith(expect.objectContaining({ query: 'question d2', filters: [NGUYEN] }))

    const brown = lastSaveOf(R1).report
    expect(brown.title).toBe('Quarterly review — Brown Family')
    expect(brown.blocks.map((block) => block.capture?.config.household)).toEqual(['Brown Family', 'Brown Family'])
    expect(lastSaveOf(R2).report.title).toBe('Quarterly review — Nguyen Family')
    expect(listed(R1)).toMatchObject({ title: 'Quarterly review — Brown Family', folderId, dataStatus: 'DONE' })
    expect(listed(R2)).toMatchObject({ title: 'Quarterly review — Nguyen Family', folderId, dataStatus: 'DONE' })
    // The home page stays as it was: no tab opened for any of them.
    expect(screen.queryByTestId('builder')).toBeNull()
  })

  it('follows the fills AutoQL runs, and names each report once it’s filled', async () => {
    createReportFromTemplate.mockImplementation(async (start) => made(start, { dataStatus: 'PENDING' }))
    const polls = {}
    fetchReportDataStatus.mockImplementation(async ({ id }) => {
      polls[id] = (polls[id] || 0) + 1
      return polls[id] < 2
        ? { dataStatus: 'RUNNING', version: 2, dataUpdatedAt: null, dataErrors: [] }
        : { dataStatus: 'DONE', version: 3, dataUpdatedAt: 'now', dataErrors: [] }
    })
    fetchReport.mockImplementation(async ({ id }) => {
      const start = STARTS.find((s) => s.id === id)
      return made(
        { id, sessionFilterLocks: [start.lock] },
        { version: 3, dataStatus: 'DONE', blocks: [dataBlock('d1', answered)] },
      )
    })
    setup({ enableFilterLocks: true })
    await startEach()

    await waitFor(() => expect(homeProps.current.notices[0].text).toMatch(/^Both reports are in/))
    expect(captureQuestion).not.toHaveBeenCalled()
    expect(lastSaveOf(R1)).toMatchObject({ version: 3, report: { title: 'Quarterly review — Brown Family' } })
    expect(lastSaveOf(R1).report.blocks[0].capture).toEqual(answered)
    expect(listed(R2)).toMatchObject({ title: 'Quarterly review — Nguyen Family', dataStatus: 'DONE' })
  })

  it('keeps following a fill whose heartbeat moves on, past when it’d be taken to have stopped (RW-366)', async () => {
    createReportFromTemplate.mockImplementation(async (start) => made(start, { dataStatus: 'PENDING' }))
    const started = Date.now()
    let beats = 0
    fetchReportDataStatus.mockImplementation(async () =>
      Date.now() - started < 300
        ? { dataStatus: 'RUNNING', version: 2, dataHeartbeatAt: heartbeat(++beats), dataErrors: [] }
        : { dataStatus: 'DONE', version: 3, dataHeartbeatAt: null, dataErrors: [] },
    )
    fetchReport.mockImplementation(async ({ id }) => {
      const start = STARTS.find((s) => s.id === id)
      return made(
        { id, sessionFilterLocks: [start.lock] },
        { version: 3, dataStatus: 'DONE', blocks: [dataBlock('d1', answered)] },
      )
    })
    setup({ enableFilterLocks: true })
    await startEach()

    await waitFor(() => expect(homeProps.current.notices[0].text).toMatch(/^Both reports are in/))
    // Neither was taken to have stopped while its heartbeat moved on: both were filled in by AutoQL.
    expect(homeProps.current.notices[0].text).not.toMatch(/missing some data/)
    expect(listed(R1)).toMatchObject({ dataStatus: 'DONE' })
    expect(listed(R2)).toMatchObject({ dataStatus: 'DONE' })
    expect(captureQuestion).not.toHaveBeenCalled()
  })

  it('puts the household on a report AutoQL made for the template’s own (before RW-352), and fills it in here', async () => {
    createReportFromTemplate.mockImplementation(async (start) => made({ ...start, sessionFilterLocks: undefined }))
    setup({ enableFilterLocks: true })
    await startEach([{ id: R1, lock: BROWN }])

    await waitFor(() => expect(homeProps.current.notices[0].text).toMatch(/^Your report is in “Monthly review — /))
    expect(captureQuestion).toHaveBeenCalledWith(expect.objectContaining({ filters: [BROWN] }))
    expect(lastSaveOf(R1).report).toMatchObject({
      title: 'Quarterly review — Brown Family',
      sessionFilterLocks: [BROWN],
    })
  })

  it('says which reports are missing data, and why any weren’t made', async () => {
    createReportFromTemplate.mockImplementation(async (start) => {
      if (start.id === R2) {
        throw new ReportsApiError({ status: 404, code: 'REPORT_TEMPLATE_NOT_FOUND' })
      }
      return made(start)
    })
    captureQuestion.mockImplementation(async ({ query }) =>
      query === 'question d2'
        ? { ok: false, reason: 'error', error: { message: 'Failed' } }
        : { ok: true, capture: answered },
    )
    setup({ enableFilterLocks: true })
    await startEach()

    await waitFor(() => expect(homeProps.current.notices).toHaveLength(2))
    expect(homeProps.current.notices).toEqual([
      {
        tone: 'error',
        text: '1 of the 2 reports wasn’t made: that template isn’t published any more. Start it again from the template.',
      },
      {
        tone: 'info',
        text: expect.stringMatching(
          /^1 of 2 reports is in “Monthly review — .+”\. 1 of them is missing some data: open it to see why, and Rerun it\.$/,
        ),
      },
    ])
    expect(listed(R1)).toMatchObject({ dataStatus: 'PARTIAL' })
    expect(listed(R2)).toBeUndefined()
  })

  it('makes one batch at a time, and says so', async () => {
    createReportFromTemplate.mockReturnValue(new Promise(() => {}))
    setup({ enableFilterLocks: true })
    await startEach()
    expect(homeProps.current.notices[0].text).toMatch(/^Making 2 reports in “Monthly review — .+”: 0 done so far\./)

    fireEvent.click(within(screen.getByTestId('reports-tabs')).getByRole('button', { name: 'New report' }))
    await expect(
      mockDialogs.newReport.onStartEachFromTemplate({ templateId: 'tp1', title: 'Monthly review', starts: STARTS }),
    ).rejects.toMatchObject({ code: 'REPORT_BATCH_UNDER_WAY' })
  })

  it('makes none when their folder can’t be made, and can be tried again', async () => {
    createReportFolder.mockRejectedValueOnce(new ReportsApiError({ status: 0 }))
    createReportFromTemplate.mockImplementation(async (start) => made(start))
    setup({ enableFilterLocks: true })
    await waitFor(() => expect(homeProps.current?.reports).not.toBeNull())
    fireEvent.click(within(screen.getByTestId('reports-tabs')).getByRole('button', { name: 'New report' }))
    const start = () =>
      mockDialogs.newReport.onStartEachFromTemplate({ templateId: 'tp1', title: 'Monthly review', starts: STARTS })

    // Turned down before anything changes, so outside act: act doesn't wait for a rejection.
    await expect(start()).rejects.toMatchObject({ status: 0 })
    expect(createReportFromTemplate).not.toHaveBeenCalled()
    expect(screen.getByTestId('new-report-dialog')).toBeTruthy()

    await act(start)
    await waitFor(() => expect(homeProps.current.notices[0].text).toMatch(/^Both reports are in/))
  })

  it('isn’t offered without enableFilterLocks', async () => {
    setup()
    await waitFor(() => expect(homeProps.current?.reports).not.toBeNull())
    fireEvent.click(within(screen.getByTestId('reports-tabs')).getByRole('button', { name: 'New report' }))
    expect(mockDialogs.newReport.onStartEachFromTemplate).toBeUndefined()
  })
})
