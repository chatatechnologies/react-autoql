import React from 'react'
import PropTypes from 'prop-types'
import { autoQLConfigDefault, dataFormattingDefault, parseJwt } from 'autoql-fe-utils'
import { withTheme } from '../../../theme'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'
import { ReportBuilder } from '../ReportBuilder'
import { createEmptyReport, isNewerSchema } from '../model/reportSchema'
import { Icon } from '../components/icons'
import { deleteReport as deleteStoredReport, fetchReport, fetchReports } from '../run/reportsApi'
import { DEFAULT_STORAGE_PREFIX, REPORTS_PAGE_SIZE, RS, SAVE_DELAY_MS } from './constants'
import { REPORTS_STRINGS } from './strings'
import {
  describeReportError,
  isReportGone,
  isUnauthorized,
  newReportId,
  stripQueryResponses,
  titleOf,
} from './documents'
import { ReportSaver } from './ReportSaver'
import { loadOpenTabs, loadTabWidths, saveOpenTabs, saveTabWidths, widthsFor, withTabClosed, withTabOpen } from './tabs'
import { ReportTabs } from './ReportTabs'
import { SaveStatus } from './SaveStatus'
import { NewReportDialog } from './NewReportDialog'
import { DashboardTilesDialog } from './DashboardTilesDialog'
import './Reports.scss'

// The reports workspace: a user's reports on one data source, kept by AutoQL's report service (run/reportsApi),
// each open in a tab of its own with a ReportBuilder. Everything but the home page is here — the tab strip, New
// report (from a question, a dashboard, or a blank page), opening and autosaving each report, what's said when a
// save fails or the report was changed elsewhere, and the dashboard-tiles picker. The host draws the home page
// (renderHome), and keeps which report is shown in its address if it likes (shownReportId and onShowReport).
//
// Edits are saved after a short pause, and at once when switching tabs, leaving the page, pressing the save
// control or ⌘S / Ctrl+S (ReportSaver, one per report opened here). A save that failed is kept and tried again (its
// tab keeps a dot meanwhile), and the browser asks before the page closes with one. Which reports are open is
// remembered in this browser, per data source (tabs.js). The data source is the token's: when the authentication
// moves to another one, its list and tabs replace these, and what was waiting to be saved still goes to its own.

const S = REPORTS_STRINGS
const NO_DASHBOARDS = []
const NO_IDS = new Set()

// Which data source the token is for (its project), so reports, tabs and credentials stay with it.
const dataSourceOf = (authentication, dataSourceId) => {
  if (dataSourceId !== undefined && dataSourceId !== null && dataSourceId !== '') {
    return String(dataSourceId)
  }
  try {
    const project = authentication?.token ? parseJwt(authentication.token)?.project_id : undefined
    return project === undefined || project === null ? '' : String(project)
  } catch (error) {
    return ''
  }
}

const sameCredentials = (a, b) => a?.token === b?.token && a?.apiKey === b?.apiKey && a?.domain === b?.domain

const without = (ids, id) => {
  const next = new Set(ids)
  next.delete(id)
  return next
}

// When a report was last saved, for the plain home page: minutes for the last hour, then the date.
const editedLabel = (iso, now = new Date()) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (minutes < 60) {
    return minutes < 1 ? S.workspace.justNow : S.workspace.minutesAgo(minutes)
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

// The home page a host doesn't draw its own of: every report, most recently saved first.
const PlainHome = ({ reports, listError, retryList, openReport, notices }) => {
  let content
  if (reports === null) {
    content = (
      <div className={`${RS}-message`}>
        <span className={`${RS}-spin`}>
          <Icon name='spinner' size={20} />
        </span>
        <p>{S.loadingReports}</p>
      </div>
    )
  } else if (listError && !reports.length) {
    content = (
      <div className={`${RS}-message`} data-tone='error'>
        <Icon name='alert' size={20} />
        <p role='alert'>{listError}</p>
        <button type='button' className={`${RS}-button`} onClick={retryList}>
          {S.tryAgain}
        </button>
      </div>
    )
  } else if (!reports.length) {
    content = (
      <div className={`${RS}-message`}>
        <p>{S.workspace.noReports}</p>
      </div>
    )
  } else {
    content = (
      <ul className={`${RS}-home-items`}>
        {reports.map((report) => (
          <li key={report.id}>
            <button type='button' className={`${RS}-home-item`} onClick={() => openReport(report.id)}>
              <Icon name='file' />
              <span className={`${RS}-home-name`}>{titleOf(report)}</span>
              <span className={`${RS}-home-edited`}>{editedLabel(report.updatedAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div className={`${RS}-home-list`} data-test='reports-home'>
      <h2 className={`${RS}-home-title`}>{S.workspace.homeLabel}</h2>
      {notices.map((notice) => (
        <p key={notice.text} className={notice.tone === 'error' ? `${RS}-error` : `${RS}-note`} role='status'>
          {notice.text}
        </p>
      ))}
      {content}
    </div>
  )
}

export class ReportsWithoutTheme extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    // Which data source the reports are on. The token's project by default.
    dataSourceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    // The dashboards a report can take tiles from (New report from a dashboard, and an empty Data block's
    // "Pick dashboard tiles…"): [{ id, name, tiles, type? }]. Null while they load; leave it out where there are
    // none, and those choices aren't offered. Tiles may carry the answers the host already has.
    dashboards: PropTypes.arrayOf(PropTypes.object),
    // Why the dashboards couldn't be loaded, said over the open report.
    dashboardsError: PropTypes.string,
    // A dashboard's tiles as the tiles picker answered them, for a host that keeps answers between views.
    onDashboardTilesChange: PropTypes.func,
    // The report shown (null: the home page), for a host that keeps it in its address: when it changes, the
    // workspace shows that report (once the list is in, and if it's there). onShowReport hears every change made
    // here, with the report's id or null.
    shownReportId: PropTypes.string,
    onShowReport: PropTypes.func,
    // Draws the home page, from { reports, listError, retryList, openReport, deleteReport, deletingId, notices,
    // newReport }. A plain list of the reports by default.
    renderHome: PropTypes.func,
    // Where the open tabs are remembered in this browser: localStorage keys start with this. Null to remember
    // nothing.
    storageKeyPrefix: PropTypes.string,
    // AutoQL turned the token away (401): get a new one and pass it in; what failed is tried again with it.
    onUnauthorized: PropTypes.func,
    // How long a pause in editing is before a report saves (ms).
    saveDelay: PropTypes.number,
    // Passed on to each report's ReportBuilder.
    branding: PropTypes.object,
    enableBranding: PropTypes.bool,
    canEditBranding: PropTypes.bool,
    enableDataBlocks: PropTypes.bool,
    enableAnalysis: PropTypes.bool,
    enableRunReport: PropTypes.bool,
    fontStylesheetUrl: PropTypes.string,
    getAuthenticationForProject: PropTypes.func,
    onRunComplete: PropTypes.func,
    onErrorCallback: PropTypes.func,
    className: PropTypes.string,
  }

  static defaultProps = {
    authentication: undefined,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    dataSourceId: undefined,
    dashboards: undefined,
    dashboardsError: undefined,
    onDashboardTilesChange: undefined,
    shownReportId: undefined,
    onShowReport: undefined,
    renderHome: undefined,
    storageKeyPrefix: DEFAULT_STORAGE_PREFIX,
    onUnauthorized: undefined,
    saveDelay: SAVE_DELAY_MS,
    branding: undefined,
    enableBranding: false,
    canEditBranding: false,
    enableDataBlocks: false,
    enableAnalysis: false,
    enableRunReport: false,
    fontStylesheetUrl: null,
    getAuthenticationForProject: undefined,
    onRunComplete: undefined,
    onErrorCallback: undefined,
    className: undefined,
  }

  constructor(props) {
    super(props)
    // One saver per report opened here, so each keeps its own waiting or failed save, and the data source each
    // is on: its saves go with that one's credentials (the latest seen), even once another is shown.
    this.savers = new Map()
    this.saverSources = new Map()
    this.credentials = new Map()
    this.sourceId = dataSourceOf(props.authentication, props.dataSourceId)
    this.credentials.set(this.sourceId, props.authentication)
    // Mirrors of state read by callbacks before a render catches up.
    this.shownId = null
    this.tabs = []
    // The data source the tabs are for, once its list is in (until then nothing is remembered over what was).
    this.tabsSource = null
    // What the host's address last said was shown, as far as this knows, so its changes can be told from ours.
    this.reported = props.shownReportId
    this.listRequest = 0
    this.openRequest = 0
    this.unauthorizedSaid = false

    this.state = {
      reports: null,
      listError: null,
      tabs: [],
      tabWidths: {},
      shownId: null,
      opened: null,
      openError: null,
      saveState: null,
      notSaved: NO_IDS,
      actionError: null,
      notice: null,
      deletingId: null,
      tilePicker: null,
      newReportOpen: false,
    }
  }

  componentDidMount() {
    this.mounted = true
    window.addEventListener('pagehide', this.onPageHide)
    window.addEventListener('beforeunload', this.onBeforeUnload)
    window.addEventListener('keydown', this.onKeyDown)
    this.loadList()
  }

  componentDidUpdate(prevProps, prevState) {
    const { authentication, dataSourceId, shownReportId } = this.props
    if (!sameCredentials(authentication, prevProps.authentication) || dataSourceId !== prevProps.dataSourceId) {
      const sourceId = dataSourceOf(authentication, dataSourceId)
      this.credentials.set(sourceId, authentication)
      if (sourceId !== this.sourceId) {
        this.switchSource(sourceId)
      } else {
        this.credentialsRenewed(sourceId)
      }
    }

    // The host's address moved (its own Reports link, back and forward): follow it.
    if (shownReportId !== prevProps.shownReportId && shownReportId !== this.reported) {
      this.reported = shownReportId
      const reports = this.state.reports
      // Still loading: the list reads it when it's in.
      if (reports && shownReportId !== undefined) {
        if (shownReportId && reports.some((report) => report.id === shownReportId)) {
          this.openReport(shownReportId)
        } else {
          this.goHome()
        }
      }
    }

    // What's shown, back to the host once the list is in.
    if (this.state.reports !== null && this.state.shownId !== this.reported) {
      this.reported = this.state.shownId
      this.props.onShowReport?.(this.state.shownId)
    }

    // The open tabs and their widths, remembered for this data source.
    if (
      (prevState.tabs !== this.state.tabs || prevState.tabWidths !== this.state.tabWidths) &&
      this.tabsSource !== null &&
      this.tabsSource === this.sourceId
    ) {
      const prefix = this.storagePrefix()
      saveOpenTabs(prefix, this.sourceId, this.state.tabs)
      saveTabWidths(prefix, this.sourceId, widthsFor(this.state.tabWidths, this.state.tabs))
    }

    // A tiles picker opened for a report that's no longer the one shown (deleted in another tab, say) answers
    // "nothing".
    const picker = this.state.tilePicker
    if (picker && picker.reportId !== this.activeReport()?.id) {
      picker.resolve(null)
      this.setState({ tilePicker: null })
    }
  }

  componentWillUnmount() {
    this.mounted = false
    window.removeEventListener('pagehide', this.onPageHide)
    window.removeEventListener('beforeunload', this.onBeforeUnload)
    window.removeEventListener('keydown', this.onKeyDown)
    this.state.tilePicker?.resolve(null)
    // Off to another page: each save finishes, then its saver goes.
    this.savers.forEach((saver) => {
      saver.flush().finally(() => saver.dispose())
    })
  }

  // ---------------------------------------------------------------- for the host (through a ref)

  // Saves everything waiting, now: before signing out, say. `keepalive` when the page is going away, so the saves
  // outlive it. Resolves with whether each one reached the server.
  flushAll = (options) => Promise.all([...this.savers.values()].map((saver) => saver.flush(options)))

  // Whether any report has edits the server doesn't have yet.
  hasUnsavedChanges = () => [...this.savers.values()].some((saver) => saver.hasUnsaved)

  // Saves the report shown, now (the save control and ⌘S / Ctrl+S do this).
  saveNow = () => {
    const id = this.shownId
    if (id) {
      this.savers.get(id)?.flush()
    }
  }

  // Lists the reports again, from the home page.
  reload = () => this.resetList()

  // ---------------------------------------------------------------- the list

  storagePrefix = () =>
    this.props.storageKeyPrefix === undefined ? DEFAULT_STORAGE_PREFIX : this.props.storageKeyPrefix

  credentialsFor = (sourceId) => this.credentials.get(sourceId)

  // Another data source is another set of reports, and its own tabs. Edits to this one's still go to it.
  switchSource = (sourceId) => {
    this.flushAll()
    this.sourceId = sourceId
    this.resetList()
  }

  resetList = () => {
    this.tabsSource = null
    this.tabs = []
    this.setState({ reports: null, listError: null, notice: null, actionError: null, tabs: [], tabWidths: {} })
    this.select(null)
    this.loadList()
  }

  // The report the host's address names opens (as a tab) if it's in the list; otherwise the home page shows.
  loadList = () => {
    const sourceId = this.sourceId
    this.listRequest += 1
    const request = this.listRequest
    fetchReports({ authentication: this.credentialsFor(sourceId), pageSize: REPORTS_PAGE_SIZE }).then(
      ({ reports }) => {
        if (!this.mounted || request !== this.listRequest) {
          return
        }
        this.unauthorizedSaid = false
        const prefix = this.storagePrefix()
        const listed = new Set(reports.map((report) => report.id))
        const kept = loadOpenTabs(prefix, sourceId).filter((id) => listed.has(id))
        const requested = this.props.shownReportId
        const shown = requested && listed.has(requested) ? requested : null
        const tabs = shown ? withTabOpen(kept, shown) : kept
        this.tabsSource = sourceId
        this.tabs = tabs
        this.shownId = shown
        // The list and what's shown arrive together, so the host never hears of the home page on the way.
        this.setState({
          reports,
          listError: null,
          tabs,
          tabWidths: widthsFor(loadTabWidths(prefix, sourceId), tabs),
          shownId: shown,
        })
        this.loadShown()
      },
      (error) => {
        if (!this.mounted || request !== this.listRequest) {
          return
        }
        this.unauthorized(error)
        this.setState({ reports: [], listError: describeReportError(error, 'load').message })
      },
    )
  }

  // New credentials for the data source shown: what failed because the old ones were turned away goes again.
  credentialsRenewed = (sourceId) => {
    this.savers.forEach((saver, id) => {
      if (this.saverSources.get(id) === sourceId) {
        saver.retry()
      }
    })
    if (this.state.listError) {
      this.resetList()
    } else if (this.state.openError) {
      this.loadShown()
    }
  }

  // AutoQL turned the token away: the host is asked for a new one, once until something works again — a new
  // token that's turned away too isn't asked about in a loop.
  askForCredentials = () => {
    if (this.unauthorizedSaid) {
      return
    }
    this.unauthorizedSaid = true
    this.props.onUnauthorized?.()
  }

  unauthorized = (error) => {
    if (isUnauthorized(error)) {
      this.askForCredentials()
    }
  }

  // ---------------------------------------------------------------- saving

  makeSaver = (id, sourceId, report, stored) => {
    this.savers.get(id)?.dispose()
    const saver = new ReportSaver({
      id,
      stored,
      report,
      delayMs: this.props.saveDelay,
      getAuthentication: () => this.credentialsFor(sourceId),
      onState: (state) => this.onSaverState(id, state),
      onMerged: (merged) => {
        if (this.mounted && this.shownId === id) {
          this.setState({ opened: { id, report: merged } })
        }
      },
      onUnauthorized: this.askForCredentials,
    })
    this.savers.set(id, saver)
    this.saverSources.set(id, sourceId)
    // A saver only reports changes: where it starts (saved, after a reload say) clears what the last one left.
    this.onSaverState(id, saver.current)
    return saver
  }

  // The shown report's save control follows its saver; a report whose last save failed or was refused gets a dot
  // on its tab.
  onSaverState = (id, saverState) => {
    if (!this.mounted) {
      return
    }
    if (saverState.status === 'saved') {
      this.unauthorizedSaid = false
    }
    const failing = saverState.status === 'failed' || saverState.status === 'conflict'
    this.setState(({ notSaved }) => {
      const patch = {}
      if (this.shownId === id) {
        patch.saveState = saverState
      }
      if (notSaved.has(id) !== failing) {
        patch.notSaved = failing ? new Set(notSaved).add(id) : without(notSaved, id)
      }
      return Object.keys(patch).length ? patch : null
    })
  }

  // Leaving the page (closing the tab, reloading, navigating away) saves at once, as keepalive requests so they
  // outlive the page.
  onPageHide = () => {
    this.flushAll({ keepalive: true })
  }

  // A save still waiting or on its way: start it, and let the browser ask before the page closes.
  onBeforeUnload = (e) => {
    const unsaved = [...this.savers.values()].filter((saver) => saver.hasUnsaved)
    if (!unsaved.length) {
      return
    }
    unsaved.forEach((saver) => saver.flush({ keepalive: true }))
    e.preventDefault()
    e.returnValue = ''
  }

  // ⌘S / Ctrl+S saves the report rather than opening the browser's "Save page".
  onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && String(e.key).toLowerCase() === 's') {
      e.preventDefault()
      this.saveNow()
    }
  }

  // ---------------------------------------------------------------- tabs and what's shown

  setTabs = (change) => {
    const tabs = change(this.tabs)
    if (tabs === this.tabs) {
      return
    }
    this.tabs = tabs
    // A closed or deleted report's tab takes its width with it.
    this.setState(({ tabWidths }) => ({ tabs, tabWidths: widthsFor(tabWidths, tabs) }))
  }

  select = (id) => {
    this.shownId = id
    this.setState({ shownId: id })
    this.loadShown()
  }

  // The report shown: what hasn't reached the server yet if there's something, otherwise the stored copy.
  loadShown = () => {
    const id = this.shownId
    this.openRequest += 1
    const request = this.openRequest
    const cleared = { openError: null, actionError: null }
    if (!id) {
      this.setState({ ...cleared, opened: null, saveState: null })
      return
    }
    const saver = this.savers.get(id)
    if (saver?.hasUnsaved) {
      this.setState({ ...cleared, opened: { id, report: saver.report }, saveState: saver.current })
      return
    }
    this.setState({ ...cleared, opened: null, saveState: null })
    const sourceId = this.sourceId
    fetchReport({ authentication: this.credentialsFor(sourceId), id }).then(
      (detail) => {
        if (!this.mounted || request !== this.openRequest) {
          return
        }
        this.unauthorizedSaid = false
        const stored = { report: detail.report, version: detail.version, updatedAt: detail.updatedAt }
        const fresh = this.makeSaver(id, sourceId, detail.report, stored)
        this.setState(({ reports }) => ({
          opened: { id, report: detail.report },
          saveState: fresh.current,
          reports: reports
            ? reports.map((report) => (report.id === id ? { ...report, title: detail.title } : report))
            : reports,
        }))
      },
      (error) => {
        if (!this.mounted || request !== this.openRequest) {
          return
        }
        if (isReportGone(error)) {
          // Deleted in another tab or window: drop it and its tab, and say so on the home page.
          const title = titleOf(this.state.reports?.find((report) => report.id === id))
          this.forget(id)
          this.setState({ notice: S.workspace.deletedElsewhere(title) })
          this.select(null)
          return
        }
        this.unauthorized(error)
        this.setState({ openError: describeReportError(error, 'open').message })
      },
    )
  }

  // A report shown in its tab (opened as one if it isn't); what was shown is saved at once.
  openReport = (id) => {
    this.setTabs((tabs) => withTabOpen(tabs, id))
    if (this.shownId === id) {
      return
    }
    this.saveNow()
    this.setState({ notice: null })
    this.select(id)
  }

  goHome = () => {
    if (this.shownId === null) {
      return
    }
    this.saveNow()
    this.select(null)
  }

  // Closing a tab saves what's waiting in it; the report stays in the list.
  closeTab = (id) => {
    this.savers.get(id)?.flush()
    const { tabs, shown } = withTabClosed(this.tabs, id, this.shownId)
    this.setTabs(() => tabs)
    if (shown !== this.shownId) {
      this.select(shown)
    }
  }

  resizeTab = (id, width) => {
    this.setState(({ tabWidths }) => (tabWidths[id] === width ? null : { tabWidths: { ...tabWidths, [id]: width } }))
  }

  // A report no longer there: its saver, tab and list entry go.
  forget = (id) => {
    this.savers.get(id)?.dispose()
    this.savers.delete(id)
    this.saverSources.delete(id)
    this.setTabs((tabs) => (tabs.includes(id) ? tabs.filter((tab) => tab !== id) : tabs))
    this.setState(({ reports, notSaved }) => ({
      reports: reports ? reports.filter((report) => report.id !== id) : reports,
      notSaved: notSaved.has(id) ? without(notSaved, id) : notSaved,
    }))
  }

  activeReport = () => {
    const { opened, shownId } = this.state
    return opened && opened.id === shownId ? opened : null
  }

  // ---------------------------------------------------------------- changing reports

  handleChange = (next) => {
    const id = this.shownId
    if (!id) {
      return
    }
    const title = typeof next?.title === 'string' ? next.title : ''
    this.setState(({ opened, reports }) => ({
      opened: opened?.id === id ? { id, report: next } : opened,
      reports: reports ? reports.map((report) => (report.id === id ? { ...report, title } : report)) : reports,
    }))
    // Saved by a newer version of the builder: shown, but never saved over.
    if (!isNewerSchema(next)) {
      this.savers.get(id)?.edit(next)
    }
  }

  // A new report, started as New report chose: its title and first blocks, or blank. It opens in a tab, and is
  // created on the server right away (it opens from its saver meanwhile).
  startReport = ({ title = '', blocks = [] } = {}) => {
    if (this.state.reports === null) {
      return
    }
    this.saveNow()
    const id = newReportId()
    const report = createEmptyReport({ title, blocks: stripQueryResponses(blocks) })
    const saver = this.makeSaver(id, this.sourceId, report, null)
    const now = new Date().toISOString()
    const summary = { id, title, sizeBytes: 0, version: 0, folderId: null, tagIds: [], createdAt: now, updatedAt: now }
    this.setState(({ reports }) => ({ newReportOpen: false, notice: null, reports: [summary, ...(reports || [])] }))
    saver.flush()
    this.setTabs((tabs) => withTabOpen(tabs, id))
    this.select(id)
  }

  // From the home page (the host asks first). Its tab closes too. Resolves with whether it was deleted.
  deleteReport = async (id) => {
    this.setState({ deletingId: id, actionError: null, notice: null })
    const saver = this.savers.get(id)
    try {
      // Anything still waiting to be saved is for the report being deleted.
      await saver?.settle()
      if (!saver || saver.created) {
        const sourceId = this.saverSources.get(id) ?? this.sourceId
        await deleteStoredReport({ authentication: this.credentialsFor(sourceId), id })
      }
      if (!this.mounted) {
        return true
      }
      this.forget(id)
      if (this.shownId === id) {
        this.select(null)
      }
      return true
    } catch (error) {
      if (this.mounted) {
        this.unauthorized(error)
        this.setState({ actionError: describeReportError(error, 'delete').message })
      }
      saver?.flush()
      return false
    } finally {
      if (this.mounted) {
        this.setState({ deletingId: null })
      }
    }
  }

  // Changed in another tab too: drop what's here and open the stored copy.
  reloadShown = () => {
    const id = this.shownId
    if (!id) {
      return
    }
    this.savers.get(id)?.dispose()
    this.savers.delete(id)
    this.saverSources.delete(id)
    this.setState({ notice: null })
    this.loadShown()
  }

  // An empty Data block's "Pick dashboard tiles…": the picker's answer (the blocks, or null) goes back to the
  // builder, which puts them in that block's place.
  pickDashboardTiles = () =>
    new Promise((resolve) => {
      const reportId = this.shownId
      if (!reportId) {
        resolve(null)
        return
      }
      this.state.tilePicker?.resolve(null)
      this.setState({ tilePicker: { reportId, resolve } })
    })

  closeTilePicker = (blocks) => {
    this.state.tilePicker?.resolve(blocks)
    this.setState({ tilePicker: null })
  }

  openNewReport = () => this.setState({ newReportOpen: true })

  closeNewReport = () => this.setState({ newReportOpen: false })

  retryOpen = () => this.loadShown()

  // ---------------------------------------------------------------- drawing

  renderHome = () => {
    const { reports, listError, deletingId, actionError, notice } = this.state
    const home = {
      reports,
      listError,
      retryList: this.resetList,
      openReport: this.openReport,
      deleteReport: this.deleteReport,
      deletingId,
      notices: [
        ...(actionError ? [{ tone: 'error', text: actionError }] : []),
        ...(notice ? [{ tone: 'info', text: notice }] : []),
      ],
      newReport: this.openNewReport,
    }
    return this.props.renderHome ? this.props.renderHome(home) : <PlainHome {...home} />
  }

  renderEditor = () => {
    const { authentication, autoQLConfig, dataFormatting, dashboards, dashboardsError } = this.props
    const { openError, saveState } = this.state
    const active = this.activeReport()
    const readOnly = !!active && isNewerSchema(active.report)
    const notice =
      (active ? saveState?.error : null) ||
      (readOnly ? S.workspace.readOnly : null) ||
      (dashboardsError ? S.workspace.dashboardsFailed(dashboardsError) : null)

    let body
    if (active) {
      body = (
        <ReportBuilder
          // A fresh builder — and run state — per report and data source.
          key={`${this.sourceId}:${active.id}`}
          authentication={authentication}
          autoQLConfig={autoQLConfig}
          dataFormatting={dataFormatting}
          dashboards={dashboards || NO_DASHBOARDS}
          report={active.report}
          onChange={this.handleChange}
          branding={this.props.branding}
          enableBranding={this.props.enableBranding}
          canEditBranding={this.props.canEditBranding}
          enableDataBlocks={this.props.enableDataBlocks}
          pickDashboardTiles={dashboards === undefined ? undefined : this.pickDashboardTiles}
          enableAnalysis={this.props.enableAnalysis}
          enableRunReport={this.props.enableRunReport}
          fontStylesheetUrl={this.props.fontStylesheetUrl}
          getAuthenticationForProject={this.props.getAuthenticationForProject}
          onRunComplete={this.props.onRunComplete}
          onErrorCallback={this.props.onErrorCallback}
          toolbarStatus={
            !readOnly && saveState ? (
              <SaveStatus
                state={saveState.status}
                savedAt={saveState.savedAt}
                onSave={this.saveNow}
                onReload={this.reloadShown}
              />
            ) : undefined
          }
        />
      )
    } else if (openError) {
      body = (
        <div className={`${RS}-message`} data-tone='error'>
          <Icon name='alert' size={20} />
          <p role='alert'>{openError}</p>
          <button type='button' className={`${RS}-button`} onClick={this.retryOpen}>
            {S.tryAgain}
          </button>
        </div>
      )
    } else {
      body = (
        <div className={`${RS}-message`}>
          <span className={`${RS}-spin`}>
            <Icon name='spinner' size={20} />
          </span>
          <p>{S.workspace.opening}</p>
        </div>
      )
    }

    return (
      <div className={`${RS}-editor`}>
        {notice ? (
          <p className={`${RS}-editor-notice`} role='status' data-test='reports-editor-notice'>
            <Icon name='alert' size={14} />
            {notice}
          </p>
        ) : null}
        <div className={`${RS}-editor-body`}>{body}</div>
      </div>
    )
  }

  render() {
    const { authentication, autoQLConfig, dataFormatting, dashboards, onDashboardTilesChange, className } = this.props
    const { reports, tabs, tabWidths, shownId, notSaved, tilePicker, newReportOpen } = this.state
    const active = this.activeReport()
    const titleFor = (id) => titleOf(reports?.find((report) => report.id === id))

    return (
      <div className={`${RS}${className ? ` ${className}` : ''}`} data-test='reports'>
        <ReportTabs
          tabs={tabs.map((id) => ({ id, title: titleFor(id), notSaved: notSaved.has(id) }))}
          shownId={shownId}
          onHome={this.goHome}
          onSelect={this.openReport}
          onClose={this.closeTab}
          onNew={this.openNewReport}
          newDisabled={reports === null}
          widths={tabWidths}
          onResize={this.resizeTab}
        />

        {shownId === null ? <div className={`${RS}-home`}>{this.renderHome()}</div> : this.renderEditor()}

        {newReportOpen ? (
          <NewReportDialog
            authentication={authentication}
            autoQLConfig={autoQLConfig}
            dataFormatting={dataFormatting}
            dashboards={dashboards}
            onClose={this.closeNewReport}
            onStart={this.startReport}
            onTilesChange={onDashboardTilesChange}
          />
        ) : null}

        {tilePicker && active && tilePicker.reportId === active.id ? (
          <DashboardTilesDialog
            authentication={authentication}
            autoQLConfig={autoQLConfig}
            dataFormatting={dataFormatting}
            dashboards={dashboards ?? null}
            report={active.report}
            mode='add'
            onClose={() => this.closeTilePicker(null)}
            onAdd={(blocks) => this.closeTilePicker(blocks)}
            onTilesChange={onDashboardTilesChange}
          />
        ) : null}
      </div>
    )
  }
}

export const Reports = withTheme(ReportsWithoutTheme)
