import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Reports } from '../workspace/Reports'
import {
  createReport,
  createReportFolder,
  createReportTag,
  deleteReport,
  deleteReportFolder,
  deleteReportTag,
  fetchReport,
  fetchReportFolders,
  fetchReports,
  fetchReportTags,
  organizeReports,
  renameReportFolder,
  ReportsApiError,
  saveReport,
} from '../run/reportsApi'

jest.mock('../run/reportsApi', () => {
  const actual = jest.requireActual('../run/reportsApi')
  return {
    ...actual,
    fetchReports: jest.fn(),
    fetchReport: jest.fn(),
    createReport: jest.fn(),
    saveReport: jest.fn(),
    deleteReport: jest.fn(),
    appendReportBlock: jest.fn(),
    fetchReportFolders: jest.fn(),
    fetchReportTags: jest.fn(),
    createReportFolder: jest.fn(),
    renameReportFolder: jest.fn(),
    deleteReportFolder: jest.fn(),
    createReportTag: jest.fn(),
    updateReportTag: jest.fn(),
    deleteReportTag: jest.fn(),
    organizeReports: jest.fn(),
  }
})

// The builder is tested on its own: here it's a stand-in that shows what it was given and hands back edits.
const mockBuilder = { props: null }
jest.mock('../ReportBuilder', () => ({
  ReportBuilder: (props) => {
    mockBuilder.props = props
    return (
      <div data-test='builder'>
        <span data-test='builder-title'>{props.report?.title}</span>
        {props.toolbarStatus}
      </div>
    )
  },
}))

const mockDialogs = { newReport: null, tiles: null }
jest.mock('../workspace/NewReportDialog', () => ({
  NewReportDialog: (props) => {
    mockDialogs.newReport = props
    return <div data-test='new-report-dialog' />
  },
}))
jest.mock('../workspace/DashboardTilesDialog', () => ({
  DashboardTilesDialog: (props) => {
    mockDialogs.tiles = props
    return <div data-test='tiles-dialog' />
  },
}))

const b64url = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const tokenFor = (project, n = 1) => `h.${b64url({ project_id: project, n })}.s`
const authFor = (project, n) => ({ apiKey: 'key', domain: 'https://example.test', token: tokenFor(project, n) })

const summary = (id, title, updatedAt = '2026-10-15T10:00:00Z') => ({
  id,
  title,
  sizeBytes: 100,
  version: 1,
  folderId: null,
  tagIds: [],
  createdAt: updatedAt,
  updatedAt,
})
const documentOf = (title, blocks = []) => ({ schemaVersion: 1, title, page: {}, blocks })
const stored = (id, title, version = 1, report = documentOf(title)) => ({
  ...summary(id, title),
  version,
  projectId: 'p1',
  report,
})

const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'bbbbbbbb-0000-4000-8000-000000000002'

const homeProps = { current: null }
const renderHome = (home) => {
  homeProps.current = home
  return (
    <ul data-test='home'>
      {(home.reports || []).map((report) => (
        <li key={report.id}>
          <button type='button' onClick={() => home.openReport(report.id)}>
            {`Open ${report.title}`}
          </button>
        </li>
      ))}
      {home.notices.map((notice) => (
        <li key={notice.text} data-test={`notice-${notice.tone}`}>
          {notice.text}
        </li>
      ))}
      {home.listError ? <li data-test='list-error'>{home.listError}</li> : null}
    </ul>
  )
}

const setup = (props = {}) => {
  const ref = React.createRef()
  const view = render(
    <Reports
      ref={ref}
      authentication={authFor('p1')}
      renderHome={renderHome}
      storageKeyPrefix='test.'
      saveDelay={0}
      {...props}
    />,
  )
  return { ...view, ref }
}

const tabButton = (title) => within(screen.getByTestId('reports-tabs')).getByRole('button', { name: title })

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  mockBuilder.props = null
  mockDialogs.newReport = null
  mockDialogs.tiles = null
  homeProps.current = null
  fetchReports.mockResolvedValue({ reports: [summary(A, 'Q3 book'), summary(B, 'Fees')] })
  fetchReport.mockImplementation(async ({ id }) => stored(id, id === A ? 'Q3 book' : 'Fees'))
  saveReport.mockImplementation(async ({ id, version }) => ({
    id,
    version: version + 1,
    updatedAt: '2026-10-16T10:00:00Z',
  }))
  createReport.mockImplementation(async ({ id, report }) => ({
    ...stored(id, report.title, 1, report),
    created: true,
  }))
  deleteReport.mockResolvedValue(undefined)
  fetchReportFolders.mockResolvedValue([])
  fetchReportTags.mockResolvedValue([])
})

describe('Reports', () => {
  it('lists the reports with the token it was given and hands them to the host’s home page', async () => {
    setup()
    await waitFor(() => expect(homeProps.current.reports).toHaveLength(2))
    expect(fetchReports).toHaveBeenCalledWith(expect.objectContaining({ authentication: authFor('p1'), pageSize: 200 }))
    expect(screen.getByRole('button', { name: 'Open Q3 book' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New report' })).not.toBeDisabled()
  })

  it('draws a plain home page when the host doesn’t draw one', async () => {
    setup({ renderHome: undefined })
    expect(await screen.findByText('Fees')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Q3 book'))
    expect(await screen.findByTestId('builder')).toBeInTheDocument()
  })

  it('opens a report in a tab, tells the host, and goes home again', async () => {
    const onShowReport = jest.fn()
    setup({ onShowReport })
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await waitFor(() => expect(screen.getByTestId('builder-title')).toHaveTextContent('Q3 book'))
    expect(fetchReport).toHaveBeenCalledWith(expect.objectContaining({ id: A, authentication: authFor('p1') }))
    expect(tabButton('Q3 book')).toHaveAttribute('aria-current', 'page')
    expect(onShowReport).toHaveBeenLastCalledWith(A)

    fireEvent.click(screen.getByRole('button', { name: 'All reports' }))
    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(onShowReport).toHaveBeenLastCalledWith(null)
    // Closing nothing: the tab stays open.
    expect(tabButton('Q3 book')).toBeInTheDocument()
  })

  it('shows the report the host’s address names, and follows the address when it changes', async () => {
    const onShowReport = jest.fn()
    const view = setup({ shownReportId: B, onShowReport })
    await waitFor(() => expect(screen.getByTestId('builder-title')).toHaveTextContent('Fees'))
    expect(onShowReport).not.toHaveBeenCalled()

    view.rerender(
      <Reports
        authentication={authFor('p1')}
        renderHome={renderHome}
        storageKeyPrefix='test.'
        saveDelay={0}
        shownReportId={A}
        onShowReport={onShowReport}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('builder-title')).toHaveTextContent('Q3 book'))

    // One that isn't in the list: home, and the address is put right.
    view.rerender(
      <Reports
        authentication={authFor('p1')}
        renderHome={renderHome}
        storageKeyPrefix='test.'
        saveDelay={0}
        shownReportId='gone'
        onShowReport={onShowReport}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument())
    expect(onShowReport).toHaveBeenLastCalledWith(null)
  })

  it('remembers the open tabs for the data source under the host’s prefix, and drops ones no longer listed', async () => {
    localStorage.setItem('test.reportTabs', JSON.stringify({ p1: ['gone', B] }))
    setup()
    await waitFor(() => expect(tabButton('Fees')).toBeInTheDocument())
    expect(screen.getByTestId('home')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Q3 book' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('test.reportTabs'))).toEqual({ p1: [B, A] }))
  })

  it('shows the next tab after closing the one shown, goes home after the last, and deletes nothing', async () => {
    localStorage.setItem('test.reportTabs', JSON.stringify({ p1: [A, B] }))
    const onShowReport = jest.fn()
    setup({ shownReportId: A, onShowReport })
    await waitFor(() => expect(screen.getByTestId('builder-title')).toHaveTextContent('Q3 book'))

    fireEvent.click(tabButton('Close Q3 book'))
    await waitFor(() => expect(screen.getByTestId('builder-title')).toHaveTextContent('Fees'))
    expect(onShowReport).toHaveBeenLastCalledWith(B)

    fireEvent.click(tabButton('Close Fees'))
    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(onShowReport).toHaveBeenLastCalledWith(null)
    await waitFor(() => expect(localStorage.getItem('test.reportTabs')).toBeNull())
    expect(deleteReport).not.toHaveBeenCalled()
    expect(homeProps.current.reports).toHaveLength(2)
  })

  it('keeps the width a tab was dragged to for the data source, and forgets it when the tab closes', async () => {
    localStorage.setItem('test.reportTabs', JSON.stringify({ p1: [A, B] }))
    localStorage.setItem('test.reportTabWidths', JSON.stringify({ p1: { [A]: 240, gone: 300 } }))
    setup()
    await waitFor(() => expect(tabButton('Fees')).toBeInTheDocument())
    const tabOf = (title) => tabButton(title).parentElement
    expect(tabOf('Q3 book').style.width).toBe('240px')
    expect(tabOf('Fees').style.width).toBe('')
    await waitFor(() => expect(JSON.parse(localStorage.getItem('test.reportTabWidths'))).toEqual({ p1: { [A]: 240 } }))

    // jsdom measures nothing, so the dragged edge stops at the narrowest a tab can be. It has no PointerEvent either.
    const pointer = (type, init) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      return event
    }
    const edge = within(tabOf('Fees')).getByTestId('reports-tab-resize')
    fireEvent(edge, pointer('pointerdown', { button: 0, clientX: 100 }))
    fireEvent(edge, pointer('pointermove', { clientX: 150 }))
    fireEvent(edge, pointer('pointerup', { clientX: 150 }))
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('test.reportTabWidths'))).toEqual({ p1: { [A]: 240, [B]: 96 } }),
    )
    expect(tabOf('Fees').style.width).toBe('96px')

    fireEvent.click(tabButton('Close Q3 book'))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('test.reportTabWidths'))).toEqual({ p1: { [B]: 96 } }))
  })

  it('saves an edit after the pause, with the version it was read at, and says so', async () => {
    setup({ saveDelay: 20 })
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    expect(screen.getByTestId('reports-save-status')).toHaveAttribute('data-state', 'saved')

    act(() => mockBuilder.props.onChange(documentOf('Q3 book, final')))
    expect(screen.getByTestId('reports-save-status')).toHaveAttribute('data-state', 'saving')
    // The tab and the list take the new title at once.
    expect(tabButton('Q3 book, final')).toBeInTheDocument()

    await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1))
    expect(saveReport).toHaveBeenCalledWith(
      expect.objectContaining({
        id: A,
        version: 1,
        report: documentOf('Q3 book, final'),
        authentication: authFor('p1'),
      }),
    )
    await waitFor(() => expect(screen.getByTestId('reports-save-status')).toHaveAttribute('data-state', 'saved'))
  })

  it('gives the home page when each report was last stored, as its saves come back', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')

    act(() => mockBuilder.props.onChange(documentOf('Q3 book, final')))
    await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('reports-save-status')).toHaveAttribute('data-state', 'saved'))

    fireEvent.click(screen.getByRole('button', { name: 'All reports' }))
    const listed = (id) => homeProps.current.reports.find((report) => report.id === id)
    expect(listed(A)).toMatchObject({ title: 'Q3 book, final', updatedAt: '2026-10-16T10:00:00Z' })
    // The one not edited is as it was.
    expect(listed(B).updatedAt).toBe('2026-10-15T10:00:00Z')
  })

  it('saves at once on ⌘S / Ctrl+S', async () => {
    setup({ saveDelay: 60000 })
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    act(() => mockBuilder.props.onChange(documentOf('Edited')))
    expect(saveReport).not.toHaveBeenCalled()

    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1))
  })

  it('leaves ⌘S / Ctrl+S alone with no report shown, or with the focus in the host’s own page', async () => {
    const hostField = document.createElement('input')
    document.body.appendChild(hostField)
    const press = (target) => {
      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })
      act(() => {
        target.dispatchEvent(event)
      })
      return event
    }
    try {
      setup({ saveDelay: 60000 })
      await screen.findByRole('button', { name: 'Open Q3 book' })
      expect(press(window).defaultPrevented).toBe(false)

      fireEvent.click(screen.getByRole('button', { name: 'Open Q3 book' }))
      await screen.findByTestId('builder')
      act(() => mockBuilder.props.onChange(documentOf('Edited')))
      expect(press(hostField).defaultPrevented).toBe(false)
      expect(saveReport).not.toHaveBeenCalled()

      expect(press(screen.getByTestId('builder')).defaultPrevented).toBe(true)
      await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1))
    } finally {
      hostField.remove()
    }
  })

  it('sends what’s waiting when the page goes away, without waiting for a save on its way', async () => {
    const { ref } = setup({ saveDelay: 60000 })
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    saveReport.mockImplementationOnce(() => new Promise(() => {}))
    act(() => mockBuilder.props.onChange(documentOf('One')))
    act(() => ref.current.saveNow())
    expect(saveReport).toHaveBeenCalledTimes(1)

    act(() => mockBuilder.props.onChange(documentOf('Two')))
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(saveReport).toHaveBeenCalledTimes(2)
    expect(saveReport.mock.calls[1][0]).toEqual(
      expect.objectContaining({ id: A, report: documentOf('Two'), version: 1, keepalive: true }),
    )
  })

  it('saves at once when the page is hidden, while it’s still there to finish', async () => {
    setup({ saveDelay: 60000 })
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    act(() => mockBuilder.props.onChange(documentOf('Hidden')))
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    try {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1))
      expect(saveReport.mock.calls[0][0]).not.toHaveProperty('keepalive')
    } finally {
      delete document.visibilityState
    }
  })

  it('keeps blocks merged in from another tab when an edit made before the builder had them comes in', async () => {
    const { ref } = setup({ saveDelay: 60000 })
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    const appended = { id: 'added-elsewhere', type: 'text', text: 'From Add to Report' }
    const saver = ref.current.savers.get(A)

    // A save merged the block in; before the builder re-rendered with it, it emitted an edit built without it.
    act(() => {
      saver.options.onMerged(documentOf('Q3 book', [appended]), [appended])
      mockBuilder.props.onChange(documentOf('Typed meanwhile'))
    })
    expect(mockBuilder.props.report).toEqual(documentOf('Typed meanwhile', [appended]))
    expect(saver.report).toEqual(documentOf('Typed meanwhile', [appended]))

    // Once the builder has it, an edit without it is one that took it out.
    act(() => mockBuilder.props.onChange(documentOf('Typed meanwhile')))
    expect(mockBuilder.props.report.blocks).toEqual([])
  })

  it('lists every report a page at a time, and opens one from a later page that the address names', async () => {
    const C = 'cccccccc-0000-4000-8000-000000000003'
    // Fees was saved between the two pages, so it's on both.
    fetchReports.mockImplementation(async ({ page }) =>
      page === 2
        ? { reports: [summary(B, 'Fees'), summary(C, 'Older')], page: 2, totalPages: 2 }
        : { reports: [summary(A, 'Q3 book'), summary(B, 'Fees')], page: 1, totalPages: 2 },
    )
    fetchReport.mockImplementation(async ({ id }) => stored(id, id === C ? 'Older' : 'Q3 book'))
    setup({ shownReportId: C })
    await waitFor(() => expect(screen.getByTestId('builder-title')).toHaveTextContent('Older'))
    expect(fetchReports).toHaveBeenCalledTimes(2)
    expect(fetchReports).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 200 }))

    fireEvent.click(screen.getByRole('button', { name: 'All reports' }))
    expect(homeProps.current.reports.map((report) => report.id)).toEqual([A, B, C])
  })

  it('lists what it could when a later page fails, rather than nothing', async () => {
    fetchReports.mockImplementation(async ({ page }) => {
      if (page === 3) {
        throw new ReportsApiError({ status: 503 })
      }
      return page === 2
        ? { reports: [summary('cccccccc-0000-4000-8000-000000000003', 'Older')], page: 2, totalPages: 3 }
        : { reports: [summary(A, 'Q3 book'), summary(B, 'Fees')], page: 1, totalPages: 3 }
    })
    setup()
    await waitFor(() => expect(homeProps.current.reports).toHaveLength(3))
    expect(fetchReports).toHaveBeenCalledTimes(3)
    expect(homeProps.current.listError).toBeNull()
    expect(screen.queryByTestId('list-error')).not.toBeInTheDocument()
  })

  it('stops saving when the report changed elsewhere, and reloads the stored copy when asked', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    saveReport.mockRejectedValueOnce(
      new ReportsApiError({ status: 409, code: 'REPORT_VERSION_CONFLICT', details: { version: 2 } }),
    )
    fetchReport.mockResolvedValueOnce(stored(A, 'Retitled in another tab', 2))

    act(() => mockBuilder.props.onChange(documentOf('Mine')))
    await waitFor(() => expect(screen.getByTestId('reports-save-status')).toHaveAttribute('data-state', 'conflict'))
    expect(screen.getByTestId('reports-editor-notice')).toHaveTextContent('changed in another tab or window')

    fetchReport.mockResolvedValueOnce(stored(A, 'Retitled in another tab', 2))
    fireEvent.click(screen.getByTestId('reports-save-status'))
    await waitFor(() => expect(screen.getByTestId('builder-title')).toHaveTextContent('Retitled in another tab'))
    expect(screen.queryByTestId('reports-editor-notice')).not.toBeInTheDocument()
  })

  it('takes the dot off a report’s tab once its stored copy is reloaded after a conflict', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    saveReport.mockRejectedValueOnce(
      new ReportsApiError({ status: 409, code: 'REPORT_VERSION_CONFLICT', details: { version: 2 } }),
    )
    fetchReport.mockResolvedValueOnce(stored(A, 'Retitled in another tab', 2))
    act(() => mockBuilder.props.onChange(documentOf('Mine')))
    await waitFor(() => expect(screen.getByTestId('reports-save-status')).toHaveAttribute('data-state', 'conflict'))

    fetchReport.mockResolvedValueOnce(stored(A, 'Retitled in another tab', 2))
    fireEvent.click(screen.getByTestId('reports-save-status'))
    await waitFor(() => expect(screen.getByTestId('builder-title')).toHaveTextContent('Retitled in another tab'))
    fireEvent.click(screen.getByRole('button', { name: 'All reports' }))
    expect(screen.queryByTestId('reports-tab-not-saved')).not.toBeInTheDocument()
  })

  it('drops a report deleted elsewhere when it’s opened, and says so on the home page', async () => {
    fetchReport.mockRejectedValueOnce(new ReportsApiError({ status: 404, code: 'REPORT_NOT_FOUND' }))
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Open Fees' }))
    await waitFor(() => expect(screen.getByTestId('notice-info')).toHaveTextContent('“Fees” was deleted'))
    expect(homeProps.current.reports.map((report) => report.id)).toEqual([A])
    expect(within(screen.getByTestId('reports-tabs')).queryByRole('button', { name: 'Fees' })).not.toBeInTheDocument()
  })

  it('says why a report couldn’t be opened, and tries again', async () => {
    fetchReport.mockRejectedValueOnce(new ReportsApiError({ status: 503 }))
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Open Fees' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This report couldn’t be opened')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByTestId('builder-title')).toHaveTextContent('Fees'))
  })

  it('starts a new report from New report, creates it right away and opens it', async () => {
    setup()
    await screen.findByRole('button', { name: 'Open Q3 book' })
    fireEvent.click(screen.getByRole('button', { name: 'New report' }))
    expect(screen.getByTestId('new-report-dialog')).toBeInTheDocument()

    act(() =>
      mockDialogs.newReport.onStart({ title: 'Fresh', blocks: [{ id: 'b1', type: 'text', queryResponse: {} }] }),
    )
    expect(screen.queryByTestId('new-report-dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(createReport).toHaveBeenCalledTimes(1))
    const sent = createReport.mock.calls[0][0]
    expect(sent.authentication).toEqual(authFor('p1'))
    expect(sent.report.title).toBe('Fresh')
    expect(JSON.stringify(sent.report)).not.toContain('queryResponse')
    expect(screen.getByTestId('builder-title')).toHaveTextContent('Fresh')
    expect(tabButton('Fresh')).toHaveAttribute('aria-current', 'page')
  })

  it('deletes a report for the host’s home page, closing its tab', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Open Fees' }))
    await screen.findByTestId('builder')

    let deleted
    await act(async () => {
      deleted = await homeProps.current.deleteReport(B)
    })
    expect(deleted).toBe(true)
    expect(deleteReport).toHaveBeenCalledWith(expect.objectContaining({ id: B, authentication: authFor('p1') }))
    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(homeProps.current.reports.map((report) => report.id)).toEqual([A])
    expect(within(screen.getByTestId('reports-tabs')).queryByRole('button', { name: 'Fees' })).not.toBeInTheDocument()
  })

  it('says when a delete failed', async () => {
    deleteReport.mockRejectedValueOnce(new ReportsApiError({ status: 500 }))
    setup()
    await screen.findByRole('button', { name: 'Open Fees' })
    let deleted
    await act(async () => {
      deleted = await homeProps.current.deleteReport(B)
    })
    expect(deleted).toBe(false)
    expect(screen.getByTestId('notice-error')).toHaveTextContent('The report wasn’t deleted')
    expect(homeProps.current.reports).toHaveLength(2)
  })

  it('moves to another data source’s reports, while a save waiting for the first still goes with its token', async () => {
    const view = setup({ saveDelay: 60000 })
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    act(() => mockBuilder.props.onChange(documentOf('Unsaved')))

    fetchReports.mockResolvedValueOnce({ reports: [summary('cccccccc-0000-4000-8000-000000000003', 'Other')] })
    view.rerender(
      <Reports authentication={authFor('p2')} renderHome={renderHome} storageKeyPrefix='test.' saveDelay={60000} />,
    )
    await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1))
    expect(saveReport.mock.calls[0][0].authentication).toEqual(authFor('p1'))
    await waitFor(() => expect(homeProps.current.reports.map((report) => report.title)).toEqual(['Other']))
    expect(fetchReports).toHaveBeenLastCalledWith(expect.objectContaining({ authentication: authFor('p2') }))
    expect(screen.getByTestId('home')).toBeInTheDocument()
  })

  it('asks the host for new credentials once when AutoQL turns the token away, and lists again with them', async () => {
    const onUnauthorized = jest.fn()
    fetchReports.mockRejectedValueOnce(new ReportsApiError({ status: 401 }))
    const view = setup({ onUnauthorized })
    await waitFor(() => expect(screen.getByTestId('list-error')).toHaveTextContent('you’re signed out'))
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    view.rerender(
      <Reports
        authentication={authFor('p1', 2)}
        renderHome={renderHome}
        storageKeyPrefix='test.'
        saveDelay={0}
        onUnauthorized={onUnauthorized}
      />,
    )
    await waitFor(() => expect(homeProps.current.reports).toHaveLength(2))
    expect(fetchReports).toHaveBeenLastCalledWith(expect.objectContaining({ authentication: authFor('p1', 2) }))
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('opens the tiles picker for an empty Data block and hands its blocks back to the builder', async () => {
    setup({ dashboards: [{ id: 'd1', name: 'Book', tiles: [] }] })
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')

    let picked
    act(() => {
      picked = mockBuilder.props.pickDashboardTiles()
    })
    expect(screen.getByTestId('tiles-dialog')).toBeInTheDocument()
    expect(mockDialogs.tiles.mode).toBe('add')
    expect(mockDialogs.tiles.report.title).toBe('Q3 book')
    const blocks = [{ id: 't1', type: 'data' }]
    act(() => mockDialogs.tiles.onAdd(blocks))
    await expect(picked).resolves.toEqual(blocks)
    expect(screen.queryByTestId('tiles-dialog')).not.toBeInTheDocument()
  })

  it('offers no tiles picker where the host has no dashboards', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    expect(mockBuilder.props.pickDashboardTiles).toBeUndefined()
  })

  it('shows a report saved by a newer version without saving over it', async () => {
    fetchReport.mockResolvedValueOnce(
      stored(A, 'From the future', 1, { ...documentOf('From the future'), schemaVersion: 99 }),
    )
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    expect(screen.getByTestId('reports-editor-notice')).toHaveTextContent('saved by a newer version')
    expect(screen.queryByTestId('reports-save-status')).not.toBeInTheDocument()
    act(() => mockBuilder.props.onChange({ ...documentOf('Changed'), schemaVersion: 99 }))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(saveReport).not.toHaveBeenCalled()
  })

  it('saves everything waiting when the host asks (before signing out), and when it goes away', async () => {
    const { ref, unmount } = setup({ saveDelay: 60000 })
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')
    act(() => mockBuilder.props.onChange(documentOf('One')))
    expect(ref.current.hasUnsavedChanges()).toBe(true)

    let results
    await act(async () => {
      results = await ref.current.flushAll()
    })
    expect(results).toEqual([true])
    expect(saveReport).toHaveBeenCalledTimes(1)
    expect(ref.current.hasUnsavedChanges()).toBe(false)

    act(() => mockBuilder.props.onChange(documentOf('Two')))
    unmount()
    await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(2))
    expect(saveReport.mock.calls[1][0].report.title).toBe('Two')
  })

  it('asks before the page closes with a save still waiting', async () => {
    setup({ saveDelay: 60000 })
    fireEvent.click(await screen.findByRole('button', { name: 'Open Q3 book' }))
    await screen.findByTestId('builder')

    const idle = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(idle)
    expect(idle.defaultPrevented).toBe(false)

    act(() => mockBuilder.props.onChange(documentOf('Waiting')))
    const leaving = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(leaving)
    expect(leaving.defaultPrevented).toBe(true)
    await waitFor(() => expect(saveReport).toHaveBeenCalledWith(expect.objectContaining({ keepalive: true })))
  })

  describe('folders and tags', () => {
    const folder = (id, name, reportCount = 0) => ({ id, name, reportCount, createdAt: '', updatedAt: '' })
    const tag = (id, name, color = 'blue') => ({ ...folder(id, name), color })
    const filed = (id, title, folderId, tagIds) => ({ ...summary(id, title), folderId, tagIds })
    const home = () => homeProps.current

    it('loads them beside the list, A to Z whatever their case, with the token it was given', async () => {
      fetchReportFolders.mockResolvedValue([folder('f2', 'prospects'), folder('f1', 'Households')])
      fetchReportTags.mockResolvedValue([tag('t2', 'Q3'), tag('t1', 'client-facing', 'teal')])
      setup()
      await waitFor(() => expect(home().folders).not.toBeNull())
      expect(home().folders.map((f) => f.name)).toEqual(['Households', 'prospects'])
      expect(home().tags.map((t) => t.name)).toEqual(['client-facing', 'Q3'])
      expect(fetchReportFolders).toHaveBeenCalledWith(expect.objectContaining({ authentication: authFor('p1') }))
      expect(home().organizersError).toBeNull()
    })

    it('says why they couldn’t be loaded, and tries again', async () => {
      fetchReportFolders.mockRejectedValueOnce(new ReportsApiError({ status: 503 }))
      setup()
      await waitFor(() =>
        expect(home().organizersError).toBe('Folders and tags couldn’t be loaded: the server had a problem.'),
      )
      expect(home().folders).toEqual([])
      act(() => home().retryOrganizers())
      await waitFor(() => expect(home().organizersError).toBeNull())
    })

    it('makes a folder, and finds the one with that name instead of making it twice', async () => {
      createReportFolder.mockImplementation(async ({ id, name }) => ({ ...folder(id, name), created: true }))
      setup()
      await waitFor(() => expect(home().folders).toEqual([]))
      let made
      await act(async () => {
        made = await home().createFolder('  Households ')
      })
      expect(createReportFolder).toHaveBeenCalledWith(
        expect.objectContaining({ authentication: authFor('p1'), name: 'Households', id: expect.any(String) }),
      )
      expect(made).toEqual(expect.objectContaining({ name: 'Households' }))
      expect(made).not.toHaveProperty('created')
      expect(home().folders.map((f) => f.name)).toEqual(['Households'])

      let again
      await act(async () => {
        again = await home().createFolder('households')
      })
      expect(again.id).toBe(made.id)
      expect(createReportFolder).toHaveBeenCalledTimes(1)
    })

    it('takes the folder made meanwhile in another tab when the name turns out to be taken', async () => {
      createReportFolder.mockRejectedValue(
        new ReportsApiError({ status: 409, code: 'REPORT_FOLDER_NAME_TAKEN', details: { id: 'f9' } }),
      )
      setup()
      await waitFor(() => expect(home().folders).toEqual([]))
      fetchReportFolders.mockResolvedValueOnce([folder('f9', 'Households')])
      let made
      await act(async () => {
        made = await home().createFolder('Households')
      })
      expect(made.id).toBe('f9')
      expect(home().folders.map((f) => f.id)).toEqual(['f9'])
    })

    it('turns down a name that’s empty or over 80 characters without asking the service', async () => {
      setup()
      await waitFor(() => expect(home().tags).toEqual([]))
      await expect(home().createFolder('   ')).rejects.toThrow(
        'The folder wasn’t saved: a name can be 1 to 80 characters.',
      )
      await expect(home().createTag('x'.repeat(81), 'blue')).rejects.toThrow(
        'The tag wasn’t saved: a name can be 1 to 80 characters.',
      )
      expect(createReportFolder).not.toHaveBeenCalled()
      expect(createReportTag).not.toHaveBeenCalled()
    })

    it('makes a tag in the colour asked for, and renames a folder', async () => {
      fetchReportFolders.mockResolvedValue([folder('f1', 'Households')])
      createReportTag.mockImplementation(async ({ id, name, color }) => ({ ...tag(id, name, color), created: true }))
      renameReportFolder.mockImplementation(async ({ id, name }) => folder(id, name))
      setup()
      await waitFor(() => expect(home().folders).toHaveLength(1))
      await act(async () => {
        await home().createTag('Draft', 'amber')
        await home().renameFolder('f1', 'Clients')
      })
      expect(createReportTag).toHaveBeenCalledWith(expect.objectContaining({ name: 'Draft', color: 'amber' }))
      expect(home().tags.map((t) => [t.name, t.color])).toEqual([['Draft', 'amber']])
      expect(home().folders.map((f) => f.name)).toEqual(['Clients'])
    })

    it('unfiles a deleted folder’s reports and takes a deleted tag off its reports, deleting none', async () => {
      fetchReports.mockResolvedValue({
        reports: [filed(A, 'Q3 book', 'f1', ['t1', 't2']), filed(B, 'Fees', 'f2', ['t1'])],
      })
      fetchReportFolders.mockResolvedValue([folder('f1', 'Households'), folder('f2', 'Reviews')])
      fetchReportTags.mockResolvedValue([tag('t1', 'Draft'), tag('t2', 'Q3')])
      deleteReportFolder.mockResolvedValue(undefined)
      deleteReportTag.mockRejectedValue(new ReportsApiError({ status: 404, code: 'REPORT_TAG_NOT_FOUND' }))
      setup()
      await waitFor(() => expect(home().tags).toHaveLength(2))
      await act(async () => {
        await home().deleteFolder('f1')
        // Already gone (deleted in another tab): it counts as deleted.
        await home().deleteTag('t1')
      })
      expect(home().folders.map((f) => f.id)).toEqual(['f2'])
      expect(home().tags.map((t) => t.id)).toEqual(['t2'])
      expect(home().reports.map((r) => [r.id, r.folderId, r.tagIds])).toEqual([
        [A, null, ['t2']],
        [B, 'f2', []],
      ])
      expect(deleteReport).not.toHaveBeenCalled()
    })

    it('files and tags reports all at once, and the list follows where the service says they are', async () => {
      organizeReports.mockResolvedValue([
        { id: A, folderId: 'f1', tagIds: ['t1'] },
        { id: B, folderId: 'f1', tagIds: ['t1'] },
      ])
      setup()
      await waitFor(() => expect(home().reports).toHaveLength(2))
      let placements
      await act(async () => {
        placements = await home().organizeReports({ reportIds: [A, B], folderId: 'f1', addTagIds: ['t1'] })
      })
      expect(organizeReports).toHaveBeenCalledWith(
        expect.objectContaining({
          authentication: authFor('p1'),
          reportIds: [A, B],
          folderId: 'f1',
          addTagIds: ['t1'],
        }),
      )
      expect(placements).toHaveLength(2)
      expect(home().reports.map((r) => [r.folderId, r.tagIds])).toEqual([
        ['f1', ['t1']],
        ['f1', ['t1']],
      ])
    })

    it('turns down a change the service refused with the line to show, leaving the list as it was', async () => {
      organizeReports.mockRejectedValue(new ReportsApiError({ status: 422, code: 'REPORT_TAGS_INVALID' }))
      setup()
      await waitFor(() => expect(home().reports).toHaveLength(2))
      await expect(home().organizeReports({ reportIds: [A], addTagIds: ['t1'] })).rejects.toThrow(
        'Nothing was changed: a report can carry up to 20 tags.',
      )
      expect(home().reports.map((r) => r.tagIds)).toEqual([[], []])
    })

    it('makes a new report in the folder the host’s home page shows, while that folder is the user’s', async () => {
      fetchReportFolders.mockResolvedValue([folder('f1', 'Households')])
      const view = setup({ newReportFolderId: 'f1' })
      await waitFor(() => expect(home().folders).toHaveLength(1))
      fireEvent.click(screen.getByRole('button', { name: 'New report' }))
      act(() => mockDialogs.newReport.onStart({ title: 'Filed', blocks: [] }))
      await waitFor(() => expect(createReport).toHaveBeenCalledTimes(1))
      expect(createReport.mock.calls[0][0]).toEqual(expect.objectContaining({ folderId: 'f1' }))
      fireEvent.click(screen.getByRole('button', { name: 'All reports' }))
      expect(home().reports.find((r) => r.title === 'Filed').folderId).toBe('f1')

      // A folder that isn't one of theirs (deleted meanwhile, say) files nothing.
      view.rerender(
        <Reports
          authentication={authFor('p1')}
          renderHome={renderHome}
          storageKeyPrefix='test.'
          saveDelay={0}
          newReportFolderId='gone'
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'New report' }))
      act(() => mockDialogs.newReport.onStart({ title: 'Loose', blocks: [] }))
      await waitFor(() => expect(createReport).toHaveBeenCalledTimes(2))
      expect(createReport.mock.calls[1][0]).not.toHaveProperty('folderId')
    })

    it('deletes several reports for the home page, each as one is deleted', async () => {
      setup()
      await waitFor(() => expect(home().reports).toHaveLength(2))
      let deleted
      await act(async () => {
        deleted = await home().deleteReports([A, B])
      })
      expect(deleted).toBe(true)
      expect(deleteReport.mock.calls.map(([call]) => call.id)).toEqual([A, B])
      expect(home().reports).toEqual([])
    })
  })
})
