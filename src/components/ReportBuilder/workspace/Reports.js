import React from 'react'
import PropTypes from 'prop-types'
import { autoQLConfigDefault, dataFormattingDefault, parseJwt } from 'autoql-fe-utils'
import { withTheme } from '../../../theme'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'
import { ReportBuilder } from '../ReportBuilder'
import { createEmptyReport, isNewerSchema } from '../model/reportSchema'
import { Icon } from '../components/icons'
import { setSessionFilterLocks, setTitle, updateBlock } from '../model/reportOperations'
import { filterLocksKey, normalizeFilterLocks } from '../model/filterLocks'
import { fillQuestions, questionBlocks } from '../run/fillQuestions'
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
  BATCH_AT_ONCE,
  BATCH_QUESTIONS_AT_ONCE,
  DEFAULT_STORAGE_PREFIX,
  FILL_POLL_MAX_MS,
  FILL_POLL_MS,
  FILL_STALL_MS,
  REPORTS_PAGE_SIZE,
  RS,
  SAVE_DELAY_MS,
} from './reportsConstants'
import { REPORTS_STRINGS } from './reportsStrings'
import { fillNoticeOf } from './fillNotice'
import {
  describeReportError,
  isReportGone,
  isUnauthorized,
  newReportId,
  REPORT_TITLE_MAX,
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
import { SaveAsTemplateDialog } from './SaveAsTemplateDialog'
import { ManageTemplatesDialog } from './ManageTemplatesDialog'
import { TemplateEditor } from './TemplateEditor'
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
// blocks were filled, and each one that wasn't says why. With canManageTemplates too (an organization's admins), a
// report can be saved as a template (Report options › Save as template…), and the organization's templates and
// categories managed (Manage templates, from the templates and the home page). Edit there opens a template in the
// builder in place of the tabs (TemplateEditor), until it's closed. With enableFilterLocks, a template can start a
// report for each household picked in one go (startEachFromTemplate): made and filled in a few at a time while the
// home page lists them.
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

// How AutoQL's fill of a report can end.
const FILL_OVER = ['DONE', 'PARTIAL', 'FAILED']

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// A fill's heartbeat that moved on since it was last heard: it's still asking, even with no block filled since.
const heartbeatMoved = (progress, before) =>
  !!progress.dataHeartbeatAt && progress.dataHeartbeatAt !== before?.dataHeartbeatAt

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

// Text cut to `max` code points, with an ellipsis when it had more.
const clipped = (text, max) => {
  const points = Array.from(text)
  return points.length > max ? `${points.slice(0, Math.max(max - 1, 1)).join('')}…` : text
}

// A report for each household (RW-353): their folder, named for the template and the day, within a folder name's
// length; and each report's title, its own and the household it's for, within a title's.
const batchFolderName = (title, date) => {
  const day = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  const room = NAME_MAX - Array.from(S.batch.folder('', day)).length
  return S.batch.folder(clipped((title || '').trim() || S.untitled, room), day)
}
const batchTitleOf = (title, lock) => {
  const value = clipped(String(lock.format_txt || lock.value), 80)
  const room = REPORT_TITLE_MAX - Array.from(S.batch.title('', value)).length
  return S.batch.title(clipped((typeof title === 'string' && title.trim()) || S.untitled, room), value)
}

// Whether a report made from a template is for the lock asked for: a service before RW-352 makes it for the template's.
const lockKeptOn = (report, lock) => filterLocksKey(report?.sessionFilterLocks) === filterLocksKey([lock])

// A report AutoQL made but couldn't fill: too busy to take it on.
const busyAtStart = (detail) =>
  detail.dataStatus === 'FAILED' && (detail.dataErrors || []).some((error) => error?.reason === 'busy')

// What a saver starts from: the report as stored.
const storedOf = (detail) => ({ report: detail.report, version: detail.version, updatedAt: detail.updatedAt })

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
    // With enableTemplates: a report can be saved as a template for the organization, and the organization's
    // templates and categories managed. That takes AutoQL's management grant for reports, so say who may: an app's
    // owners and admins, say. Off by default.
    canManageTemplates: PropTypes.bool,
    // A report can be for one value, or several, of what the host's data locks on: its households, say (the report's
    // filter lock, model/filterLocks.js). It's set in each report's builder, and with enableTemplates, chosen when a
    // report is started from a template. Off by default. loadFilterLockSuggestions and filterLockLabels: see
    // ReportBuilder.
    enableFilterLocks: PropTypes.bool,
    loadFilterLockSuggestions: PropTypes.func,
    filterLockLabels: PropTypes.shape({ title: PropTypes.string, none: PropTypes.string }),
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
    canManageTemplates: false,
    enableFilterLocks: false,
    loadFilterLockSuggestions: undefined,
    filterLockLabels: undefined,
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
    // Reports started from a template whose copy the service made with another filter lock than the one picked (or
    // with one when none was): id → the one picked, put on once they're filled in (applyPendingLock), and then id →
    // when it was, for the builder to offer Rerun all.
    this.pendingLocks = new Map()
    this.locksPutOn = new Map()
    this.root = React.createRef()
    this.templateEditor = React.createRef()

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
      // The report Save as template is open for, whether Manage templates is open, and the template being edited
      // ({ id, title }, as Manage templates listed it).
      saveAsTemplateId: null,
      manageTemplatesOpen: false,
      editingTemplate: null,
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

    // A report started for a filter lock the service didn't keep: it gets it once it's shown and can be changed.
    this.applyPendingLock()

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
    this.batch = null
    window.removeEventListener('pagehide', this.onPageHide)
    window.removeEventListener('beforeunload', this.onBeforeUnload)
    window.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.state.tilePicker?.resolve(null)
    this.stopFollowingFill()
    this.localFills.forEach((fill) => fill.stop())
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

  // Whether any report has edits the server doesn't have yet, or the template being edited has changes that aren't
  // saved.
  hasUnsavedChanges = () =>
    [...this.savers.values()].some((saver) => saver.hasUnsaved) || !!this.templateEditor.current?.hasUnsaved()

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

  // A save still waiting or on its way: start it, and let the browser ask before the page closes. A template being
  // edited is saved only with its Save, so the browser asks about its changes too.
  onBeforeUnload = (e) => {
    const unsaved = [...this.savers.values()].filter((saver) => saver.hasUnsaved)
    const templateUnsaved = !!this.templateEditor.current?.hasUnsaved()
    if (!unsaved.length && !templateUnsaved) {
      return
    }
    unsaved.forEach((saver) => saver.flush({ keepalive: true }))
    e.preventDefault()
    e.returnValue = ''
  }

  // ⌘S / Ctrl+S saves the report shown (or the template being edited) rather than opening the browser's "Save page",
  // while the focus is in the workspace (its dialogs included) or nowhere in particular. With neither shown, or the
  // focus in the host's own page, it's left to the host and the browser.
  onKeyDown = (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || String(e.key).toLowerCase() !== 's') {
      return
    }
    const editor = this.state.editingTemplate ? this.templateEditor.current : null
    if (e.defaultPrevented || !(editor || this.shownId)) {
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
      if (editor) {
        editor.saveNow()
      } else {
        this.saveNow()
      }
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
      const follow = {
        id,
        sourceId,
        version,
        dataStatus,
        dataHeartbeatAt: null,
        heardAt: Date.now(),
        delay: FILL_POLL_MS,
        timer: null,
      }
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
    // Any news — a block filled, the fill under way, its heartbeat moving on — says it's still going.
    if (
      progress.version !== follow.version ||
      progress.dataStatus !== follow.dataStatus ||
      heartbeatMoved(progress, follow)
    ) {
      follow.version = progress.version
      follow.dataStatus = progress.dataStatus
      follow.dataHeartbeatAt = progress.dataHeartbeatAt
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
    this.localFills.get(id)?.stop()
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
  //
  // With `sessionFilterLocks` it's made for them (the report's filter lock, model/filterLocks.js), and filled in with
  // them; an empty list (none, over a template's own) is sent as it is. With none, the report is for everything, even
  // if the service's copy came with a lock: the dialog starts out with the template's own, so none is a choice.
  // A service that doesn't take them yet (before RW-352) makes the report as the template has it, and fills it in
  // that way: the report gets what was picked here once it can be changed, and the builder offers Rerun all to ask
  // every question with it. Filled in from this page, it's asked with what was picked from the start.
  startFromTemplate = async ({ templateId, id, sessionFilterLocks }) => {
    const sourceId = this.sourceId
    // What the report's data is as of, wherever it's filled in.
    const startedAt = new Date().toISOString()
    const locks = normalizeFilterLocks(sessionFilterLocks)
    this.saveNow()
    let detail
    try {
      detail = await createReportFromTemplate({
        authentication: this.credentialsFor(sourceId),
        id,
        templateId,
        folderId: this.newReportFolder() || undefined,
        timeZone: browserTimeZone(),
        ...(Array.isArray(sessionFilterLocks) ? { sessionFilterLocks: locks } : {}),
      })
    } catch (error) {
      this.unauthorized(error)
      throw error
    }
    if (!this.stillOn(sourceId)) {
      return
    }
    if (filterLocksKey(detail.report?.sessionFilterLocks) !== filterLocksKey(locks)) {
      this.pendingLocks.set(detail.id, locks)
    }
    this.setState(({ reports }) => ({
      newReportOpen: false,
      notice: null,
      reports: [summaryOf(detail), ...(reports || []).filter((report) => report.id !== detail.id)],
    }))
    this.setTabs((tabs) => withTabOpen(tabs, detail.id))
    this.select(detail.id, { detail, sourceId })
    // An AutoQL that doesn't fill reports in itself (yet) leaves it to this page, which asks with the lock from the
    // start.
    if (detail.dataStatus === 'NONE') {
      this.applyPendingLock({ now: true })
      this.fillHere(detail.id, sourceId, startedAt)
    }
  }

  // The filter lock a report was started for, where the service's copy has another (pendingLocks), put on the shown
  // report as an edit once its fill is over (none takes the copy's off): put on before then, the version the fill
  // leaves would take its place. `now` puts it on before this page fills it in. A report filled in for another lock
  // says so (the builder offers Rerun all).
  applyPendingLock = ({ now = false } = {}) => {
    const id = this.shownId
    const locks = id ? this.pendingLocks.get(id) : null
    const saver = id ? this.savers.get(id) : null
    if (!locks || !saver?.report || this.localFills.has(id)) {
      return
    }
    // AutoQL's fill over: NONE says it won't fill this one, which this page does, from the start (`now`).
    const { fill } = this.state
    if (!now && !(fill?.id === id && FILL_OVER.includes(fill.dataStatus))) {
      return
    }
    this.pendingLocks.delete(id)
    // Put on after a fill without it, the answers it left aren't for it. Before this page's own fill, they aren't
    // asked yet.
    if (!now) {
      this.locksPutOn.set(id, Date.now())
    }
    this.handleChange(setSessionFilterLocks(saver.report, locks))
  }

  // A report made from a template, filled in from this page as AutoQL would fill it: its questions asked a few at a
  // time, each answer kept the way its block is set up and as of when the report was started, while it shows
  // read-only with how far it's got. Each answer is saved as it comes. It goes on while another report is shown, and
  // stops if this one is deleted or the page goes away; what it hadn't asked by then can be rerun. Every question is
  // asked with the report's filter lock. Resolves with { total, errors } once it's over, or null if it stopped.
  fillHere = (id, sourceId, capturedAt, { concurrency } = {}) => {
    const report = this.savers.get(id)?.report
    if (!questionBlocks(report).length) {
      return Promise.resolve({ total: 0, errors: [] })
    }
    let settle
    const over = new Promise((resolve) => {
      settle = resolve
    })
    // The fill's place in localFills, there before it asks anything: whether it's still wanted is read from it.
    const entry = { stop: () => settle(null) }
    const current = () => this.mounted && this.localFills.get(id) === entry
    this.localFills.set(id, entry)
    this.showFill(id, { dataStatus: 'RUNNING', dataErrors: [] })

    const fill = fillQuestions({
      report,
      authentication: this.credentialsFor(sourceId),
      autoQLConfig: this.props.autoQLConfig,
      capturedAt,
      ...(concurrency ? { concurrency } : {}),
      isCurrent: current,
      onAnswer: (block, capture) => this.keepFilled(id, block, capture),
    })
    entry.stop = () => {
      fill.stop()
      settle(null)
    }
    fill.done.then(({ total, errors }) => {
      if (!current()) {
        settle(null)
        return
      }
      this.localFills.delete(id)
      const filled = total - errors.length
      const dataStatus = !errors.length ? 'DONE' : filled ? 'PARTIAL' : 'FAILED'
      this.showFill(id, { dataStatus, dataErrors: errors, ended: true })
      settle({ total, errors })
    })
    return over
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

  // ---------------------------------------------------------------- a report for each household (RW-353)

  // New report › Start from a template, a report for each value picked for the filter lock (each household, say): in
  // a folder of their own, named for the template and the day, each for one of them and named for it. They're made and
  // filled in a few at a time — by AutoQL, or by this page where AutoQL doesn't fill reports itself — while the home
  // page lists them and says how it's going. Each is saved as it's done, so the page stays open until then. `starts`
  // are [{ id, lock }], an id for each from the dialog (the same one when it tries again). Resolves once they're under
  // way; rejects with why none were made.
  startEachFromTemplate = async ({ templateId, title, starts }) => {
    if (this.batch) {
      throw new ReportsApiError({ status: 409, code: 'REPORT_BATCH_UNDER_WAY' })
    }
    const sourceId = this.sourceId
    // What the reports' data is as of, wherever it's filled in.
    const startedAt = new Date().toISOString()
    const batch = { sourceId, templateId, startedAt, folder: null, total: starts.length, queue: [...starts] }
    Object.assign(batch, { done: 0, partly: 0, gone: 0, failed: [] })
    // Under way from here: another can't start while this one's folder is made.
    this.batch = batch
    this.saveNow()
    try {
      batch.folder = await this.createFolder(batchFolderName(title, new Date()))
    } catch (error) {
      this.batch = this.batch === batch ? null : this.batch
      throw error
    }
    if (this.batch !== batch || !this.stillOn(sourceId)) {
      this.batch = this.batch === batch ? null : this.batch
      return
    }
    this.setState({ newReportOpen: false, actionError: null })
    this.sayBatch(batch)
    const worker = async () => {
      while (batch.queue.length && this.batch === batch) {
        await this.makeOneOfBatch(batch, batch.queue.shift())
        this.sayBatch(batch)
      }
    }
    Promise.all(Array.from({ length: Math.min(BATCH_AT_ONCE, starts.length) }, worker)).then(() => this.endBatch(batch))
  }

  // One of a batch's reports: made for its lock, filled in, and named for it. What became of it is counted.
  makeOneOfBatch = async (batch, { id, lock }) => {
    let detail
    try {
      detail = await createReportFromTemplate({
        authentication: this.credentialsFor(batch.sourceId),
        id,
        templateId: batch.templateId,
        folderId: batch.folder.id,
        timeZone: browserTimeZone(),
        sessionFilterLocks: [lock],
      })
    } catch (error) {
      this.unauthorized(error)
      batch.failed.push(error)
      return
    }
    this.listBatchReport(batch, summaryOf(detail))
    const filled = this.batch === batch ? await this.fillBatchReport(batch, detail, lock) : null
    if (!filled || !(await this.nameBatchReport(batch, detail.id, lock, filled.saver))) {
      batch.gone += 1
      return
    }
    batch.done += 1
    if (filled.dataStatus !== 'DONE') {
      batch.partly += 1
    }
    this.listBatchReport(batch, { id: detail.id, dataStatus: filled.dataStatus })
  }

  // A batch report's data, asked with its lock: filled in by AutoQL, or by this page where AutoQL doesn't fill reports,
  // couldn't take this one, or made it for another lock (a service before RW-352). Resolves with how it went
  // ({ dataStatus, saver }, the saver when it was filled in here), or null when it stopped: it was deleted, the
  // page went away, or it couldn't be read.
  fillBatchReport = async (batch, detail, lock) => {
    const { id } = detail
    const filling = isFillingData(detail.dataStatus)
    if (filling) {
      const ended = await this.awaitBatchFill(batch, id)
      if (!ended || lockKeptOn(detail.report, lock)) {
        return ended
      }
    } else if (detail.dataStatus !== 'NONE' && !busyAtStart(detail) && lockKeptOn(detail.report, lock)) {
      return { dataStatus: detail.dataStatus }
    }
    // Filled in here, through its saver, as a report started here is.
    const saver = filling
      ? await this.batchSaver(batch, id)
      : this.makeSaver(id, batch.sourceId, detail.report, storedOf(detail))
    if (!saver) {
      return null
    }
    if (!lockKeptOn(saver.report, lock)) {
      saver.edit(setSessionFilterLocks(saver.report, [lock]))
    }
    this.listBatchReport(batch, { id, dataStatus: 'RUNNING' })
    const over = await this.fillHere(id, batch.sourceId, batch.startedAt, { concurrency: BATCH_QUESTIONS_AT_ONCE })
    if (!over) {
      return null
    }
    const failed = over.errors.length
    return { dataStatus: !failed ? 'DONE' : failed < over.total ? 'PARTIAL' : 'FAILED', saver }
  }

  // AutoQL's fill of a batch report, followed until it ends — or until there's been no news of it for long enough —
  // the home page's list saying how it's going. Resolves with how it ended, or null once it's gone or the batch stopped.
  awaitBatchFill = async (batch, id) => {
    let delay = FILL_POLL_MS
    let heardAt = Date.now()
    let last = null
    for (;;) {
      await wait(delay)
      if (this.batch !== batch) {
        return null
      }
      let progress
      try {
        progress = await fetchReportDataStatus({ authentication: this.credentialsFor(batch.sourceId), id })
      } catch (error) {
        if (isReportGone(error)) {
          return null
        }
        this.unauthorized(error)
        progress = null
      }
      if (progress) {
        const moved = progress.version !== last?.version || progress.dataStatus !== last?.dataStatus
        // A heartbeat moving on is news too, though the list has nothing new to show.
        if (moved || heartbeatMoved(progress, last)) {
          heardAt = Date.now()
        }
        if (moved) {
          this.listBatchReport(batch, { id, dataStatus: progress.dataStatus })
        }
        last = progress
      }
      if (progress && !isFillingData(progress.dataStatus)) {
        return { dataStatus: progress.dataStatus }
      }
      if (Date.now() - heardAt >= FILL_STALL_MS) {
        return { dataStatus: 'FAILED' }
      }
      delay = progress ? FILL_POLL_MS : Math.min(delay * 2, FILL_POLL_MAX_MS)
    }
  }

  // The saver to change a batch report through: its own while it's shown here or has edits waiting, otherwise one at
  // the version AutoQL has now (its fill moved it on). Null when it couldn't be read.
  batchSaver = async (batch, id) => {
    const open = this.savers.get(id)
    if (open && (this.shownId === id || open.hasUnsaved)) {
      return open
    }
    let detail
    try {
      detail = await fetchReport({ authentication: this.credentialsFor(batch.sourceId), id })
    } catch (error) {
      this.unauthorized(error)
      return null
    }
    return this.mounted ? this.makeSaver(id, batch.sourceId, detail.report, storedOf(detail)) : null
  }

  // A batch report named for its lock ("<its title> — <the household>") and saved, with its answers when it was filled
  // in here. Resolves with whether it was saved.
  nameBatchReport = async (batch, id, lock, known) => {
    const saver = known || (await this.batchSaver(batch, id))
    if (!saver) {
      return false
    }
    const title = batchTitleOf(saver.report?.title, lock)
    saver.edit(setTitle(saver.report, title))
    if (this.stillOn(batch.sourceId)) {
      this.setState(({ opened, reports }) => ({
        opened: opened?.id === id ? { id, report: saver.report } : opened,
        reports: reports ? reports.map((report) => (report.id === id ? { ...report, title } : report)) : reports,
      }))
    }
    return saver.flush()
  }

  // A batch report on the home page's list: added as it's made, and changed as it fills in.
  listBatchReport = (batch, report) => {
    if (!this.stillOn(batch.sourceId)) {
      return
    }
    this.setState(({ reports }) => {
      if (!reports) {
        return null
      }
      const listed = reports.some((r) => r.id === report.id)
      return {
        reports: listed ? reports.map((r) => (r.id === report.id ? { ...r, ...report } : r)) : [report, ...reports],
      }
    })
  }

  // What the home page says while a batch is made.
  sayBatch = (batch) => {
    if (this.batch === batch && this.stillOn(batch.sourceId)) {
      const settled = batch.done + batch.gone + batch.failed.length
      this.setState({ notice: S.batch.making(settled, batch.total, batch.folder.name) })
    }
  }

  // And once it's over: how many were made, and filled in; and why any weren't made.
  endBatch = (batch) => {
    if (this.batch !== batch) {
      return
    }
    this.batch = null
    if (!this.stillOn(batch.sourceId)) {
      return
    }
    const { done, partly, failed, total, folder } = batch
    const said = done ? [S.batch.made(done, total, folder.name), partly ? S.batch.partly(partly) : null] : []
    const why = failed.length ? describeReportError(failed[0], 'startFromTemplate').reason : null
    this.setState({
      notice: said.filter(Boolean).join(' ') || null,
      actionError: why ? S.batch.notMade(failed.length, total, why) : null,
    })
  }

  // ---------------------------------------------------------------- templates, for those who manage them

  canManageTemplates = () => !!(this.props.enableTemplates && this.props.canManageTemplates)

  openSaveAsTemplate = () => {
    if (this.shownId) {
      this.setState({ saveAsTemplateId: this.shownId })
    }
  }

  closeSaveAsTemplate = () => this.setState({ saveAsTemplateId: null })

  // A template is made from the report as AutoQL has it: what's waiting is saved first. Resolves with whether it was.
  saveForTemplate = () => this.savers.get(this.state.saveAsTemplateId)?.flush() ?? Promise.resolve(false)

  openManageTemplates = () => this.setState({ newReportOpen: false, saveAsTemplateId: null, manageTemplatesOpen: true })

  closeManageTemplates = () => this.setState({ manageTemplatesOpen: false })

  // Manage templates › Edit: the template in the builder, in place of the tabs. What's waiting in the report shown is
  // saved first. Closed, it's back to Manage templates, which lists them again.
  editTemplate = (template) => {
    this.saveNow()
    this.setState({ manageTemplatesOpen: false, editingTemplate: { id: template.id, title: template.title } })
  }

  closeTemplateEditor = () => this.setState({ editingTemplate: null, manageTemplatesOpen: this.canManageTemplates() })

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
      manageTemplates: this.canManageTemplates() ? this.openManageTemplates : undefined,
    }
    return this.props.renderHome ? this.props.renderHome(home) : <PlainHome {...home} />
  }

  // What every builder here is handed: a report's, in its tab, and a template's being edited.
  builderProps = () => ({
    authentication: this.props.authentication,
    autoQLConfig: this.props.autoQLConfig,
    dataFormatting: this.props.dataFormatting,
    dashboards: this.props.dashboards || NO_DASHBOARDS,
    branding: this.props.branding,
    enableBranding: this.props.enableBranding,
    canEditBranding: this.props.canEditBranding,
    enableDataBlocks: this.props.enableDataBlocks,
    enableAnalysis: this.props.enableAnalysis,
    enableRunReport: this.props.enableRunReport,
    enableFilterLocks: this.props.enableFilterLocks,
    loadFilterLockSuggestions: this.props.loadFilterLockSuggestions,
    filterLockLabels: this.props.filterLockLabels,
    fontStylesheetUrl: this.props.fontStylesheetUrl,
    getAuthenticationForProject: this.props.getAuthenticationForProject,
    onRunComplete: this.props.onRunComplete,
    onErrorCallback: this.props.onErrorCallback,
  })

  renderEditor = () => {
    const { dashboards, dashboardsError } = this.props
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
          {...this.builderProps()}
          report={active.report}
          onChange={this.handleChange}
          readOnly={filling}
          dataFill={this.dataFillFor(fill, filling)}
          onSaveAsTemplate={this.canManageTemplates() && !readOnly && !filling ? this.openSaveAsTemplate : undefined}
          pickDashboardTiles={dashboards === undefined ? undefined : this.pickDashboardTiles}
          lockChangedAt={this.locksPutOn.get(active.id)}
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
    const {
      reports,
      tabs,
      tabWidths,
      shownId,
      notSaved,
      tilePicker,
      newReportOpen,
      saveAsTemplateId,
      manageTemplatesOpen,
      editingTemplate,
    } = this.state
    const active = this.activeReport()
    const titleFor = (id) => titleOf(reports?.find((report) => report.id === id))

    return (
      <div ref={this.root} className={`${RS}${className ? ` ${className}` : ''}`} data-test='reports'>
        {editingTemplate && this.canManageTemplates() ? (
          <TemplateEditor
            ref={this.templateEditor}
            key={editingTemplate.id}
            authentication={authentication}
            templateId={editingTemplate.id}
            title={editingTemplate.title}
            builderProps={this.builderProps()}
            onClose={this.closeTemplateEditor}
          />
        ) : (
          <>
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
          </>
        )}

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
            enableFilterLocks={this.props.enableFilterLocks}
            loadFilterLockSuggestions={this.props.loadFilterLockSuggestions}
            filterLockLabels={this.props.filterLockLabels}
            onStartFromTemplate={this.startFromTemplate}
            onStartEachFromTemplate={this.props.enableFilterLocks ? this.startEachFromTemplate : undefined}
            onManageTemplates={this.canManageTemplates() ? this.openManageTemplates : undefined}
            previewProps={{
              branding: this.props.branding,
              enableBranding: this.props.enableBranding,
              fontStylesheetUrl: this.props.fontStylesheetUrl,
            }}
          />
        ) : null}

        {saveAsTemplateId && active && active.id === saveAsTemplateId ? (
          <SaveAsTemplateDialog
            authentication={authentication}
            reportId={saveAsTemplateId}
            report={active.report}
            flush={this.saveForTemplate}
            onClose={this.closeSaveAsTemplate}
            onManage={this.openManageTemplates}
            enableFilterLocks={this.props.enableFilterLocks}
          />
        ) : null}

        {manageTemplatesOpen && this.canManageTemplates() ? (
          <ManageTemplatesDialog
            authentication={authentication}
            onEdit={this.editTemplate}
            onClose={this.closeManageTemplates}
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
