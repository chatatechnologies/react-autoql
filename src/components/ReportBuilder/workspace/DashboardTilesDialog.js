import React from 'react'
import { Dashboard } from '../../Dashboard'
import { UNSUPPORTED_DISPLAY_TYPES } from '../constants'
import { Icon } from '../components/icons'
import { SelectBox } from '../components/controls'
import { getTileKey } from '../model/tiles'
import { RS } from './reportsConstants'
import { REPORT_ADD_MAX_BYTES, reportBytes, stripQueryResponses } from './documents'
import { tileBlocks } from './reportBlocks'
import { ReportModal } from './ReportModal'
import { REPORTS_STRINGS } from './reportsStrings'

// Dashboard tiles into a report: from an empty Data block's "Pick dashboard tiles…" ('add'), or New report from a
// dashboard ('start'). Pick a dashboard, see it as its dashboard page shows it (react-autoql's own Dashboard, from
// its cached answers), tick tiles, then Add. Each ticked tile becomes a Data block that keeps what it shows here —
// the Dashboard's captureTilesForReport, the capture a tile's own "Add to Report…" makes — with the tile as its
// source. Nothing reruns later by itself.
//
// The dashboard is read-only (no editing, slicers or toolbar), but each tile keeps its own controls: a table sorted
// or filtered here is added that way. Drawn only while open, so every opening starts fresh from the tiles the host
// passes, which may carry answers it already has; the answers that arrive here go back to it (onTilesChange).
//
// Props: authentication, autoQLConfig, dataFormatting, dashboards ([{ id, name, tiles, type }], null while they
// load), report (the one the blocks go into, so adding keeps it under the service's size limit), mode ('start': every
// tile ticked as it loads, until the ticks are touched; 'add': none are), initialDashboardId (shown first; else the
// first dashboard), onClose, onAdd(blocks, dashboard), onTilesChange(dashboardId, tiles).

const S = REPORTS_STRINGS
const T = S.tilePicker

// One empty list, so a dashboard without tiles hands its Dashboard the same one every time.
const NO_TILES = []

const hasQuestion = (tile) => typeof tile?.query === 'string' && !!tile.query.trim()
const labelOf = (tile) => tile.title || tile.query || T.untitledTile
const byPosition = (a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0)
const megabytes = (bytes) => (bytes / (1024 * 1024)).toFixed(1)

// Whether a tile can be added: 'ready', 'loading' (its answer hasn't arrived), or 'unavailable' and why. A report
// can't hold what the capture refuses.
const statusOf = (tile) => {
  if (!hasQuestion(tile)) {
    return { kind: 'unavailable', reason: T.noQuestion }
  }
  if (tile.displayType && UNSUPPORTED_DISPLAY_TYPES.includes(tile.displayType)) {
    return { kind: 'unavailable', reason: T.unsupported }
  }
  if (!tile.queryResponse) {
    return { kind: 'loading' }
  }
  if (!Array.isArray(tile.queryResponse?.data?.data?.rows)) {
    return { kind: 'unavailable', reason: T.noData }
  }
  return { kind: 'ready' }
}

// The dashboard with this id, else the first one; null while they load or when there are none.
const findDashboard = (dashboards, id) => {
  if (!Array.isArray(dashboards)) {
    return null
  }
  return (id != null && dashboards.find((d) => d && String(d.id) === String(id))) || dashboards[0] || null
}

export class DashboardTilesDialog extends React.Component {
  static defaultProps = {
    dashboards: null,
    mode: 'add',
    initialDashboardId: null,
  }

  constructor(props) {
    super(props)
    this.selectRef = React.createRef()
    this.dashboardRef = null
    this.state = {
      chosenId: props.initialDashboardId ?? null,
      // Each dashboard's tiles as its Dashboard last reported them, answers included, by id. Until it reports, the
      // host's are shown. Kept for every dashboard shown, so going back to one keeps what it answered.
      tilesById: {},
      ticked: new Set(),
      touched: false,
      error: null,
    }
  }

  componentDidMount() {
    this.runAnswers()
  }

  componentDidUpdate() {
    this.runAnswers()
  }

  componentWillUnmount() {
    this.unmounted = true
  }

  // What's shown, from the props and state given: the dashboard, the tiles its Dashboard is handed, the same tiles in
  // reading order with whether each can be added, what's ticked, and the ticked tiles that can be added. Starting a
  // report ticks every tile as it loads, until the user changes the ticks.
  view(props = this.props, state = this.state) {
    const dashboard = findDashboard(props.dashboards, state.chosenId)
    const reported = dashboard ? state.tilesById[String(dashboard.id)] : undefined
    const tiles = reported || (Array.isArray(dashboard?.tiles) ? dashboard.tiles : NO_TILES)
    const listed = tiles
      .filter((tile) => !!tile && typeof tile === 'object')
      .sort(byPosition)
      .map((tile) => ({ tile, key: getTileKey(tile), status: statusOf(tile) }))
    const readyKeys = listed.filter((item) => item.status.kind === 'ready').map((item) => item.key)
    const ticked = props.mode === 'start' && !state.touched ? new Set(readyKeys) : state.ticked
    return {
      dashboard,
      tiles,
      listed,
      ticked,
      chosenKeys: readyKeys.filter((key) => ticked.has(key)),
      loadingCount: listed.filter((item) => item.status.kind === 'loading').length,
    }
  }

  attachDashboard = (instance) => {
    this.dashboardRef = instance
  }

  // Once a dashboard's Dashboard is mounted, has it answer its tiles from its cached answers, as the dashboard page
  // does on load — unless every tile with a question has an answer already, as the host may have passed in. Once
  // per mounted Dashboard.
  runAnswers() {
    const dashboardRef = this.dashboardRef
    if (!dashboardRef || dashboardRef === this.answeredBy) {
      return
    }
    this.answeredBy = dashboardRef
    if (!this.view().tiles.some((tile) => hasQuestion(tile) && !tile.queryResponse)) {
      return
    }
    try {
      dashboardRef.executeCachedDashboard?.()?.catch?.(() => {
        // Each tile shows its own error.
      })
    } catch (error) {
      // Each tile shows its own error.
    }
  }

  // The Dashboard's tiles, answers included as they arrive: kept for this dashboard, and handed to the host. An answer
  // that comes in after the dialog has closed is dropped.
  onDashboardChange = (dashboard, tiles) => {
    if (this.unmounted || !Array.isArray(tiles)) {
      return
    }
    this.setState(({ tilesById }) => ({ tilesById: { ...tilesById, [String(dashboard.id)]: tiles } }))
    this.props.onTilesChange?.(dashboard.id, tiles)
  }

  choose = (id) => this.setState({ chosenId: id, ticked: new Set(), touched: false, error: null })

  toggle = (key) =>
    this.setState((state, props) => {
      const ticked = new Set(this.view(props, state).ticked)
      if (ticked.has(key)) {
        ticked.delete(key)
      } else {
        ticked.add(key)
      }
      return { ticked, touched: true, error: null }
    })

  // Each ticked tile as it looks here, or why one can't be added. Blocks never carry a live query response, and
  // adding them must leave the report small enough to save.
  add = () => {
    const { report, onAdd } = this.props
    const { dashboard, chosenKeys } = this.view()
    const dashboardRef = this.dashboardRef
    if (!dashboardRef || !dashboard || !chosenKeys.length) {
      return
    }

    const results = tileBlocks(dashboardRef, chosenKeys, dashboard)
    const failed = results.filter((r) => !r.result.ok)
    if (failed.length) {
      this.setState({
        error: failed.map((r) => T.tileFailed(r.title || T.untitledTile, r.result.message)).join(' '),
      })
      return
    }

    const blocks = results.map((r) => stripQueryResponses(r.result.block))
    const before = Array.isArray(report?.blocks) ? report.blocks : []
    const size = reportBytes({ ...report, blocks: [...before, ...blocks] })
    if (size > REPORT_ADD_MAX_BYTES) {
      this.setState({ error: T.tooLarge(megabytes(size)) })
      return
    }

    onAdd(blocks, dashboard)
  }

  renderPicker(dashboard) {
    const { dashboards } = this.props
    if (!Array.isArray(dashboards) || dashboards.length < 2) {
      return null
    }
    return (
      <label className={`${RS}-tile-picker-dashboard`}>
        {T.dashboard}
        <SelectBox prefix={RS} inline>
          <select
            ref={this.selectRef}
            className={`${RS}-select`}
            value={dashboard ? String(dashboard.id) : ''}
            data-test='reports-tile-picker-dashboard'
            onChange={(e) => this.choose(e.target.value)}
          >
            {dashboards.filter(Boolean).map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name || S.untitledDashboard}
              </option>
            ))}
          </select>
        </SelectBox>
      </label>
    )
  }

  renderDashboard(dashboard, tiles) {
    const { authentication, autoQLConfig, dataFormatting, dashboards } = this.props
    if (!Array.isArray(dashboards)) {
      return (
        <div className={`${RS}-message`}>
          <span className={`${RS}-spin`}>
            <Icon name='spinner' size={20} />
          </span>
          <p>{S.loadingDashboards}</p>
        </div>
      )
    }
    if (!dashboard) {
      return (
        <div className={`${RS}-message`}>
          <p>{S.noDashboards}</p>
        </div>
      )
    }
    return (
      <div className={`${RS}-tile-picker-board`}>
        <Dashboard
          key={String(dashboard.id)}
          ref={this.attachDashboard}
          authentication={authentication}
          autoQLConfig={autoQLConfig}
          dataFormatting={dataFormatting}
          dashboardId={String(dashboard.id)}
          title={dashboard.name ?? ''}
          tiles={tiles}
          enableSlicers={false}
          enableAutoRefresh
          executeOnMount={false}
          executeOnStopEditing={false}
          isEditable={false}
          isEditing={false}
          isProjectDashboard={dashboard.type === 'PROJECT'}
          showToolbar={false}
          enableDynamicCharting
          preferRegularTableInitialDisplayType
          enableMagicWand={false}
          onChange={(next) => this.onDashboardChange(dashboard, next)}
        />
      </div>
    )
  }

  renderTiles(dashboard, listed, ticked) {
    if (!listed.length) {
      return dashboard ? <p className={`${RS}-tile-picker-empty`}>{T.noTiles}</p> : null
    }
    return (
      <ul className={`${RS}-tile-picker-tiles`}>
        {listed.map(({ tile, key, status }, i) => {
          const disabled = status.kind !== 'ready'
          const label = labelOf(tile)
          return (
            <li key={key ?? `tile-${i}`}>
              <label className={`${RS}-tile-picker-tile`} data-disabled={disabled || undefined}>
                <input
                  type='checkbox'
                  checked={!disabled && ticked.has(key)}
                  disabled={disabled}
                  data-test={`reports-tile-picker-tile-${key}`}
                  onChange={() => this.toggle(key)}
                />
                <span className={`${RS}-tile-picker-text`}>
                  <span className={`${RS}-tile-picker-name`} title={label}>
                    {label}
                  </span>
                  {disabled ? (
                    <span className={`${RS}-tile-picker-why`}>
                      {status.kind === 'loading' ? T.loading : status.reason}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    )
  }

  render() {
    const { mode, onClose } = this.props
    const { error } = this.state
    const { dashboard, tiles, listed, ticked, chosenKeys, loadingCount } = this.view()
    const starting = mode === 'start'
    const picker = this.renderPicker(dashboard)

    let status = null
    if (error) {
      status = (
        <span className={`${RS}-error`}>
          <Icon name='alert' size={14} />
          {error}
        </span>
      )
    } else if (loadingCount) {
      status = T.stillLoading(loadingCount)
    }

    return (
      <ReportModal
        title={starting ? T.titleStart : T.titleAdd}
        description={starting ? T.whatStart : T.whatAdd}
        size='large'
        headerExtra={picker}
        status={status}
        statusTone={error ? 'error' : undefined}
        initialFocus={picker ? this.selectRef : undefined}
        testId='reports-tile-picker'
        onClose={onClose}
        actions={
          <>
            <button type='button' className={`${RS}-button`} data-test='reports-tile-picker-cancel' onClick={onClose}>
              {S.cancel}
            </button>
            <button
              type='button'
              className={`${RS}-button`}
              data-variant='primary'
              data-test='reports-tile-picker-add'
              disabled={!chosenKeys.length}
              onClick={this.add}
            >
              {T.add(chosenKeys.length)}
            </button>
          </>
        }
      >
        <div className={`${RS}-tile-picker-main`}>{this.renderDashboard(dashboard, tiles)}</div>
        <aside className={`${RS}-tile-picker-aside`}>
          <h3 className={`${RS}-label ${RS}-tile-picker-heading`}>{T.tiles}</h3>
          {this.renderTiles(dashboard, listed, ticked)}
        </aside>
      </ReportModal>
    )
  }
}
