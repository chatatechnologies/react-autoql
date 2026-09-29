import React from 'react'
import { isChartType } from 'autoql-fe-utils'
import {
  ALIGN_OPTIONS,
  BG_SWATCHES,
  BLOCK_INFO,
  HEADING_LEVELS,
  INK_SWATCHES,
  MARGIN_OPTIONS,
  MAX_TABLE_ROWS,
  ORIENTATION_OPTIONS,
  RB,
  TEXT_SIZES,
  TEXT_WEIGHTS,
  TYPEFACES,
  WIDTH_OPTIONS,
} from '../constants'
import { STRINGS } from '../strings'
import { getRowOptions } from '../model/dataBlock'
import { getTileKey, getTileSupport, tileSource } from '../model/tiles'
import { getTileLabel } from '../../Dashboard/tileQueryConfig'
import { Icon } from '../../Icon'
import { formatPrintedDate } from '../run/reportRun'
import { Divider, Field, Note, SectionLabel, Segmented, SelectField, Swatches, Toggle, useStableId } from './controls'
import { AutoGrowTextarea } from './AutoGrowTextarea'

const P = STRINGS.panel

const TYPEFACE_OPTIONS = Object.keys(TYPEFACES).map((key) => [key, TYPEFACES[key].label])
const SIZE_OPTIONS = [['', P.default], ...Object.keys(TEXT_SIZES).map((key) => [key, TEXT_SIZES[key].label])]
const WEIGHT_OPTIONS = [['', P.default], ...Object.keys(TEXT_WEIGHTS).map((key) => [key, TEXT_WEIGHTS[key].label])]

const PageSetup = ({ page, onPageChange }) => (
  <>
    <SectionLabel>{P.pageSetup}</SectionLabel>
    <Segmented
      label={P.orientation}
      value={page.orientation}
      options={ORIENTATION_OPTIONS}
      onChange={(orientation) => onPageChange({ orientation })}
    />
    <SelectField
      label={P.margins}
      value={page.margins}
      options={MARGIN_OPTIONS}
      onChange={(margins) => onPageChange({ margins })}
    />
    <SelectField
      label={P.typeface}
      value={page.typeface}
      options={TYPEFACE_OPTIONS}
      onChange={(typeface) => onPageChange({ typeface })}
    />
    <Note>{P.typefaceNote}</Note>
    <Divider />
    <SectionLabel>{P.headerFooter}</SectionLabel>
    <Toggle label={P.header} checked={page.header} onChange={(header) => onPageChange({ header })} />
    <Toggle label={P.footer} checked={page.footer} onChange={(footer) => onPageChange({ footer })} />
    <Toggle
      label={P.pageNumbers}
      checked={page.pageNumbers}
      onChange={(pageNumbers) => onPageChange({ pageNumbers })}
    />
    <Toggle
      label={P.repeatTableHeaders}
      checked={page.repeatTableHeaders}
      onChange={(repeatTableHeaders) => onPageChange({ repeatTableHeaders })}
    />
    <Divider />
    <SectionLabel>{P.results}</SectionLabel>
    <Toggle
      label={P.showInterpretation}
      checked={page.showInterpretation}
      onChange={(showInterpretation) => onPageChange({ showInterpretation })}
    />
    <Note>{P.showInterpretationNote}</Note>
    <Divider />
    <SectionLabel>{P.frontMatter}</SectionLabel>
    <Toggle label={P.coverPage} checked={page.coverPage} onChange={(coverPage) => onPageChange({ coverPage })} />
    <Toggle
      label={P.tableOfContents}
      checked={page.tableOfContents}
      onChange={(tableOfContents) => onPageChange({ tableOfContents })}
    />
    <Divider />
    <p className={`${RB}-empty-props`}>{P.nothingSelected}</p>
  </>
)

const WidthField = ({ block, onBlockChange }) => (
  <Segmented
    label={P.width}
    value={block.width}
    options={WIDTH_OPTIONS}
    onChange={(width) => onBlockChange(block.id, { width })}
  />
)

const TextStyle = ({ block, onBlockChange, onStyleChange, onStyleReset }) => {
  const style = block.style || {}
  const change = (patch) => onStyleChange(block.id, patch)
  return (
    <>
      <Divider />
      <SectionLabel>{P.text}</SectionLabel>
      <SelectField
        label={P.font}
        value={style.font || 'theme'}
        options={TYPEFACE_OPTIONS}
        onChange={(font) => change({ font: font === 'theme' ? '' : font })}
      />
      <div className={`${RB}-two`}>
        <SelectField
          label={P.size}
          value={style.size || ''}
          options={SIZE_OPTIONS}
          onChange={(size) => change({ size })}
        />
        <SelectField
          label={P.weight}
          value={style.weight || ''}
          options={WEIGHT_OPTIONS}
          onChange={(weight) => change({ weight })}
        />
      </div>
      <Swatches
        label={P.textColour}
        value={style.color}
        swatches={INK_SWATCHES}
        onChange={(color) => change({ color })}
      />
      <Divider />
      <SectionLabel>{P.block}</SectionLabel>
      <WidthField block={block} onBlockChange={onBlockChange} />
      <Segmented
        label={P.align}
        value={style.align || 'left'}
        options={ALIGN_OPTIONS}
        onChange={(align) => change({ align: align === 'left' ? '' : align })}
      />
      <Swatches
        label={P.background}
        value={style.background}
        swatches={BG_SWATCHES}
        noneLabel={P.none}
        onChange={(background) => change({ background })}
      />
      <button
        type='button'
        className={`${RB}-button`}
        data-block=''
        disabled={!block.style}
        onClick={() => onStyleReset(block.id)}
      >
        {P.resetToTheme}
      </button>
      <Note>{P.themeNote}</Note>
    </>
  )
}

const QuestionBox = ({ initial, onAsk, note = P.askNote, disabled = false }) => {
  const id = useStableId('question')
  return (
    <>
      <Field label={P.askQuestion} htmlFor={id}>
        <input
          id={id}
          type='text'
          className={`${RB}-input`}
          defaultValue={initial || ''}
          placeholder={STRINGS.data.askPlaceholder}
          data-test='report-builder-question'
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
              e.preventDefault()
              onAsk(e.currentTarget.value.trim())
            }
          }}
        />
      </Field>
      <Note>{note}</Note>
    </>
  )
}

const isTableLike = (block, view) => {
  if (view?.state === 'ready') return view.kind === 'table'
  const displayType = view?.tile?.displayType
  return block.source?.type === 'tile' && !!view?.tile && !isChartType(displayType) && displayType !== 'single-value'
}

// The icons the answer's chart toolbar uses, so the choice looks the way it does there.
const DISPLAY_TYPE_ICONS = {
  table: 'table',
  column: 'column-chart',
  bar: 'bar-chart',
  line: 'line-chart',
  pie: 'pie-chart',
  heatmap: 'heatmap',
  bubble: 'bubble-chart',
  stacked_bar: 'stacked-bar-chart',
  stacked_column: 'stacked-column-chart',
  stacked_line: 'stacked-line-chart',
  column_line: 'column-line-chart',
  histogram: 'histogram-chart',
  scatterplot: 'scatterplot',
}

// Table or any chart the data supports, redrawn from the data the block keeps.
const DisplayField = ({ block, view, onBlockChange }) => (
  <>
    <Field label={P.showAs}>
      <div className={`${RB}-display-types`} role='group' aria-label={P.showAs} data-test='report-builder-show-as'>
        {view.displayOptions.map((type) => {
          const name = P.displayTypes[type] || type
          const selected = view.displayType === type
          return (
            <button
              key={type}
              type='button'
              className={`${RB}-display-type`}
              aria-label={name}
              title={name}
              aria-pressed={selected}
              data-selected={selected || undefined}
              onClick={() => onBlockChange(block.id, { displayType: type })}
            >
              <Icon type={DISPLAY_TYPE_ICONS[type]} />
            </button>
          )
        })}
      </div>
    </Field>
    {view.kind === 'chart' && !view.complete && view.countRows != null ? (
      <Note>{P.chartOfSlice(view.rowCount, view.countRows)}</Note>
    ) : null}
  </>
)

const RowsField = ({ block, view, onBlockChange }) => {
  const ready = view?.state === 'ready'
  const options = getRowOptions(ready ? view.countRows : null)
  // Past the option that already shows everything, show that option.
  const shown = (options.find(([n]) => n >= block.rows) || options[options.length - 1])[0]
  // Before a run the column's display name isn't known, and its raw name ("sum(amount)") isn't one to show.
  const ordered = (view?.tile?.orders || []).some((order) => order?.name)
  const orderLabel = ready ? view.orderLabel : null

  let which
  // A capture keeps the order its table had when it was added, whatever its source.
  if (view?.capturedAt) {
    if (orderLabel) which = P.rowsCaptured(orderLabel)
    else if (ordered) which = P.rowsCapturedUnnamed
    else which = P.rowsCapturedUnsorted(block.rows)
  } else if (block.source?.type === 'query') which = P.rowsQuestion(block.rows)
  else if (orderLabel) which = P.rowsRanked(orderLabel)
  else if (ordered) which = P.rowsRankedUnnamed
  else which = P.rowsUnranked(block.rows)

  return (
    <>
      <SelectField
        label={P.rows}
        value={shown}
        options={options}
        testId='report-builder-rows'
        onChange={(rows) => onBlockChange(block.id, { rows })}
      />
      <Note>
        {P.rowsCap(MAX_TABLE_ROWS)}
        {which}
        {ready && !view.complete ? P.rowsNoTotal : ''}
      </Note>
    </>
  )
}

const SourceCard = ({ block, view }) => (
  <div className={`${RB}-source-card`} data-test='report-builder-source'>
    {block.source?.type === 'query' ? (
      <div className={`${RB}-source-row`}>
        <span>{P.question}</span>
        <b>“{block.source.query}”</b>
      </div>
    ) : null}
    {block.source?.type === 'tile' ? (
      <>
        <div className={`${RB}-source-row`}>
          <span>{P.dashboard}</span>
          <b>{view?.dashboardName || '—'}</b>
        </div>
        <div className={`${RB}-source-row`}>
          <span>{P.tile}</span>
          <b>{view?.tileTitle || '—'}</b>
        </div>
      </>
    ) : null}
    {view?.capturedAt ? (
      <div className={`${RB}-source-row`}>
        <span>{P.captured}</span>
        <b>{formatPrintedDate(view.capturedAt, { time: true })}</b>
      </div>
    ) : null}
  </div>
)

const SourcePicker = ({ dashboards, dashboardId, tileKey, onDashboard, onTile }) => {
  const list = Array.isArray(dashboards) ? dashboards : []
  if (!list.length) {
    return <Note>{P.noDashboards}</Note>
  }
  const dashboard = list.find((d) => String(d.id) === String(dashboardId))
  const tiles = Array.isArray(dashboard?.tiles) ? dashboard.tiles : []
  const supported = tiles.filter((tile) => getTileKey(tile) != null && getTileSupport(tile).supported)
  const hidden = tiles.length - supported.length
  return (
    <>
      <SelectField
        label={P.dashboard}
        value={dashboard ? String(dashboard.id) : ''}
        options={[['', P.chooseDashboard], ...list.map((d) => [String(d.id), d.name || String(d.id)])]}
        testId='report-builder-dashboard'
        onChange={(id) => onDashboard(id || null)}
      />
      <SelectField
        label={P.tile}
        value={tileKey || ''}
        disabled={!dashboard}
        options={[['', P.chooseTile], ...supported.map((tile) => [getTileKey(tile), getTileLabel(tile)])]}
        testId='report-builder-tile'
        onChange={(key) => {
          const tile = supported.find((t) => getTileKey(t) === key)
          if (tile) onTile(tileSource({ dashboard, tile }))
        }}
      />
      {dashboard && hidden > 0 ? <Note>{P.hiddenTiles(hidden)}</Note> : null}
    </>
  )
}

// Keyed by block id, so moving to another block starts from a clean picker.
class DataProperties extends React.Component {
  state = { editing: false, dashboardId: null }

  setSource = (source) => {
    this.setState({ editing: false, dashboardId: null })
    this.props.onSourceChange(this.props.block.id, source)
  }

  render() {
    const {
      block,
      view,
      dashboards,
      onBlockChange,
      canRun = true,
      canCapture = false,
      onPickTiles,
      onAskCapture,
      onRerun,
      pending,
    } = this.props
    const { source } = block
    const captured = !!view?.capturedAt
    // Without running, a new source would have no data, so sources aren't chosen here at all.
    const picking = canRun && (!source || this.state.editing)
    const dashboardId = this.state.dashboardId ?? (source?.type === 'tile' ? source.dashboardId : null)
    const question = pending?.kind === 'question' ? pending : null
    const asking = !!question && !question.error
    // A question asked in this builder can be asked again; nothing else here reruns.
    const rerunnable = !canRun && canCapture && !!onRerun && !!block.askedHere && source?.type === 'query'

    return (
      <>
        {picking ? (
          <>
            <QuestionBox
              initial={source?.type === 'query' ? source.query : ''}
              onAsk={(query) => this.setSource({ type: 'query', query })}
            />
            <div className={`${RB}-or`}>
              <span>{P.orExisting}</span>
            </div>
            <SourcePicker
              dashboards={dashboards}
              dashboardId={dashboardId}
              tileKey={source?.type === 'tile' && dashboardId === source.dashboardId ? source.tileKey : ''}
              onDashboard={(id) => this.setState({ dashboardId: id })}
              onTile={this.setSource}
            />
            {this.state.editing ? (
              <button
                type='button'
                className={`${RB}-button`}
                data-block=''
                onClick={() => this.setState({ editing: false, dashboardId: null })}
              >
                {P.cancel}
              </button>
            ) : null}
          </>
        ) : source || captured ? (
          <>
            <SectionLabel>{P.source}</SectionLabel>
            <SourceCard block={block} view={view} />
            <Note>
              {rerunnable
                ? P.askedNote
                : captured
                ? P.capturedNote
                : source.type === 'query'
                ? P.questionNote
                : P.sourceNote}
            </Note>
            {!canRun && !captured ? <Note>{P.noCaptureNote}</Note> : null}
            {rerunnable ? (
              <>
                <button
                  type='button'
                  className={`${RB}-button`}
                  data-block=''
                  data-test='report-builder-rerun'
                  disabled={asking}
                  onClick={() => onRerun(block.id)}
                >
                  {asking ? P.rerunning : P.rerun}
                </button>
                {question?.error ? <Note tone='warning'>{question.error}</Note> : <Note>{P.rerunNote}</Note>}
              </>
            ) : null}
            {canRun ? (
              <button
                type='button'
                className={`${RB}-button`}
                data-block=''
                data-test='report-builder-change-source'
                onClick={() => this.setState({ editing: true })}
              >
                {P.changeSource}
              </button>
            ) : null}
            {view?.state === 'ready' && view.displayOptions?.length > 1 ? (
              <>
                <Divider />
                <DisplayField block={block} view={view} onBlockChange={onBlockChange} />
              </>
            ) : null}
            {isTableLike(block, view) ? (
              <>
                <Divider />
                <RowsField block={block} view={view} onBlockChange={onBlockChange} />
              </>
            ) : null}
          </>
        ) : !canRun && canCapture ? (
          <>
            <QuestionBox
              // Remade after a failed question so it comes back with that question in it.
              key={question ? `asked-${question.seq}` : 'ask'}
              initial={question ? question.query : ''}
              onAsk={(query) => onAskCapture?.(block.id, query)}
              note={asking ? STRINGS.data.asking(question.query) : P.askCaptureNote}
              disabled={asking || pending?.kind === 'tiles'}
            />
            {question?.error ? <Note tone='warning'>{question.error}</Note> : null}
            {onPickTiles ? (
              <>
                <div className={`${RB}-or`}>
                  <span>{P.orTiles}</span>
                </div>
                <button
                  type='button'
                  className={`${RB}-button`}
                  data-block=''
                  data-test='report-builder-panel-pick-tiles'
                  disabled={!!pending && !pending.error}
                  onClick={() => onPickTiles(block.id)}
                >
                  {pending?.kind === 'tiles' ? STRINGS.data.picking : STRINGS.data.pickTiles}
                </button>
                <Note>{P.pickTilesNote}</Note>
              </>
            ) : null}
          </>
        ) : (
          <Note>{P.noCaptureNote}</Note>
        )}
        <Divider />
        <SectionLabel>{P.block}</SectionLabel>
        <WidthField block={block} onBlockChange={onBlockChange} />
      </>
    )
  }
}

// Auto Analyze's wording about one result: which result, an optional focus, Analyze (when the builder can run
// it), and the wording itself, which prints as written.
const AnalysisProperties = ({ block, view, targets = [], onBlockChange, onAnalyze, pending }) => {
  const focusId = useStableId('focus')
  const wordingId = useStableId('wording')
  const writing = pending?.kind === 'analysis' && !pending.error
  const written = view?.state === 'written'
  const options = [['', P.chooseResult], ...targets.map((target) => [target.id, target.label])]
  if (block.target && !targets.some((target) => target.id === block.target)) {
    options.push([block.target, view?.targetGone ? P.removedResult : view?.fromTitle || P.thisResult])
  }
  return (
    <>
      <SelectField
        label={P.analysisResult}
        value={block.target || ''}
        options={options}
        testId='report-builder-analysis-target'
        onChange={(target) => onBlockChange(block.id, { target: target || null })}
      />
      {view?.targetGone ? <Note tone='warning'>{STRINGS.analysis.targetGone}</Note> : null}
      {!targets.length ? <Note>{P.noResults}</Note> : null}
      <Field label={P.focus} htmlFor={focusId}>
        <input
          id={focusId}
          type='text'
          className={`${RB}-input`}
          value={block.focus || ''}
          placeholder={P.focusPlaceholder}
          data-test='report-builder-analysis-focus'
          onChange={(e) => onBlockChange(block.id, { focus: e.target.value })}
        />
      </Field>
      {onAnalyze ? (
        <>
          <button
            type='button'
            className={`${RB}-button`}
            data-block=''
            data-variant='primary'
            data-test='report-builder-analyze'
            disabled={!view?.canAnalyze || writing}
            onClick={() => onAnalyze(block.id)}
          >
            {writing ? P.analyzing : written ? P.analyzeAgain : P.analyze}
          </button>
          {pending?.error ? (
            <Note tone='warning'>{pending.error}</Note>
          ) : (
            <Note>{written ? P.analyzeAgainNote : P.analyzeNote}</Note>
          )}
          {block.target && view && !view.canAnalyze && !view.targetGone ? <Note>{P.cantAnalyze}</Note> : null}
        </>
      ) : null}
      {view?.targetChanged ? <Note tone='warning'>{STRINGS.analysis.targetChanged}</Note> : null}
      <Divider />
      <Field label={P.wording} htmlFor={wordingId}>
        <AutoGrowTextarea
          id={wordingId}
          className={`${RB}-input`}
          data-multiline=''
          data-test='report-builder-analysis-text'
          value={block.text}
          onChange={(text) => onBlockChange(block.id, { text })}
        />
      </Field>
      <Note>{P.wordingNote}</Note>
      <Divider />
      <SectionLabel>{P.block}</SectionLabel>
      <WidthField block={block} onBlockChange={onBlockChange} />
    </>
  )
}

export const PropertiesPanel = (props) => {
  const { report, block, view, onPageChange } = props
  let content
  if (!block) {
    content = <PageSetup page={report.page} onPageChange={onPageChange} />
  } else {
    const info = BLOCK_INFO[block.type]
    content = (
      <>
        <SectionLabel>{info ? info.label : block.type}</SectionLabel>
        {block.type === 'heading' ? (
          <>
            <SelectField
              label={P.level}
              value={block.level}
              options={HEADING_LEVELS}
              testId='report-builder-level'
              onChange={(level) => props.onBlockChange(block.id, { level })}
            />
            <Note>{P.headingNote}</Note>
            <TextStyle {...props} />
          </>
        ) : null}
        {block.type === 'text' ? (
          <>
            <Note>{P.textNote}</Note>
            <TextStyle {...props} />
          </>
        ) : null}
        {block.type === 'data' ? <DataProperties key={block.id} {...props} view={view} /> : null}
        {block.type === 'analysis' ? <AnalysisProperties key={block.id} {...props} view={view} /> : null}
        {block.type === 'pagebreak' ? <Note>{P.pageBreakNote}</Note> : null}
        {!info ? <Note>{P.unknownNote}</Note> : null}
      </>
    )
  }
  return (
    <aside
      className={`${RB}-panel`}
      aria-label={block ? STRINGS.properties : P.pageSetup}
      data-test='report-builder-panel'
    >
      {content}
    </aside>
  )
}
