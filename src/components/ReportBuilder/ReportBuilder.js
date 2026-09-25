import React from 'react'
import PropTypes from 'prop-types'
import axios from 'axios'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  REQUEST_CANCELLED_ERROR,
} from 'autoql-fe-utils'

import { ErrorBoundary } from '../../containers/ErrorHOC'
import { withTheme } from '../../theme'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import { BLOCK_TYPES, RB } from './constants'
import { STRINGS } from './strings'
import { createBlock, normalizeBlock, normalizeReport } from './model/reportSchema'
import {
  duplicateBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  resetBlockStyle,
  setDataSource,
  setTitle,
  updateBlock,
  updateBlockStyle,
  updatePageSetup,
} from './model/reportOperations'
import { buildTileIndex, resolveTile } from './model/tiles'
import { getDataBlockView } from './model/blockView'
import { executeReport, formatPrintedDate, getRunLabel, planReportRun, summarizeRun } from './run/reportRun'
import { getPageGeometry } from './layout/pageGeometry'
import { DEFAULT_CHART_TIMEOUT, waitForCharts } from './print/waitForCharts'
import { printFrame } from './print/printFrame'

import { Toolbar } from './components/Toolbar'
import { Palette } from './components/Palette'
import { BlockDetails, defaultDraft } from './components/BlockDetails'
import { Sheet } from './components/Sheet'
import { PropertiesPanel } from './components/PropertiesPanel'
import { PrintPreview } from './components/preview/PrintPreview'
import { footerText, hasDataBlocks } from './components/PageFurniture'

import './ReportBuilder.scss'
import './ReportPaper.scss'

// The report builder: a controlled editor for a report template (`report` + `onChange`), which runs the
// template's data blocks as one unit, lays it out on true Letter pages and prints it with the browser.
// It stores nothing itself: the host persists `report`, and query results live only in this component.

const memoize = (fn) => {
  let lastArgs = null
  let lastResult
  return (...args) => {
    if (lastArgs && args.length === lastArgs.length && args.every((arg, i) => arg === lastArgs[i])) {
      return lastResult
    }
    lastArgs = args
    lastResult = fn(...args)
    return lastResult
  }
}

const sameEntries = (a, b) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

export class ReportBuilderWithoutTheme extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    // Host-fetched dashboards whose tiles data blocks can show: [{ id, name, tiles, slicers? }]
    dashboards: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        name: PropTypes.string,
        tiles: PropTypes.arrayOf(PropTypes.object),
        slicers: PropTypes.arrayOf(PropTypes.object),
      }),
    ),
    report: PropTypes.shape({
      schemaVersion: PropTypes.number,
      title: PropTypes.string,
      page: PropTypes.object,
      blocks: PropTypes.arrayOf(PropTypes.object),
    }),
    onChange: PropTypes.func,
    branding: PropTypes.shape({
      name: PropTypes.string,
      logoUrl: PropTypes.string,
      color: PropTypes.string,
    }),
    onRunComplete: PropTypes.func,
    onErrorCallback: PropTypes.func,
    getAuthenticationForProject: PropTypes.func,
    // A stylesheet that loads the named typefaces (Archivo, Newsreader, IBM Plex Mono). None by default.
    fontStylesheetUrl: PropTypes.string,
    // Run report: the builder fetches every data block itself. Off by default — blocks show what was
    // captured when they were added ("Add to Report…"), and running is kept for refreshing them later.
    enableRunReport: PropTypes.bool,
    className: PropTypes.string,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    dashboards: [],
    report: undefined,
    onChange: () => {},
    branding: undefined,
    onRunComplete: () => {},
    onErrorCallback: () => {},
    getAuthenticationForProject: undefined,
    fontStylesheetUrl: null,
    enableRunReport: false,
    className: undefined,
  }

  constructor(props) {
    super(props)
    this.rootRef = React.createRef()
    this.bodyRef = React.createRef()
    this.previewRef = React.createRef()
    this.blockCache = new WeakMap()
    this.runId = 0

    this.state = {
      selectedId: null,
      details: null, // { type, draft, position } while the details layer is open
      previewOpen: false,
      layoutInfo: null,
      run: null, // { id, status: running | done | cancelled, runAt, done, total, keys }
      results: {},
      printing: false,
      notice: null,
    }
  }

  componentDidMount() {
    this.mounted = true
  }

  componentWillUnmount() {
    this.mounted = false
    this.cancelRequests()
    this.printJob?.remove()
  }

  // ---------------------------------------------------------------- derived state

  // Normalized once per block object, so a block the host passes back unchanged keeps its identity and
  // doesn't redraw (a chart redraw is expensive).
  normalizeBlockCached = (block) => {
    if (!block || typeof block !== 'object') return null
    const hit = this.blockCache.get(block)
    if (hit) return hit
    const normalized = normalizeBlock(block)
    if (normalized) {
      this.blockCache.set(block, normalized)
      this.blockCache.set(normalized, normalized)
    }
    return normalized
  }

  getReport = () => {
    const raw = this.props.report
    if (raw === this.lastRawReport && this.lastReport) return this.lastReport
    const rawBlocks = Array.isArray(raw?.blocks) ? raw.blocks : []
    const base = normalizeReport(raw && typeof raw === 'object' ? { ...raw, blocks: [] } : raw)
    this.lastRawReport = raw
    this.lastReport = { ...base, blocks: rawBlocks.map(this.normalizeBlockCached).filter(Boolean) }
    return this.lastReport
  }

  getTileIndex = memoize((dashboards) => buildTileIndex(dashboards))

  getPlan = memoize((report, tileIndex, authentication, autoQLConfig, getAuthenticationForProject) =>
    planReportRun({ report, tileIndex, authentication, autoQLConfig, getAuthenticationForProject }),
  )

  // What each runnable block would fetch now. Kept the same object while nothing changes, so the views
  // derived from it do too (the token is re-minted hourly but isn't part of a key).
  getRequestKeys = (plan) => {
    const keys = {}
    plan.jobs.forEach((job) => {
      keys[job.blockId] = job.key
    })
    if (this.lastRequestKeys && sameEntries(this.lastRequestKeys, keys)) return this.lastRequestKeys
    this.lastRequestKeys = keys
    return keys
  }

  // A block's view is rebuilt only when something it depends on changed, so typing in a heading doesn't
  // redraw every table and chart in the report.
  getViews = memoize((report, tileIndex, results, requestKeys, runningKeys) => {
    const previous = this.viewEntries || {}
    const entries = {}
    const views = {}
    report.blocks.forEach((block) => {
      if (block.type !== 'data') return
      const requestKey = requestKeys[block.id]
      const running = requestKey != null && runningKeys?.[block.id] === requestKey
      const found = block.source?.type === 'tile' ? resolveTile(tileIndex, block.source) : null
      const inputs = [block, found?.tile, found?.dashboard, results[block.id], requestKey, running]
      const old = previous[block.id]
      const entry =
        old && old.inputs.every((value, i) => value === inputs[i])
          ? old
          : { inputs, view: getDataBlockView({ block, tileIndex, result: results[block.id], requestKey, running }) }
      entries[block.id] = entry
      views[block.id] = entry.view
    })
    this.viewEntries = entries
    return views
  })

  derive = () => {
    const report = this.getReport()
    const tileIndex = this.getTileIndex(this.props.dashboards)
    const plan = this.getPlan(
      report,
      tileIndex,
      this.props.authentication,
      this.props.autoQLConfig,
      this.props.getAuthenticationForProject,
    )
    const requestKeys = this.getRequestKeys(plan)
    const { run, results } = this.state
    const runningKeys = run?.status === 'running' ? run.keys : null
    const views = this.getViews(report, tileIndex, results, requestKeys, runningKeys)
    return { report, tileIndex, plan, requestKeys, views }
  }

  // Edited since the last run in a way that changes what some block would fetch.
  isStale = (requestKeys) => {
    const { run } = this.state
    if (!run || run.status === 'running') return false
    return Object.keys(requestKeys).some((id) => run.keys[id] !== requestKeys[id])
  }

  // ---------------------------------------------------------------- editing

  change = (next) => this.props.onChange(next)

  onTitleChange = (title) => this.change(setTitle(this.getReport(), title))

  onPageChange = (patch) => this.change(updatePageSetup(this.getReport(), patch))

  onBlockChange = (id, patch) => this.change(updateBlock(this.getReport(), id, patch))

  onStyleChange = (id, patch) => this.change(updateBlockStyle(this.getReport(), id, patch))

  onStyleReset = (id) => this.change(resetBlockStyle(this.getReport(), id))

  onSourceChange = (id, source) => this.change(setDataSource(this.getReport(), id, source))

  onText = (id, text) => this.change(updateBlock(this.getReport(), id, { text }))

  onAsk = (id, query) => this.onSourceChange(id, { type: 'query', query })

  onBlockAction = (id, action) => {
    const report = this.getReport()
    if (action === 'up' || action === 'down') {
      this.change(moveBlock(report, id, action === 'up' ? -1 : 1))
    } else if (action === 'duplicate') {
      const { report: next, id: copyId } = duplicateBlock(report, id)
      this.change(next)
      if (copyId) this.setState({ selectedId: copyId })
    } else if (action === 'remove') {
      this.change(removeBlock(report, id))
      if (this.state.selectedId === id) this.setState({ selectedId: null })
    }
  }

  onSelect = (id) => this.setState({ selectedId: id })

  onCanvasMouseDown = (e) => {
    if (!e.target.closest?.(`.${RB}-block`)) {
      this.setState({ selectedId: null })
    }
  }

  onKeyDown = (e) => {
    if (e.key !== 'Escape') return
    if (this.state.details) {
      this.closeDetails()
    } else if (this.state.selectedId && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      this.setState({ selectedId: null })
    }
  }

  scrollToBlock = (id) => {
    setTimeout(() => {
      const el = this.rootRef.current?.querySelector(`[data-block-id="${id}"]`)
      el?.scrollIntoView?.({ block: 'nearest' })
    }, 0)
  }

  // ---------------------------------------------------------------- details layer

  openDetails = (type, button) => {
    if (this.state.details?.type === type) {
      this.closeDetails()
      return
    }
    let position
    const body = this.bodyRef.current
    if (body && button) {
      const bodyRect = body.getBoundingClientRect()
      const rect = button.getBoundingClientRect()
      let top = rect.top - bodyRect.top - 6
      const limit = bodyRect.height - 460
      if (limit > 8 && top > limit) top = limit
      if (!(top > 8)) top = 8
      position = { top, left: rect.right - bodyRect.left + 10 }
    }
    this.setState({ details: { type, draft: defaultDraft(type), position } })
  }

  closeDetails = () => this.setState({ details: null })

  onDraftChange = (draft) => this.setState((state) => (state.details ? { details: { ...state.details, draft } } : null))

  insertFromDetails = () => {
    const { details, selectedId } = this.state
    if (!details) return
    const block = createBlock(details.type, details.draft)
    if (!block) return
    const report = this.getReport()
    const anchor = report.blocks.some((b) => b.id === selectedId) ? selectedId : undefined
    this.change(insertBlock(report, block, anchor))
    this.setState({ details: null, selectedId: block.id }, () => this.scrollToBlock(block.id))
  }

  // ---------------------------------------------------------------- running

  cancelRequests = () => {
    if (this.cancelSource) {
      this.cancelSource.cancel(REQUEST_CANCELLED_ERROR)
      this.cancelSource = null
    }
  }

  // Runs every data block as one run with one timestamp. Resolves with the run's summary, or null if
  // it was superseded or the builder went away.
  runReport = () => {
    if (!this.props.enableRunReport) return Promise.resolve(null)
    this.cancelRequests()
    const { plan, requestKeys } = this.derive()
    this.runId += 1
    const runId = this.runId
    const source = axios.CancelToken.source()
    this.cancelSource = source
    const runAt = new Date().toISOString()
    const current = () => this.mounted && this.runId === runId

    this.setState({
      results: {},
      run: { id: runId, status: 'running', runAt, done: 0, total: plan.jobs.length, keys: requestKeys },
    })

    return executeReport({
      jobs: plan.jobs,
      cancelToken: source.token,
      onSettled: (blockId, result) => {
        if (!current()) return
        this.setState((state) => ({
          results: { ...state.results, [blockId]: result },
          run: state.run ? { ...state.run, done: state.run.done + 1 } : state.run,
        }))
      },
    })
      .then((results) => {
        if (!current()) return null
        if (this.cancelSource === source) this.cancelSource = null
        const summary = { ...summarizeRun(results, plan.skipped), runAt }
        this.setState((state) => ({
          run: { ...state.run, status: summary.status === 'cancelled' ? 'cancelled' : 'done' },
        }))
        this.props.onRunComplete(summary)
        return summary
      })
      .catch((error) => {
        if (!current()) return null
        this.setState((state) => ({ run: { ...state.run, status: 'done' } }))
        this.props.onErrorCallback(error)
        return null
      })
  }

  cancelRun = () => {
    if (this.state.run?.status !== 'running') return
    this.cancelRequests()
    this.runId += 1 // anything still in flight is ignored
    this.setState((state) => ({ run: { ...state.run, status: 'cancelled' } }))
  }

  // ---------------------------------------------------------------- preview and print

  openPrintPreview = () =>
    new Promise((resolve) => {
      if (this.state.previewOpen) {
        resolve()
        return
      }
      this.setState({ previewOpen: true, details: null, layoutInfo: null, notice: null }, resolve)
    })

  closePrintPreview = () =>
    new Promise((resolve) => {
      this.printJob?.remove()
      this.setState({ previewOpen: false, layoutInfo: null, notice: null }, resolve)
    })

  onLayout = (layoutInfo) => this.setState({ layoutInfo })

  // Opens the preview if it isn't open, waits for its pages and charts, then prints them. Resolves true
  // once the browser's print dialog has been asked for.
  print = async () => {
    if (this.printInFlight) return false
    this.printInFlight = true
    this.setState({ printing: true, notice: null })
    try {
      await this.openPrintPreview()
      const preview = this.previewRef.current
      if (!preview) return false
      await preview.whenReady()
      const charts = await waitForCharts(preview.getPagesElement(), { timeout: DEFAULT_CHART_TIMEOUT })
      if (!this.mounted || !this.state.previewOpen || this.previewRef.current !== preview) return false
      if (charts.timedOut) {
        this.setState({ notice: STRINGS.preview.chartsTimedOut(charts.pending) })
      }
      const report = this.getReport()
      this.printJob?.remove()
      this.printJob = printFrame({
        pages: preview.getPageElements(),
        title: report.title || STRINGS.untitled,
        orientation: report.page.orientation,
      })
      return await this.printJob.printed
    } catch (error) {
      this.props.onErrorCallback(error)
      return false
    } finally {
      this.printInFlight = false
      if (this.mounted) this.setState({ printing: false })
    }
  }

  // ---------------------------------------------------------------- render

  getRunLabel = ({ report, requestKeys, isStale }) => {
    const { run } = this.state
    const dataBlockCount = report.blocks.filter((block) => block.type === 'data' && block.source).length
    if (run?.status === 'cancelled') {
      return STRINGS.runStopped
    }
    return getRunLabel({ run, dataBlockCount, isStale })
  }

  getPreviewMeta = (report) => {
    const { layoutInfo } = this.state
    const parts = [STRINGS.preview.letter, report.page.orientation === 'landscape' ? 'Landscape' : 'Portrait']
    if (layoutInfo) parts.push(STRINGS.preview.pages(layoutInfo.pageCount))
    return parts.join(' · ')
  }

  renderEditor = ({ report, views, geometry }) => {
    const { selectedId, details, run } = this.state
    const canRun = this.props.enableRunReport
    const selected = report.blocks.find((block) => block.id === selectedId) || null
    const runAt = run && run.status !== 'running' ? run.runAt : null
    return (
      <>
        <Palette
          openType={details?.type}
          onOpen={this.openDetails}
          // Without running, a Data block made here could never have data: it comes with "Add to Report…".
          types={canRun ? BLOCK_TYPES : BLOCK_TYPES.filter((type) => type !== 'data')}
          note={canRun ? STRINGS.paletteNote : STRINGS.paletteNoteCaptures}
        />
        <main className={`${RB}-canvas`} onMouseDown={this.onCanvasMouseDown}>
          <Sheet
            report={report}
            views={views}
            selectedId={selected?.id}
            geometry={geometry}
            branding={this.props.branding}
            footerLeft={footerText({
              dataAsOf: runAt ? formatPrintedDate(runAt, { time: true }) : null,
              hasData: canRun && hasDataBlocks(report),
            })}
            onSelect={this.onSelect}
            onAction={this.onBlockAction}
            onText={this.onText}
            onAsk={this.onAsk}
            dataFormatting={this.props.dataFormatting}
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            canRun={canRun}
          />
        </main>
        <PropertiesPanel
          report={report}
          block={selected}
          view={selected ? views[selected.id] : null}
          dashboards={this.props.dashboards}
          onPageChange={this.onPageChange}
          onBlockChange={this.onBlockChange}
          onStyleChange={this.onStyleChange}
          onStyleReset={this.onStyleReset}
          onSourceChange={this.onSourceChange}
          canRun={canRun}
        />
        {details ? (
          <BlockDetails
            type={details.type}
            draft={details.draft}
            position={details.position}
            onDraftChange={this.onDraftChange}
            onInsert={this.insertFromDetails}
            onClose={this.closeDetails}
          />
        ) : null}
      </>
    )
  }

  render() {
    const { report, plan, requestKeys, views } = this.derive()
    const geometry = getPageGeometry(report.page)
    const { run, previewOpen, printing, notice, layoutInfo } = this.state
    const isStale = this.isStale(requestKeys)
    const running = run?.status === 'running'
    const hasRunnable = plan.jobs.length > 0

    return (
      <ErrorBoundary>
        <div
          ref={this.rootRef}
          className={`${RB}${this.props.className ? ` ${this.props.className}` : ''}`}
          data-mode={previewOpen ? 'preview' : 'edit'}
          onKeyDown={this.onKeyDown}
          data-test='report-builder'
        >
          {this.props.fontStylesheetUrl ? <link rel='stylesheet' href={this.props.fontStylesheetUrl} /> : null}
          <Toolbar
            title={report.title}
            onTitleChange={this.onTitleChange}
            runLabel={this.getRunLabel({ report, requestKeys, isStale })}
            running={running}
            highlightRun={hasRunnable && !running && (!run || isStale || run.status === 'cancelled')}
            hasRun={!!run && !running}
            canRun={hasRunnable}
            onRun={this.runReport}
            onCancelRun={this.cancelRun}
            showRun={this.props.enableRunReport}
            previewOpen={previewOpen}
            previewMeta={previewOpen ? this.getPreviewMeta(report) : null}
            onOpenPreview={this.openPrintPreview}
            onClosePreview={this.closePrintPreview}
            printing={printing}
            onPrint={this.print}
          />
          {notice || (previewOpen && layoutInfo?.overflowCount) ? (
            <div className={`${RB}-notice`} role='status'>
              {notice || STRINGS.preview.overflowNotice(layoutInfo.overflowCount)}
            </div>
          ) : null}
          <div className={`${RB}-body`} ref={this.bodyRef}>
            {previewOpen ? (
              <PrintPreview
                ref={this.previewRef}
                report={report}
                views={views}
                branding={this.props.branding}
                runAt={run && run.status !== 'running' ? run.runAt : null}
                generatedAt={new Date().toISOString()}
                dataFormatting={this.props.dataFormatting}
                authentication={this.props.authentication}
                autoQLConfig={this.props.autoQLConfig}
                onLayout={this.onLayout}
                canRun={this.props.enableRunReport}
              />
            ) : (
              this.renderEditor({ report, views, geometry })
            )}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}

export const ReportBuilder = withTheme(ReportBuilderWithoutTheme)
ReportBuilder.displayName = 'ReportBuilder'
