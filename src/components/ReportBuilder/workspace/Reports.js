import React from 'react'
import PropTypes from 'prop-types'
import { autoQLConfigDefault, dataFormattingDefault, parseJwt } from 'autoql-fe-utils'
import { withTheme } from '../../../theme'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'
import { ReportBuilder } from '../ReportBuilder'
import { createEmptyReport, isNewerSchema } from '../model/reportSchema'
import { Icon } from '../components/icons'
import { isCapture } from '../model/blockView'
import { updateBlock } from '../model/reportOperations'
import { captureQuestion } from '../run/captureRun'
import { RERUN_ALL_CONCURRENCY } from '../constants'
import {
  createReportFolder,
  createReportFromTemplate,
  createReportTag,
  deleteReport as deleteStoredReport,
  deleteReportFolder,
  deleteReportTag,
  fetchReport,
  fetchReportDataStatus,
  fetchReportFolders,
  fetchReports,
  fetchReportTags,
  isFillingData,
  organizeReports as organizeStoredReports,
  renameReportFolder,
  ReportsApiError,
  updateReportTag,
} from '../run/reportsApi'
import {
  DEFAULT_STORAGE_PREFIX,
  FILL_POLL_MAX_MS,
  FILL_POLL_MS,
  FILL_STALL_MS,
  REPORTS_PAGE_SIZE,
  RS,
  SAVE_DELAY_MS,
} from './reportsConstants'
import { REPORTS_STRINGS } from './reportsStrings'
import {
  describeReportError,
  isReportGone,
  isUnauthorized,
  newReportId,
  stripQueryResponses,
  titleOf,
  withBlocksAdded,
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
// With enableTemplates, New report can start from a template: the report is made from it, and AutoQL fills in its
// data blocks in the background — or, where AutoQL doesn't fill reports in itself, this page asks their questions.
// Meanwhile the report shows as it prints, read-only, filling in as each block is answered; then it says how many
// blocks were filled, and each one that wasn't says why.
//
// Edits are saved after a short pause, and at once when switching tabs, leaving or hiding the page, pressing the
// save control or ⌘S / Ctrl+S (ReportSaver, one per report opened here). A save that failed is kept and tried again
// (its tab keeps a dot meanwhile), and the browser asks before the page closes with one. Which reports are open is
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

// The service sends a page of reports at a time; any more than this many pages isn't asked for.
const MAX_LIST_PAGES = 25

// Every one of the user's reports on the data source, a page at a time: most recently saved first. A report saved
// meanwhile moves up the list, so one that turns up on two pages is kept once. Only the first page failing fails the
// list. A later page that fails leaves its reports out, and `missing` is why: the list is known to be incomplete.
const listReports = async (authentication) => {
  const first = await fetchReports({ authentication, pageSize: REPORTS_PAGE_SIZE })
  const more = []
  for (let page = 2; page <= Math.min(first.totalPages || 1, MAX_LIST_PAGES); page += 1) {
    more.push(fetchReports({ authentication, page, pageSize: REPORTS_PAGE_SIZE }).catch((error) => ({ error })))
  }
  const pages = [first, ...(await Promise.all(more))]
  const seen = new Set()
  return {
    reports: pages
      .flatMap((page) => page.reports || [])
      .filter((report) => !seen.has(report.id) && seen.add(report.id)),
    missing: pages.find((page) => page.error)?.error || null,
  }
}

// A report as the list has it, from a report read with its document.
const summaryOf = ({
  id,
  title,
  sizeBytes,
  version,
  folderId,
  tagIds,
  templateId,
  dataStatus,
  createdAt,
  updatedAt,
}) => ({
  id,
  title,
  sizeBytes,
  version,
  folderId,
  tagIds,
  templateId,
  dataStatus,
  createdAt,
  updatedAt,
})

// The list once a report is opened: with its title and data status as stored, or with the report added if the list
// didn't have it (it was on a page that failed to list), so its tab has its title.
const withOpened = (reports, detail) =>
  reports.some((report) => report.id === detail.id)
    ? reports.map((report) =>
        report.id === detail.id ? { ...report, title: detail.title, dataStatus: detail.dataStatus } : report,
      )
    : [...reports, summaryOf(detail)]

// The browser's time zone, which AutoQL asks a template's questions in.
const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch (error) {
    return undefined
  }
}

// How far filling in a report's data has got: its data blocks with an answer (`done`), of all of them (`total`).
const fillProgress = (report) => {
  const blocks = (Array.isArray(report?.blocks) ? report.blocks : []).filter((block) => block?.type === 'data')
  return { done: blocks.filter((block) => isCapture(block.capture)).length, total: blocks.length }
}

// The blocks of a report made from a template that a fill asks again: every Data block with a question.
const questionBlocks = (report) =>
  (Array.isArray(report?.blocks) ? report.blocks : []).filter(
    (block) => block?.type === 'data' && block.source?.type === 'query' && block.source.query,
  )

// Why a question asked from here didn't fill its block, as the report service says it of its own fills.
const fillErrorOf = (blockId, result) => {
  const referenceId = result.error?.referenceId
  let reason = 'query_failed'
  if (result.reason === 'no-data') {
    reason = 'no_data'
  } else if (referenceId === '1.1.430' || referenceId === '1.1.431') {
    reason = 'not_confident'
  } else if (referenceId === '1.1.522') {
    reason = 'access_denied'
  }
  return {
    blockId,
    reason,
    ...(reason === 'query_failed' && result.error?.message ? { message: result.error.message } : {}),
  }
}

// What's said over a report AutoQL fills in: how far it's got, and how it went once it's done (or stopped). Said once
// a fill followed here ends, not each time the report is opened after. How it went is counted on the report as it is
// now, so blocks rerun (or removed) since count too.
const fillNoticeOf = (fill, filling, report) => {
  const { done, total } = fillProgress(report)
  if (filling) {
    return { tone: 'info', text: S.workspace.filling(done, total) }
  }
  if (fill.stalled) {
    return { tone: 'warning', text: S.workspace.fillStalled }
  }
  if (!fill.ended) {
    return null
  }
  if (done >= total) {
    return { tone: 'info', text: S.workspace.filled(total) }
  }
  if (!done) {
    return { tone: 'warning', text: S.workspace.notFilled(total) }
  }
  return { tone: 'warning', text: S.workspace.partlyFilled(done, total) }
}

// Whether an ISO time is after another (one that can't be read is before anything).
const isLater = (iso, than) => {
  const time = Date.parse(iso)
  return !Number.isNaN(time) && time > (Date.parse(than) || 0)
}

// Folders and tags as the home page lists them: A to Z, whatever case they're in.
const byName = (list) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))

// The folder or tag with this name, whatever its case: making one twice finds the first.
const named = (list, name) => (list || []).find((item) => item.name.toLowerCase() === name.toLowerCase()) || null

const withoutCreated = ({ created, ...stored }) => stored

// A failed change to folders, tags or where reports are filed, as one line the host can show: its message says
// what happened, and `code` and `status` are the service's.
const failure = (error, action) => {
  const failed = new Error(describeReportError(error, action).message)
  failed.code = error?.code
  failed.status = error?.status
  return failed
}

const nameOf = (name) => (typeof name === 'string' ? name.trim() : '')
const NAME_MAX = 80

// A name the service would turn down (empty, or over 80 characters once trimmed), refused before asking it.
const BAD_NAME = () => new ReportsApiError({ status: 422, code: 'REPORT_NAME_INVALID' })
const isBadName = (name) => !name || Array.from(name).length > NAME_MAX

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
    // The folder New report makes reports in: the one the host's home page shows, say. None by default.
    newReportFolderId: PropTypes.string,
    // New report can start from a template published for the data source, which AutoQL fills in with the user's
    // data. Off by default.
    enableTemplates: PropTypes.bool,
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
    newReportFolderId: null,
    enableTemplates: false,
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
    this.organizersRequest = 0
    this.openRequest = 0
    this.unauthorizedSaid = false
    // Blocks a save merged in from another tab ({ id, blocks }), until the builder has been handed them.
    this.unshownMerge = null
    // Where each report opened here is with the data AutoQL fills in, as last heard: id → { dataStatus, dataErrors }.
    // The fill of the report shown is followed (`fillFollow`) until it ends.
    this.fillInfo = new Map()
    this.fillFollow = null
    // Reports made from a template filled in from here, while AutoQL can't fill them itself: id → the fill under way.
    this.localFills = new Map()
    this.root = React.createRef()

    this.state = {
      reports: null,
      listError: null,
      // Why some of the list couldn't be loaded, when a later page failed: the list is incomplete.
      listMissing: null,
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
      // The user's folders and tags on the data source, A to Z; null while they load.
      folders: null,
      tags: null,
      organizersError: null,
      // The shown report's data, as AutoQL fills it in: { id, dataStatus, dataErrors }, with `ended` once a fill
      // followed here finished, or `stalled` when it stopped without word.
      fill: null,
    }
  }

  componentDidMount() {
    this.mounted = true
    window.addEventListener('pagehide', this.onPageHide)
    window.addEventListener('beforeunload', this.onBeforeUnload)
    window.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    this.loadList()
    this.loadOrganizers()
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
      // Still loading: the list reads it when it's in. With some of the list missing, a report not in it may be on a
      // page that failed: opening it finds out.
      if (reports && shownReportId !== undefined) {
        if (shownReportId && (this.state.listMissing || reports.some((report) => report.id === shownReportId))) {
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

    // The builder now has the blocks merged in (or shows another report): what it emits from here on is built on
    // them, or took them out.
    const merge = this.unshownMerge
    if (merge) {
      const active = this.activeReport()
      const blocks = active?.id === merge.id && Array.isArray(active.report?.blocks) ? active.report.blocks : null
      if (!blocks || merge.blocks.every((block) => blocks.some((shown) => shown?.id === block?.id))) {
        this.unshownMerge = null
      }
    }
  }

  componentWillUnmount() {
    this.mounted = false
    window.removeEventListener('pagehide', this.onPageHide)
    window.removeEventListener('beforeunload', this.onBeforeUnload)
    window.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.state.tilePicker?.resolve(null)
    this.stopFollowingFill()
    this.localFills.forEach((fill) => fill.controllers.forEach((controller) => controller.abort()))
    this.localFills.clear()
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
    this.setState({
      reports: null,
      listError: null,
      listMissing: null,
      notice: null,
      actionError: null,
      tabs: [],
      tabWidths: {},
      folders: null,
      tags: null,
      organizersError: null,
    })
    this.select(null)
    this.loadList()
    this.loadOrganizers()
  }

  // The report the host's address names opens (as a tab) if it's in the list; otherwise the home page shows. With
  // some of the list missing, the remembered tabs and the address keep reports it doesn't have, as they may be on a
  // page that failed: opening one finds out (loadShown drops one that's gone), and the home page says the list is
  // incomplete.
  loadList = () => {
    const sourceId = this.sourceId
    this.listRequest += 1
    const request = this.listRequest
    listReports(this.credentialsFor(sourceId)).then(
      ({ reports, missing }) => {
        if (!this.mounted || request !== this.listRequest) {
          return
        }
        this.unauthorizedSaid = false
        if (missing) {
          this.unauthorized(missing)
        }
        const prefix = this.storagePrefix()
        const listed = new Set(reports.map((report) => report.id))
        const mayHave = (id) => !!missing || listed.has(id)
        const kept = loadOpenTabs(prefix, sourceId).filter(mayHave)
        const requested = this.props.shownReportId
        const shown = requested && mayHave(requested) ? requested : null
        const tabs = shown ? withTabOpen(kept, shown) : kept
        this.tabsSource = sourceId
        this.tabs = tabs
        this.shownId = shown
        // The list and what's shown arrive together, so the host never hears of the home page on the way.
        this.setState({
          reports,
          listError: null,
          listMissing: missing ? describeReportError(missing, 'loadSome').message : null,
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

  // ---------------------------------------------------------------- folders and tags

  // The user's folders and tags on this data source, beside the list.
  loadOrganizers = () => {
    const sourceId = this.sourceId
    const authentication = this.credentialsFor(sourceId)
    this.organizersRequest += 1
    const request = this.organizersRequest
    const current = () => this.mounted && request === this.organizersRequest
    this.setState({ organizersError: null })
    Promise.all([fetchReportFolders({ authentication }), fetchReportTags({ authentication })]).then(
      ([folders, tags]) => {
        if (current()) {
          this.setState({ folders: byName(folders), tags: byName(tags), organizersError: null })
        }
      },
      (error) => {
        if (current()) {
          this.unauthorized(error)
          this.setState({ folders: [], tags: [], organizersError: describeReportError(error, 'organizers').message })
        }
      },
    )
  }

  // A change to folders or tags lands only on the data source it was made on.
  stillOn = (sourceId) => this.mounted && sourceId === this.sourceId

  // Where each report now is, as organizing answered or a deleted folder or tag left it.
  placeReports = (place) =>
    this.setState(({ reports }) => (reports ? { reports: reports.map((report) => place(report) || report) } : null))

  // A new folder, or the one with that name already (making one twice finds it). Resolves with the folder.
  createFolder = async (name) => this.makeOrganizer('folder', name)

  // A new tag in a colour the host picked, or the one with that name already. Resolves with the tag.
  createTag = async (name, color) => this.makeOrganizer('tag', name, color)

  makeOrganizer = async (kind, rawName, color) => {
    const list = kind === 'folder' ? 'folders' : 'tags'
    const name = nameOf(rawName)
    if (isBadName(name)) {
      throw failure(BAD_NAME(), kind)
    }
    const existing = named(this.state[list], name)
    if (existing) {
      return existing
    }
    const sourceId = this.sourceId
    const authentication = this.credentialsFor(sourceId)
    const add = (item) => {
      if (this.stillOn(sourceId)) {
        this.setState((state) => ({ [list]: byName([...(state[list] || []).filter((i) => i.id !== item.id), item]) }))
      }
      return item
    }
    try {
      const made =
        kind === 'folder'
          ? await createReportFolder({ authentication, id: newReportId(), name })
          : await createReportTag({ authentication, id: newReportId(), name, color })
      return add(withoutCreated(made))
    } catch (error) {
      // Made meanwhile somewhere else: that one's it.
      const taken = kind === 'folder' ? 'REPORT_FOLDER_NAME_TAKEN' : 'REPORT_TAG_NAME_TAKEN'
      if (error?.code === taken && error.details?.id) {
        const all = await (kind === 'folder' ? fetchReportFolders : fetchReportTags)({ authentication }).catch(() => [])
        const holder = all.find((item) => item.id === error.details.id)
        if (holder) {
          return add(holder)
        }
      }
      this.unauthorized(error)
      throw failure(error, kind)
    }
  }

  renameFolder = async (id, rawName) => {
    const name = nameOf(rawName)
    if (isBadName(name)) {
      throw failure(BAD_NAME(), 'folder')
    }
    const sourceId = this.sourceId
    try {
      const folder = await renameReportFolder({ authentication: this.credentialsFor(sourceId), id, name })
      if (this.stillOn(sourceId)) {
        this.setState(({ folders }) => ({ folders: byName((folders || []).map((f) => (f.id === id ? folder : f))) }))
      }
      return folder
    } catch (error) {
      this.unauthorized(error)
      throw failure(error, 'folder')
    }
  }

  // Renames a tag, recolours it, or both: { name, color }.
  updateTag = async (id, { name: rawName, color } = {}) => {
    const name = rawName === undefined ? undefined : nameOf(rawName)
    if (name !== undefined && isBadName(name)) {
      throw failure(BAD_NAME(), 'tag')
    }
    const sourceId = this.sourceId
    try {
      const tag = await updateReportTag({ authentication: this.credentialsFor(sourceId), id, name, color })
      if (this.stillOn(sourceId)) {
        this.setState(({ tags }) => ({ tags: byName((tags || []).map((t) => (t.id === id ? tag : t))) }))
      }
      return tag
    } catch (error) {
      this.unauthorized(error)
      throw failure(error, 'tag')
    }
  }

  // Deletes a folder: its reports become unfiled; none is deleted. One already gone counts as deleted.
  deleteFolder = async (id) => {
    const sourceId = this.sourceId
    try {
      await deleteReportFolder({ authentication: this.credentialsFor(sourceId), id })
    } catch (error) {
      if (error?.code !== 'REPORT_FOLDER_NOT_FOUND') {
        this.unauthorized(error)
        throw failure(error, 'deleteFolder')
      }
    }
    if (this.stillOn(sourceId)) {
      this.setState(({ folders }) => ({ folders: (folders || []).filter((f) => f.id !== id) }))
      this.placeReports((report) => (report.folderId === id ? { ...report, folderId: null } : null))
    }
  }

  // Deletes a tag, taking it off every report that had it; none is deleted. One already gone counts as deleted.
  deleteTag = async (id) => {
    const sourceId = this.sourceId
    try {
      await deleteReportTag({ authentication: this.credentialsFor(sourceId), id })
    } catch (error) {
      if (error?.code !== 'REPORT_TAG_NOT_FOUND') {
        this.unauthorized(error)
        throw failure(error, 'deleteTag')
      }
    }
    if (this.stillOn(sourceId)) {
      this.setState(({ tags }) => ({ tags: (tags || []).filter((t) => t.id !== id) }))
      this.placeReports((report) =>
        report.tagIds?.includes(id) ? { ...report, tagIds: report.tagIds.filter((t) => t !== id) } : null,
      )
    }
  }

  // Files reports in a folder (null: no folder; left out: as they are), and adds or takes off tags, all at once or
  // not at all: { reportIds, folderId, addTagIds, removeTagIds }. Resolves with where each report now is.
  organizeReports = async ({ reportIds, folderId, addTagIds, removeTagIds }) => {
    const sourceId = this.sourceId
    try {
      const placements = await organizeStoredReports({
        authentication: this.credentialsFor(sourceId),
        reportIds,
        folderId,
        addTagIds,
        removeTagIds,
      })
      if (this.stillOn(sourceId)) {
        const placed = new Map(placements.map((p) => [p.id, p]))
        this.placeReports((report) => {
          const p = placed.get(report.id)
          return p ? { ...report, folderId: p.folderId, tagIds: p.tagIds } : null
        })
      }
      return placements
    } catch (error) {
      this.unauthorized(error)
      throw failure(error, 'organize')
    }
  }

  // New credentials for the data source shown: what failed because the old ones were turned away goes again.
  credentialsRenewed = (sourceId) => {
    this.savers.forEach((saver, id) => {
      if (this.saverSources.get(id) === sourceId) {
        saver.retry()
      }
    })
    if (this.state.listError || this.state.listMissing) {
      this.resetList()
      return
    }
    if (this.state.openError) {
      this.loadShown()
    }
    if (this.state.organizersError) {
      this.loadOrganizers()
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

  makeSaver = (id, sourceId, report, stored, folderId = null) => {
    this.savers.get(id)?.dispose()
    const saver = new ReportSaver({
      id,
      folderId,
      stored,
      report,
      delayMs: this.props.saveDelay,
      getAuthentication: () => this.credentialsFor(sourceId),
      onState: (state) => this.onSaverState(id, state),
      onMerged: (merged, added) => {
        if (this.mounted && this.shownId === id) {
          // The builder is handed them when this renders; an edit it makes before then is built without them.
          const earlier = this.unshownMerge?.id === id ? this.unshownMerge.blocks : []
          this.unshownMerge = { id, blocks: [...earlier, ...added] }
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
  // on its tab; and the home page's list has when each report was last stored, as each save comes back.
  onSaverState = (id, saverState) => {
    if (!this.mounted) {
      return
    }
    if (saverState.status === 'saved') {
      this.unauthorizedSaid = false
    }
    const failing = saverState.status === 'failed' || saverState.status === 'conflict'
    const { savedAt } = saverState
    this.setState(({ notSaved, reports }) => {
      const patch = {}
      if (this.shownId === id) {
        patch.saveState = saverState
      }
      if (notSaved.has(id) !== failing) {
        patch.notSaved = failing ? new Set(notSaved).add(id) : without(notSaved, id)
      }
      const listed = savedAt && reports ? reports.find((report) => report.id === id) : null
      if (listed && isLater(savedAt, listed.updatedAt)) {
        patch.reports = reports.map((report) => (report.id === id ? { ...report, updatedAt: savedAt } : report))
      }
      return Object.keys(patch).length ? patch : null
    })
  }

  // Leaving the page (closing the tab, reloading, navigating away) saves at once, as keepalive requests so they
  // outlive the page, without waiting for saves on their way.
  onPageHide = () => {
    this.savers.forEach((saver) => saver.leave())
  }

  // The page was hidden (another tab, the window minimised, another app on a phone): saves at once, while the page
  // is still here to see them through — a phone may close it later without a word.
  onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.flushAll()
    }
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

  // ⌘S / Ctrl+S saves the report shown rather than opening the browser's "Save page", while the focus is in the
  // workspace (its dialogs included) or nowhere in particular. With no report shown, or the focus in the host's own
  // page, it's left to the host and the browser.
  onKeyDown = (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || String(e.key).toLowerCase() !== 's') {
      return
    }
    if (e.defaultPrevented || !this.shownId) {
      return
    }
    const target = e.target
    const here =
      target === window ||
      target === document.body ||
      target === document.documentElement ||
      !!this.root.current?.contains(target) ||
      !!target?.closest?.(`.${RS}-layer`)
    if (here) {
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

  select = (id, opening) => {
    this.shownId = id
    this.stopFollowingFill()
    const info = id ? this.fillInfo.get(id) : null
    this.setState({ shownId: id, fill: info ? { id, ...info } : null })
    this.loadShown(opening)
  }

  // The report shown: what hasn't reached the server yet if there's something, otherwise the stored copy — or the one
  // just made, as it came back (`opening`: { detail, sourceId }), which needn't be read again.
  loadShown = (opening) => {
    const id = this.shownId
    this.openRequest += 1
    const request = this.openRequest
    const cleared = { openError: null, actionError: null }
    if (!id) {
      this.setState({ ...cleared, opened: null, saveState: null })
      return
    }
    if (opening?.detail?.id === id) {
      this.setState(cleared)
      this.showStored(id, opening.sourceId, opening.detail)
      return
    }
    const saver = this.savers.get(id)
    // What's waiting to be saved, or being filled in from here, is newer than the stored copy.
    if (saver && (saver.hasUnsaved || this.localFills.has(id))) {
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
        this.showStored(id, sourceId, detail)
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

  // A report as stored, shown, with a saver at its version; while AutoQL fills in its data, that's followed (unless
  // `follow` is false, for a fill already followed).
  showStored = (id, sourceId, detail, { follow = true } = {}) => {
    const stored = { report: detail.report, version: detail.version, updatedAt: detail.updatedAt }
    const fresh = this.makeSaver(id, sourceId, detail.report, stored)
    this.setState(({ reports }) => ({
      opened: { id, report: detail.report },
      saveState: fresh.current,
      reports: reports && withOpened(reports, detail),
    }))
    if (follow) {
      this.followFill(id, sourceId, detail)
    }
  }

  // ---------------------------------------------------------------- the data AutoQL fills in

  // Where a report is with its data, as the service said, kept for when it's shown again. The shown report's fill is
  // followed while it runs: how it's going is asked every few seconds, and the report is read again each time a block
  // was filled (its version moved on) and once it's done.
  followFill = (id, sourceId, { dataStatus, dataErrors, version }) => {
    this.fillInfo.set(id, { dataStatus, dataErrors })
    if (this.shownId !== id) {
      return
    }
    this.stopFollowingFill()
    this.setState({ fill: { id, dataStatus, dataErrors } })
    if (isFillingData(dataStatus)) {
      const follow = { id, sourceId, version, dataStatus, heardAt: Date.now(), delay: FILL_POLL_MS, timer: null }
      this.fillFollow = follow
      this.checkFillLater(follow)
    }
  }

  stopFollowingFill = () => {
    clearTimeout(this.fillFollow?.timer)
    this.fillFollow = null
  }

  checkFillLater = (follow) => {
    follow.timer = setTimeout(() => this.checkFill(follow), follow.delay)
  }

  // A check that fails is tried again after a growing pause. With no news for long enough, the fill is taken to have
  // stopped, and the report can be changed again.
  checkFill = async (follow) => {
    const current = () => this.mounted && this.fillFollow === follow
    if (!current()) {
      return
    }
    const stalled = () => {
      if (Date.now() - follow.heardAt < FILL_STALL_MS) {
        return false
      }
      this.stopFollowingFill()
      this.setState(({ fill }) => (fill?.id === follow.id ? { fill: { ...fill, stalled: true } } : null))
      return true
    }
    const tryAgain = () => {
      follow.delay = Math.min(follow.delay * 2, FILL_POLL_MAX_MS)
      if (!stalled()) {
        this.checkFillLater(follow)
      }
    }

    let progress
    try {
      progress = await fetchReportDataStatus({ authentication: this.credentialsFor(follow.sourceId), id: follow.id })
    } catch (error) {
      if (!current()) {
        return
      }
      if (isReportGone(error)) {
        // Deleted somewhere else: opening it again finds that out, and says so.
        this.stopFollowingFill()
        this.loadShown()
        return
      }
      this.unauthorized(error)
      tryAgain()
      return
    }
    if (!current()) {
      return
    }

    const filling = isFillingData(progress.dataStatus)
    // A block was filled since (the report's version moved on), or the fill is over: the report is read again.
    if (progress.version !== follow.version || !filling) {
      const read = await this.readFilled(follow)
      if (!current()) {
        return
      }
      if (!read) {
        tryAgain()
        return
      }
    }
    // Any news — a block filled, the fill under way — says it's still going.
    if (progress.version !== follow.version || progress.dataStatus !== follow.dataStatus) {
      follow.version = progress.version
      follow.dataStatus = progress.dataStatus
      follow.heardAt = Date.now()
    } else if (filling && stalled()) {
      return
    }

    follow.delay = FILL_POLL_MS
    const { dataStatus, dataErrors } = progress
    this.fillInfo.set(follow.id, { dataStatus, dataErrors })
    if (filling) {
      this.setState({ fill: { id: follow.id, dataStatus, dataErrors } })
      this.checkFillLater(follow)
      return
    }
    this.fillFollow = null
    this.setState({ fill: { id: follow.id, dataStatus, dataErrors, ended: true } })
  }

  // The report as the fill has left it so far, shown in place of what was, with its saver at the new version: nothing
  // was edited meanwhile. Resolves with whether it could be read.
  readFilled = async ({ id, sourceId }) => {
    let detail
    try {
      detail = await fetchReport({ authentication: this.credentialsFor(sourceId), id })
    } catch (error) {
      this.unauthorized(error)
      return false
    }
    if (this.mounted && this.shownId === id && !this.savers.get(id)?.hasUnsaved) {
      this.showStored(id, sourceId, detail, { follow: false })
    }
    return true
  }

  // While AutoQL fills in its data, a report can't be changed: the builder is read-only, and nothing is saved.
  isFilling = (id) => {
    const { fill } = this.state
    return !!fill && fill.id === id && isFillingData(fill.dataStatus) && !fill.stalled
  }

  // What the builder says about the shown report's data blocks with no answer: kept the same while the fill is.
  dataFillFor = (fill, filling) => {
    if (!fill || (!filling && !fill.dataErrors?.length)) {
      return null
    }
    const last = this.lastDataFill
    if (last && last.fill === fill && last.filling === filling) {
      return last.value
    }
    const errors = {}
    ;(fill.dataErrors || []).forEach(({ blockId, reason, message }) => {
      errors[blockId] = { reason, message }
    })
    const value = filling ? { state: 'filling' } : { state: 'filled', errors }
    this.lastDataFill = { fill, filling, value }
    return value
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
    if (this.fillFollow?.id === id) {
      this.stopFollowingFill()
    }
    this.localFills.get(id)?.controllers.forEach((controller) => controller.abort())
    this.localFills.delete(id)
    this.fillInfo.delete(id)
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

  handleChange = (change) => {
    const id = this.shownId
    if (!id || this.isFilling(id)) {
      return
    }
    // Blocks merged in from another tab that the builder hadn't been handed yet: an edit built without them keeps
    // them, rather than taking them out of the report again.
    const merged = this.unshownMerge?.id === id ? this.unshownMerge.blocks : null
    const next = merged ? withBlocksAdded(change, merged) : change
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

  // The folder the host says a new report goes in, while it's one of the user's.
  newReportFolder = () => {
    const id = this.props.newReportFolderId
    return id && this.state.folders?.some((folder) => folder.id === id) ? id : null
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
    // Made from the home page while it shows a folder: it's made in that folder.
    const folderId = this.newReportFolder()
    const saver = this.makeSaver(id, this.sourceId, report, null, folderId)
    const now = new Date().toISOString()
    const summary = { id, title, sizeBytes: 0, version: 0, folderId, tagIds: [], createdAt: now, updatedAt: now }
    this.setState(({ reports }) => ({ newReportOpen: false, notice: null, reports: [summary, ...(reports || [])] }))
    saver.flush()
    this.setTabs((tabs) => withTabOpen(tabs, id))
    this.select(id)
  }

  // New report › Start from a template: the report made from it, under the id the dialog made for it (the same one when
  // it tries again, so a start that went through isn't made twice), in the folder the host's home page shows. It opens
  // in its tab while AutoQL fills in its data. Rejects with why it wasn't made, for the dialog to say.
  startFromTemplate = async ({ templateId, id }) => {
    const sourceId = this.sourceId
    // What the report's data is as of, wherever it's filled in.
    const startedAt = new Date().toISOString()
    this.saveNow()
    let detail
    try {
      detail = await createReportFromTemplate({
        authentication: this.credentialsFor(sourceId),
        id,
        templateId,
        folderId: this.newReportFolder() || undefined,
        timeZone: browserTimeZone(),
      })
    } catch (error) {
      this.unauthorized(error)
      throw error
    }
    if (!this.stillOn(sourceId)) {
      return
    }
    this.setState(({ reports }) => ({
      newReportOpen: false,
      notice: null,
      reports: [summaryOf(detail), ...(reports || []).filter((report) => report.id !== detail.id)],
    }))
    this.setTabs((tabs) => withTabOpen(tabs, detail.id))
    this.select(detail.id, { detail, sourceId })
    // An AutoQL that doesn't fill reports in itself (yet) leaves it to this page.
    if (detail.dataStatus === 'NONE') {
      this.fillHere(detail.id, sourceId, startedAt)
    }
  }

  // A report made from a template, filled in from this page as AutoQL would fill it: its questions asked a few at a
  // time, each answer kept the way its block is set up and as of when the report was started, while it shows
  // read-only with how far it's got. Each answer is saved as it comes. It goes on while another report is shown, and
  // stops if this one is deleted or the page goes away; what it hadn't asked by then can be rerun.
  fillHere = (id, sourceId, capturedAt) => {
    const blocks = questionBlocks(this.savers.get(id)?.report)
    if (!blocks.length) {
      return
    }
    const fill = { next: 0, asking: 0, errors: [], controllers: new Set() }
    this.localFills.set(id, fill)
    this.showFill(id, { dataStatus: 'RUNNING', dataErrors: [] })

    const finish = () => {
      this.localFills.delete(id)
      const filled = blocks.length - fill.errors.length
      const dataStatus = !fill.errors.length ? 'DONE' : filled ? 'PARTIAL' : 'FAILED'
      this.showFill(id, { dataStatus, dataErrors: fill.errors, ended: true })
    }
    const askNext = () => {
      if (!this.mounted || this.localFills.get(id) !== fill) {
        return
      }
      if (fill.next >= blocks.length) {
        if (!fill.asking) {
          finish()
        }
        return
      }
      const block = blocks[fill.next]
      fill.next += 1
      fill.asking += 1
      const controller = typeof AbortController === 'function' ? new AbortController() : null
      fill.controllers.add(controller)
      captureQuestion({
        query: block.source.query,
        authentication: this.credentialsFor(sourceId),
        autoQLConfig: this.props.autoQLConfig,
        signal: controller?.signal,
        rerun: { kept: block.capture, displayType: block.displayType },
        capturedAt,
      }).then((result) => {
        fill.controllers.delete(controller)
        fill.asking -= 1
        if (!this.mounted || this.localFills.get(id) !== fill) {
          return
        }
        if (result.ok) {
          this.keepFilled(id, block, result.capture)
        } else if (result.reason !== 'cancelled') {
          fill.errors.push(fillErrorOf(block.id, result))
        }
        askNext()
      })
    }
    for (let i = 0; i < Math.min(RERUN_ALL_CONCURRENCY, blocks.length); i += 1) {
      askNext()
    }
  }

  // An answer a fill from here got, kept in its block — while the block still asks that question — and saved.
  keepFilled = (id, block, capture) => {
    const saver = this.savers.get(id)
    const report = saver?.report
    const target = report?.blocks?.find((b) => b?.id === block.id)
    if (!target || target.source?.type !== 'query' || target.source.query !== block.source.query) {
      return
    }
    const next = updateBlock(report, block.id, { capture })
    saver.edit(next)
    this.setState(({ opened }) => (opened?.id === id ? { opened: { id, report: next } } : null))
  }

  // Where a report is with its data, kept for when it's shown again, and shown now if it is.
  showFill = (id, { dataStatus, dataErrors, ended = false }) => {
    this.fillInfo.set(id, { dataStatus, dataErrors })
    if (this.shownId === id) {
      this.setState({ fill: { id, dataStatus, dataErrors, ...(ended ? { ended } : {}) } })
    }
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

  // Deletes several reports from the home page, one after another as deleteReport does each. Resolves with whether
  // every one was deleted.
  deleteReports = async (ids) => {
    let all = true
    for (const id of ids) {
      all = (await this.deleteReport(id)) && all
    }
    return all
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
    const { reports, listError, listMissing, deletingId, actionError, notice, folders, tags, organizersError } =
      this.state
    const home = {
      reports,
      listError,
      retryList: this.resetList,
      openReport: this.openReport,
      deleteReport: this.deleteReport,
      deleteReports: this.deleteReports,
      deletingId,
      folders,
      tags,
      organizersError,
      retryOrganizers: this.loadOrganizers,
      createFolder: this.createFolder,
      renameFolder: this.renameFolder,
      deleteFolder: this.deleteFolder,
      createTag: this.createTag,
      updateTag: this.updateTag,
      deleteTag: this.deleteTag,
      organizeReports: this.organizeReports,
      notices: [
        ...(actionError ? [{ tone: 'error', text: actionError }] : []),
        ...(listMissing ? [{ tone: 'error', text: listMissing }] : []),
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
    const fill = active && this.state.fill?.id === active.id ? this.state.fill : null
    const filling = !!fill && this.isFilling(active.id)
    const fillNotice = fill ? fillNoticeOf(fill, filling, active.report) : null

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
          readOnly={filling}
          dataFill={this.dataFillFor(fill, filling)}
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
            !readOnly && !filling && saveState ? (
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
        {fillNotice ? (
          <p
            className={`${RS}-editor-notice`}
            data-tone={fillNotice.tone}
            role='status'
            data-test='reports-fill-notice'
          >
            {filling ? (
              <span className={`${RS}-spin`}>
                <Icon name='spinner' size={14} />
              </span>
            ) : (
              <Icon name={fillNotice.tone === 'info' ? 'check' : 'alert'} size={14} />
            )}
            {fillNotice.text}
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
      <div ref={this.root} className={`${RS}${className ? ` ${className}` : ''}`} data-test='reports'>
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
            enableTemplates={this.props.enableTemplates}
            onStartFromTemplate={this.startFromTemplate}
            previewProps={{
              branding: this.props.branding,
              enableBranding: this.props.enableBranding,
              fontStylesheetUrl: this.props.fontStylesheetUrl,
            }}
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
