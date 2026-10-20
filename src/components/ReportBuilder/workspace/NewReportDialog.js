import React from 'react'
import { Icon } from '../components/icons'
import { SelectBox } from '../components/controls'
import { createEmptyReport } from '../model/reportSchema'
import { captureQuestion } from '../run/captureRun'
import { RS } from './constants'
import { newReportId, REPORT_TITLE_MAX } from './documents'
import { DashboardTilesDialog } from './DashboardTilesDialog'
import { ReportModal } from './ReportModal'
import { REPORTS_STRINGS } from './strings'

// New report, from the tab strip: start from a question, a dashboard, or a blank page.
//
// - A question is asked once (captureQuestion) and its answer becomes the report's first Data block, marked as asked
//   in the report (askedHere), so its Rerun button can ask it again. The report is named after it.
// - A dashboard opens its tiles (DashboardTilesDialog, in this dialog's place), every one ticked as it loads; the
//   report is named after the dashboard. Closing the tiles comes back here.
// - A blank page is just that.
//
// The host makes the report from what this starts it with: onStart({ title, blocks }). A question still on its way is
// dropped, and its request stopped, when the dialog closes.
//
// Props: authentication, autoQLConfig, dataFormatting, dashboards (undefined where the host has none, so there's no
// dashboard to start from; null while they load), onClose, onStart, onTilesChange (passed on to the tiles).

const S = REPORTS_STRINGS
const N = S.newReport

// A title the service takes: cut to its limit, which it counts in code points, so an emoji isn't split in two.
const clipTitle = (text) => Array.from(text).slice(0, REPORT_TITLE_MAX).join('')

const tileCount = (dashboard) => (Array.isArray(dashboard?.tiles) ? dashboard.tiles.length : 0)

let newReportIds = 0

export class NewReportDialog extends React.Component {
  constructor(props) {
    super(props)
    newReportIds += 1
    this.radioName = `${RS}-new-report-${newReportIds}`
    this.questionRef = React.createRef()
    this.dashboardSelectRef = React.createRef()
    this.inFlight = null
    // What a report from a dashboard is checked against for size: nothing yet.
    this.emptyReport = createEmptyReport()
    this.state = {
      mode: 'question',
      question: '',
      dashboardId: null,
      asking: false,
      error: null,
      pickingTiles: false,
    }
  }

  componentDidMount() {
    this.mounted = true
  }

  // Choosing the question puts the cursor in it.
  componentDidUpdate(prevProps, prevState) {
    if (this.state.mode === 'question' && prevState.mode !== 'question') {
      this.questionRef.current?.focus()
    }
  }

  componentWillUnmount() {
    this.mounted = false
    this.inFlight?.abort()
    this.inFlight = null
  }

  // The dashboard chosen, else the first; null while they load, or when there are none.
  dashboard() {
    const { dashboards } = this.props
    if (!Array.isArray(dashboards)) {
      return null
    }
    const { dashboardId } = this.state
    return (
      (dashboardId != null && dashboards.find((d) => d && String(d.id) === String(dashboardId))) ||
      dashboards[0] ||
      null
    )
  }

  canCreate() {
    const { mode, question, asking } = this.state
    if (asking) {
      return false
    }
    if (mode === 'blank') {
      return true
    }
    return mode === 'question' ? !!question.trim() : !!this.dashboard()
  }

  choose = (mode) => this.setState({ mode, error: null })

  create = async () => {
    if (!this.canCreate()) {
      return
    }
    const { mode } = this.state
    this.setState({ error: null })
    if (mode === 'blank') {
      this.props.onStart({ title: '', blocks: [] })
      return
    }
    if (mode === 'dashboard') {
      this.setState({ pickingTiles: true })
      return
    }

    const text = this.state.question.trim()
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    this.inFlight = controller
    this.setState({ asking: true })
    let result
    try {
      result = await captureQuestion({
        query: text,
        authentication: this.props.authentication,
        autoQLConfig: this.props.autoQLConfig,
        signal: controller?.signal,
      })
    } catch (error) {
      result = { ok: false, reason: 'error', error }
    }
    if (!this.mounted || controller?.signal.aborted) {
      return
    }
    this.inFlight = null

    if (!result.ok) {
      // A question stopped on purpose says nothing.
      let error = null
      if (result.reason !== 'cancelled') {
        const why = N.failed[result.reason] || N.failed.error
        error = result.error?.message ? `${why} ${result.error.message}` : why
      }
      this.setState({ asking: false, error })
      return
    }
    this.setState({ asking: false })
    this.props.onStart({
      title: clipTitle(text),
      blocks: [
        {
          id: newReportId(),
          type: 'data',
          width: 'full',
          rows: result.rows,
          source: { type: 'query', query: text },
          capture: result.capture,
          askedHere: true,
        },
      ],
    })
  }

  onQuestionKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent?.isComposing) {
      e.preventDefault()
      this.create()
    }
  }

  closeTiles = () => this.setState({ pickingTiles: false })

  startFromTiles = (blocks, dashboard) =>
    this.props.onStart({ title: clipTitle(String(dashboard?.name ?? '')), blocks })

  renderChoice(mode, icon, label, more) {
    const checked = this.state.mode === mode
    return (
      <li className={`${RS}-choice`} data-checked={checked || undefined}>
        <label className={`${RS}-choice-row`}>
          <input
            type='radio'
            name={this.radioName}
            value={mode}
            checked={checked}
            data-test={`reports-new-report-${mode}`}
            onChange={() => this.choose(mode)}
          />
          <Icon name={icon} />
          <span className={`${RS}-choice-name`}>{label}</span>
        </label>
        {checked && more ? <div className={`${RS}-choice-more`}>{more}</div> : null}
      </li>
    )
  }

  renderQuestion() {
    const { question, asking } = this.state
    return (
      <>
        <input
          ref={this.questionRef}
          type='text'
          className={`${RS}-input`}
          value={question}
          disabled={asking}
          placeholder={N.questionPlaceholder}
          aria-label={N.questionLabel}
          data-test='reports-new-report-question-input'
          onChange={(e) => this.setState({ question: e.target.value, error: null })}
          onKeyDown={this.onQuestionKeyDown}
        />
        <p className={`${RS}-note`}>{N.questionNote}</p>
      </>
    )
  }

  renderDashboards() {
    const { dashboards } = this.props
    if (!Array.isArray(dashboards)) {
      return (
        <p className={`${RS}-new-report-wait`}>
          <span className={`${RS}-spin`}>
            <Icon name='spinner' size={14} />
          </span>
          {S.loadingDashboards}
        </p>
      )
    }
    if (!dashboards.length) {
      return <p className={`${RS}-new-report-wait`}>{S.noDashboards}</p>
    }
    const dashboard = this.dashboard()
    return (
      <SelectBox prefix={RS}>
        <select
          ref={this.dashboardSelectRef}
          className={`${RS}-select`}
          value={dashboard ? String(dashboard.id) : ''}
          aria-label={N.dashboardLabel}
          data-test='reports-new-report-dashboard-select'
          onChange={(e) => this.setState({ dashboardId: e.target.value })}
        >
          {dashboards.filter(Boolean).map((d) => (
            <option key={d.id} value={String(d.id)}>
              {N.dashboardOption(d.name || S.untitledDashboard, tileCount(d))}
            </option>
          ))}
        </select>
      </SelectBox>
    )
  }

  render() {
    const { authentication, autoQLConfig, dataFormatting, dashboards, onClose, onTilesChange } = this.props
    const { mode, asking, error, pickingTiles } = this.state
    const dashboard = this.dashboard()

    if (pickingTiles && dashboard) {
      return (
        <DashboardTilesDialog
          authentication={authentication}
          autoQLConfig={autoQLConfig}
          dataFormatting={dataFormatting}
          dashboards={dashboards}
          initialDashboardId={dashboard.id}
          mode='start'
          report={this.emptyReport}
          onClose={this.closeTiles}
          onAdd={this.startFromTiles}
          onTilesChange={onTilesChange}
        />
      )
    }

    let createLabel = mode === 'dashboard' ? N.chooseTiles : N.create
    if (asking) {
      createLabel = (
        <>
          <span className={`${RS}-spin`}>
            <Icon name='spinner' size={14} />
          </span>
          {N.asking}
        </>
      )
    }

    return (
      <ReportModal
        title={N.title}
        description={dashboards === undefined ? N.whatWithoutDashboards : N.what}
        size='small'
        initialFocus={mode === 'dashboard' ? this.dashboardSelectRef : this.questionRef}
        testId='reports-new-report'
        onClose={onClose}
        actions={
          <>
            <button type='button' className={`${RS}-button`} data-test='reports-new-report-cancel' onClick={onClose}>
              {S.cancel}
            </button>
            <button
              type='button'
              className={`${RS}-button`}
              data-variant='primary'
              data-test='reports-new-report-create'
              disabled={!this.canCreate()}
              onClick={this.create}
            >
              {createLabel}
            </button>
          </>
        }
      >
        <ul className={`${RS}-choices`} role='radiogroup' aria-label={N.startFrom}>
          {this.renderChoice('question', 'question', N.question, this.renderQuestion())}
          {dashboards !== undefined
            ? this.renderChoice('dashboard', 'dashboard', N.dashboard, this.renderDashboards())
            : null}
          {this.renderChoice('blank', 'file', N.blank)}
        </ul>
        {error ? (
          <p className={`${RS}-error ${RS}-new-report-error`} role='alert'>
            <Icon name='alert' size={14} />
            {error}
          </p>
        ) : null}
      </ReportModal>
    )
  }
}
