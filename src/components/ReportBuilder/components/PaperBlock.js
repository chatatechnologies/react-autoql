import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { formatElement, getDataFormatting } from 'autoql-fe-utils'
import { RB, TEXT_SIZES, TEXT_WEIGHTS, TYPEFACES } from '../constants'
import { STRINGS } from '../strings'
import { ReportTable } from './ReportTable'
import { ReportChart } from './ReportChart'
import { AutoGrowTextarea } from './AutoGrowTextarea'
import { renderedTextBefore, sourceOffsetAfter } from './textCaret'
import { formatPrintedDate } from '../run/reportRun'
import { toAnalysisMarkdown } from '../model/analysis'

// The content of one block, on paper. The editor sheet, the offscreen measurer and the printed pages all
// render blocks through this, so what is measured is what prints.
//   mode 'edit'     headings, text and an analysis's wording are editable; empty and unfinished blocks explain
//                   themselves
//   mode 'measure'  charts are empty boxes of their final height (their height is fixed, so nothing is lost)
//   mode 'page'     a table may be one piece of a table split across pages

export const textStyleOf = (style) => {
  if (!style) return undefined
  const css = {}
  if (style.font && TYPEFACES[style.font]?.stack) css.fontFamily = TYPEFACES[style.font].stack
  if (style.size && TEXT_SIZES[style.size]) css.fontSize = `${TEXT_SIZES[style.size].pt}pt`
  if (style.weight && TEXT_WEIGHTS[style.weight]) css.fontWeight = TEXT_WEIGHTS[style.weight].value
  if (style.color) css.color = style.color
  return Object.keys(css).length ? css : undefined
}

export const boxStyleOf = (style) => {
  if (!style) return undefined
  const css = {}
  if (style.background) css.background = style.background
  if (style.align) css.textAlign = style.align
  return Object.keys(css).length ? css : undefined
}

const HeadingContent = ({ block, mode, onTextChange }) => {
  const style = textStyleOf(block.style)
  if (mode === 'edit') {
    return (
      <AutoGrowTextarea
        className={`${RB}-heading`}
        data-level={block.level}
        style={style}
        value={block.text}
        placeholder={STRINGS.headingPlaceholder}
        singleLine
        aria-label={STRINGS.headingPlaceholder}
        onChange={onTextChange}
      />
    )
  }
  return (
    <div className={`${RB}-heading`} data-level={block.level} style={style} role='heading' aria-level={block.level + 1}>
      {block.text}
    </div>
  )
}

const TextContent = ({ block, mode, onTextChange }) => {
  const style = textStyleOf(block.style)
  if (mode === 'edit') {
    return (
      <AutoGrowTextarea
        className={`${RB}-text`}
        style={style}
        value={block.text}
        placeholder={STRINGS.textPlaceholder}
        aria-label={STRINGS.textPlaceholder}
        onChange={onTextChange}
      />
    )
  }
  return (
    <p className={`${RB}-text`} style={style}>
      {block.text}
    </p>
  )
}

const Placeholder = ({ title, children, tone }) => (
  <div className={`${RB}-placeholder`} data-tone={tone || undefined}>
    {title ? <div className={`${RB}-placeholder-title`}>{title}</div> : null}
    {children ? <div className={`${RB}-placeholder-body`}>{children}</div> : null}
  </div>
)

const EmptyDataContent = ({ mode, onAsk, canRun, canCapture, onPickTiles, pending }) => {
  if (mode !== 'edit') {
    return null
  }
  if (!canRun && canCapture) {
    // Filled once: by a question asked here, kept as it answers, or by the tiles picked in the host's picker,
    // which take this block's place.
    const question = pending?.kind === 'question' ? pending : null
    const asking = !!question && !question.error
    return (
      <Placeholder title={STRINGS.data.emptyTitle}>
        {asking ? (
          <span role='status'>{STRINGS.data.asking(question.query)}</span>
        ) : (
          <input
            // Remade after a failed question so it comes back with that question in it.
            key={question ? `asked-${question.seq}` : 'ask'}
            type='text'
            className={`${RB}-ask`}
            defaultValue={question ? question.query : ''}
            placeholder={STRINGS.data.askPlaceholder}
            aria-label={STRINGS.data.askPlaceholder}
            data-test='report-builder-ask'
            disabled={pending?.kind === 'tiles'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                e.preventDefault()
                onAsk?.(e.currentTarget.value.trim())
              }
            }}
          />
        )}
        {question?.error ? (
          <span className={`${RB}-ask-error`} role='alert'>
            {question.error}
          </span>
        ) : null}
        <span>{STRINGS.data.askBody}</span>
        {onPickTiles ? (
          <>
            <span>{STRINGS.data.or}</span>
            <button
              type='button'
              className={`${RB}-button`}
              data-variant='primary'
              data-test='report-builder-pick-tiles'
              disabled={!!pending && !pending.error}
              onClick={onPickTiles}
            >
              {pending?.kind === 'tiles' ? STRINGS.data.picking : STRINGS.data.pickTiles}
            </button>
            <span>{STRINGS.data.pickBody}</span>
          </>
        ) : null}
      </Placeholder>
    )
  }
  if (!canRun) {
    // Nothing here could fetch data: it arrives with "Add to Report…".
    return <Placeholder title={STRINGS.data.emptyTitle}>{STRINGS.panel.noCaptureNote}</Placeholder>
  }
  return (
    <Placeholder title={STRINGS.data.emptyTitle}>
      <input
        type='text'
        className={`${RB}-ask`}
        placeholder={STRINGS.data.askPlaceholder}
        aria-label={STRINGS.data.askPlaceholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
            e.preventDefault()
            onAsk?.(e.currentTarget.value.trim())
          }
        }}
      />
      <span>{STRINGS.data.emptyBody}</span>
    </Placeholder>
  )
}

const Tail = ({ caption, interpretation, missingInterpretation }) => (
  <div className={`${RB}-flow`} data-measure-tail=''>
    {caption ? <div className={`${RB}-caption`}>{caption}</div> : null}
    {interpretation ? (
      <div className={`${RB}-interpretation`}>
        <b>{STRINGS.data.interpretedAs}</b> {interpretation}
      </div>
    ) : missingInterpretation ? (
      <div className={`${RB}-interpretation`} data-missing=''>
        {missingInterpretation}
      </div>
    ) : null}
  </div>
)

// The block's caption, and when a captured block's data is from: "Top 25 of 30,044 by AUM · As of 23 Sep …"
const captionOf = (view) =>
  [
    view.caption,
    view.filterLabel ? STRINGS.data.filteredBy(view.filterLabel) : null,
    view.capturedAt ? STRINGS.data.asOf(formatPrintedDate(view.capturedAt, { time: true })) : null,
  ]
    .filter(Boolean)
    .join(' · ') || null

export const Continued = () => (
  <div className={`${RB}-flow`}>
    <div className={`${RB}-continued`}>{STRINGS.data.continued}</div>
  </div>
)

const statusText = (view, canRun) => {
  switch (view.state) {
    case 'not-run':
      return canRun ? STRINGS.data.notRun : STRINGS.data.noCapture
    case 'loading':
      return STRINGS.data.loading
    case 'stale':
      return STRINGS.data.stale
    case 'missing':
      return STRINGS.data.missing
    case 'unsupported':
      return STRINGS.data.unsupported[view.reason] || STRINGS.data.unsupported.unsupported
    case 'error':
      return view.error?.message || STRINGS.data.error
    default:
      return null
  }
}

const DataContent = ({
  block,
  view,
  mode,
  piece,
  showInterpretation,
  dataFormatting,
  authentication,
  autoQLConfig,
  onAsk,
  canRun = true,
  canCapture = false,
  onPickTiles,
  pending,
}) => {
  if (!view || view.state === 'empty') {
    return (
      <EmptyDataContent
        mode={mode}
        onAsk={onAsk}
        canRun={canRun}
        canCapture={canCapture}
        onPickTiles={onPickTiles}
        pending={pending}
      />
    )
  }

  const continuation = !!piece && piece.from > 0
  const title = (
    <div className={`${RB}-data-title`} data-continuation={continuation || undefined}>
      {view.sourceType === 'query' ? `“${view.title}”` : view.title}
      {continuation ? ` ${STRINGS.data.continuedTitle}` : ''}
    </div>
  )

  if (view.state !== 'ready') {
    return (
      <div className={`${RB}-data`} data-state={view.state}>
        {title}
        <Placeholder tone={view.state === 'error' || view.state === 'missing' ? 'warning' : undefined}>
          {statusText(view, canRun)}
        </Placeholder>
      </div>
    )
  }

  const interpretation = showInterpretation ? view.interpretation : ''
  // Editor only: say why nothing will print, so the setting doesn't look broken. A dashboard tile's
  // answer comes without an interpretation.
  const missingInterpretation =
    mode === 'edit' && showInterpretation && !view.interpretation
      ? STRINGS.data.noInterpretation[view.sourceType === 'query' ? 'query' : 'tile']
      : null

  if (view.kind === 'table') {
    const from = piece ? piece.from : 0
    const to = piece ? piece.to : view.rows.length
    const isLast = piece ? piece.isLast : true
    return (
      <div className={`${RB}-data`} data-kind='table'>
        {title}
        <ReportTable
          columns={view.columns}
          rows={view.rows.slice(from, to)}
          from={from}
          dataFormatting={dataFormatting}
          showHeader={piece ? piece.showHeader : true}
          total={isLast ? view.total : null}
          measure={mode === 'measure'}
        />
        {isLast ? (
          <Tail
            caption={captionOf(view)}
            interpretation={interpretation}
            missingInterpretation={missingInterpretation}
          />
        ) : (
          <Continued />
        )}
      </div>
    )
  }

  if (view.kind === 'single-value') {
    return (
      <div className={`${RB}-data`} data-kind='single-value'>
        {title}
        <div className={`${RB}-single-value`}>
          {view.value == null
            ? '—'
            : formatElement({ element: view.value, column: view.column, config: getDataFormatting(dataFormatting) })}
        </div>
        <Tail caption={captionOf(view)} interpretation={interpretation} missingInterpretation={missingInterpretation} />
      </div>
    )
  }

  return (
    <div className={`${RB}-data`} data-kind='chart'>
      {title}
      {mode === 'measure' ? (
        <div className={`${RB}-chart`} style={{ height: view.height }} />
      ) : (
        <ReportChart
          view={view}
          authentication={authentication}
          autoQLConfig={autoQLConfig}
          dataFormatting={dataFormatting}
        />
      )}
      <Tail caption={captionOf(view)} interpretation={interpretation} missingInterpretation={missingInterpretation} />
    </div>
  )
}

// What Auto Analyze's Markdown may print as: prose, lists and emphasis. Links and images are dropped (paper
// can't follow them), raw HTML is skipped, and headings past h4 read as h4.
const ANALYSIS_ELEMENTS = [
  'p',
  'br',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'code',
]
const ANALYSIS_COMPONENTS = { h5: 'h4', h6: 'h4' }

const AnalysisText = React.memo(function AnalysisText({ text }) {
  const markdown = toAnalysisMarkdown(text)
  return (
    <ReactMarkdown
      className={`${RB}-analysis-text`}
      remarkPlugins={[remarkBreaks]}
      allowedElements={ANALYSIS_ELEMENTS}
      unwrapDisallowed
      skipHtml
      components={ANALYSIS_COMPONENTS}
    >
      {markdown}
    </ReactMarkdown>
  )
})

// In the editor, clicking the wording edits it in place, as headings and text are edited: its Markdown in a
// textarea, the caret where the click was, until the textarea loses focus or Esc is pressed. The textarea
// stays while the wording is emptied, and closes while Auto Analyze rewrites it.
class AnalysisContent extends React.Component {
  state = { editing: false }
  input = React.createRef()
  caret = null

  componentDidUpdate(prevProps, prevState) {
    if (this.state.editing && this.isWriting()) {
      this.setState({ editing: false })
      return
    }
    if (this.state.editing && !prevState.editing) {
      const el = this.input.current?.ref?.current
      if (el) {
        el.focus()
        const at = Math.min(this.caret ?? el.value.length, el.value.length)
        el.setSelectionRange?.(at, at)
      }
    }
  }

  isWriting = () => this.props.pending?.kind === 'analysis' && !this.props.pending.error

  canEdit = () => this.props.mode === 'edit' && typeof this.props.onTextChange === 'function' && !this.isWriting()

  startEditing = (caret) => {
    if (!this.canEdit()) return
    this.caret = caret
    this.setState({ editing: true })
  }

  stopEditing = () => this.setState({ editing: false })

  onWordingClick = (e) => {
    // A drag that selected some of the wording is someone copying it.
    const selection = window.getSelection?.()
    if (selection && !selection.isCollapsed && String(selection)) return
    const markdown = toAnalysisMarkdown(this.props.block.text)
    const before = renderedTextBefore(e.currentTarget, e.clientX, e.clientY)
    this.startEditing(before == null ? markdown.length : sourceOffsetAfter(markdown, before))
  }

  onWordingKeyDown = (e) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) {
      e.preventDefault()
      this.startEditing(null)
    }
  }

  onInputKeyDown = (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    // Back to the block, so the keyboard carries on from there; leaving the textarea ends the editing.
    const block = e.currentTarget.closest?.('[data-block-id]')
    if (block) block.focus()
    else e.currentTarget.blur()
  }

  render() {
    const { block, view, mode } = this.props
    const writing = this.isWriting()
    const editing = this.state.editing && mode === 'edit'
    if (!editing && (!view || view.state !== 'written')) {
      if (mode !== 'edit') {
        return null
      }
      return (
        <Placeholder title={STRINGS.analysis.emptyTitle}>
          {writing
            ? STRINGS.analysis.writing
            : view?.canAnalyze
            ? STRINGS.analysis.emptyReady
            : STRINGS.analysis.emptyBody}
        </Placeholder>
      )
    }
    const meta = [
      STRINGS.analysis.source,
      view?.fromTitle ? STRINGS.analysis.from(view.fromTitle) : null,
      view?.focusUsed ? STRINGS.analysis.focus(view.focusUsed) : null,
    ]
      .filter(Boolean)
      .join(' · ')
    let wording
    if (editing) {
      wording = (
        <AutoGrowTextarea
          ref={this.input}
          className={`${RB}-analysis-input`}
          value={toAnalysisMarkdown(block.text)}
          aria-label={STRINGS.panel.wording}
          data-test='report-builder-analysis-edit'
          onChange={this.props.onTextChange}
          onBlur={this.stopEditing}
          onKeyDown={this.onInputKeyDown}
        />
      )
    } else if (this.canEdit()) {
      wording = (
        <div
          className={`${RB}-analysis-body`}
          data-editable=''
          tabIndex={0}
          title={STRINGS.analysis.edit}
          data-test='report-builder-analysis-wording'
          onClick={this.onWordingClick}
          onKeyDown={this.onWordingKeyDown}
        >
          <AnalysisText text={view.text} />
        </div>
      )
    } else {
      wording = <AnalysisText text={view.text} />
    }
    return (
      <div
        className={`${RB}-analysis`}
        style={textStyleOf(block.style)}
        data-writing={writing || undefined}
        data-editing={editing || undefined}
      >
        {wording}
        <div className={`${RB}-analysis-meta`}>✦ {meta}</div>
        {editing ? <div className={`${RB}-analysis-hint`}>{STRINGS.analysis.editingNote}</div> : null}
        {mode === 'edit' && view && (view.targetGone || view.targetChanged) ? (
          <div className={`${RB}-analysis-note`}>
            {view.targetGone ? STRINGS.analysis.targetGone : STRINGS.analysis.targetChanged}
          </div>
        ) : null}
      </div>
    )
  }
}

const PageBreakContent = ({ mode }) =>
  mode === 'edit' ? (
    <div className={`${RB}-page-break`} role='separator'>
      <span>{STRINGS.pageBreak}</span>
    </div>
  ) : null

export const PaperBlock = ({ block, mode = 'page', onTextChange, ...rest }) => {
  switch (block.type) {
    case 'heading':
      return <HeadingContent block={block} mode={mode} onTextChange={onTextChange} />
    case 'text':
      return <TextContent block={block} mode={mode} onTextChange={onTextChange} />
    case 'data':
      return <DataContent block={block} mode={mode} {...rest} />
    case 'analysis':
      return (
        <AnalysisContent
          block={block}
          view={rest.view}
          mode={mode}
          pending={rest.pending}
          onTextChange={onTextChange}
        />
      )
    case 'pagebreak':
      return <PageBreakContent mode={mode} />
    default:
      // A block from a newer version is kept in the report as it is. The editor shows it, so it can be
      // found and removed; it doesn't print.
      return mode === 'edit' ? <Placeholder>{STRINGS.panel.unknownNote}</Placeholder> : null
  }
}
