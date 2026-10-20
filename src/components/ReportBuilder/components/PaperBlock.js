import React from 'react'
import { formatElement, getDataFormatting } from 'autoql-fe-utils'
import { RB, TEXT_SIZES, TEXT_WEIGHTS, TYPEFACES } from '../constants'
import { STRINGS } from '../strings'
import { LoadingDots } from '../../LoadingDots'
import { ReportTable } from './ReportTable'
import { ReportChart } from './ReportChart'
import { AutoGrowTextarea } from './AutoGrowTextarea'
import { RichTextEditor, RichTextView } from './RichText'
import { formatPrintedDate } from '../run/reportRun'
import { toAnalysisMarkdown } from '../model/analysis'
import { isMacKeyboard } from '../keyboard'

// The content of one block, on paper. The editor sheet, the offscreen measurer and the printed pages all
// render blocks through this, so what is measured is what prints.
//   mode 'edit'     headings, text and an analysis's wording are editable; empty and unfinished blocks explain
//                   themselves
//   mode 'measure'  charts are empty boxes of their final height (their height is fixed, so nothing is lost)
//   mode 'page'     a table may be one piece of a table split across pages, and a text or an analysis one
//                   piece of a text taller than a page

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

// Enter ends editing a heading, as in a one-line box; Shift+Enter puts a line break in it. Not while an input
// method is composing, where Enter picks the characters.
const endHeadingOnEnter = (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
    e.preventDefault()
    e.currentTarget.blur()
  }
}

const HeadingContent = ({ block, mode, onTextChange }) => {
  const style = textStyleOf(block.style)
  if (mode === 'edit') {
    const hintId = `${RB}-heading-hint-${block.id}`
    return (
      <div className={`${RB}-heading-edit`}>
        <AutoGrowTextarea
          className={`${RB}-heading`}
          data-level={block.level}
          style={style}
          value={block.text}
          placeholder={STRINGS.headingPlaceholder}
          aria-label={STRINGS.headingPlaceholder}
          aria-describedby={hintId}
          onChange={onTextChange}
          onKeyDown={endHeadingOnEnter}
        />
        {/* Under it while it's typed in, since nobody would guess it: how to put a line break in. Never printed;
            read out as the heading box's description. */}
        <div id={hintId} className={`${RB}-heading-hint`} aria-hidden='true' data-test='report-builder-heading-hint'>
          {STRINGS.headingNewLine(isMacKeyboard())}
        </div>
      </div>
    )
  }
  return (
    <div className={`${RB}-heading`} data-level={block.level} style={style} role='heading' aria-level={block.level + 1}>
      {block.text}
    </div>
  )
}

// A paragraph's text, formatted (RW-346): edited in place, with the formatting bar on top of its block. On a page,
// `piece` is the share of a text taller than a page that this page shows (layout/paginate).
const TextContent = ({ block, mode, onTextChange, piece }) => {
  const style = textStyleOf(block.style)
  if (mode === 'edit') {
    return (
      <RichTextEditor
        className={`${RB}-text`}
        style={style}
        value={block.text}
        placeholder={STRINGS.textPlaceholder}
        label={STRINGS.textPlaceholder}
        testId='report-builder-text-input'
        onChange={onTextChange}
      />
    )
  }
  return (
    <RichTextView className={`${RB}-text`} style={style} markdown={block.text} from={piece?.from} to={piece?.to} />
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
          // AutoQL's loading dots where the question box was, as while an answer comes back in the Data
          // Messenger; what it's asking is still read out.
          <div className={`${RB}-asking`} role='status' data-test='report-builder-asking'>
            <LoadingDots />
            <span className={`${RB}-sr-only`}>{STRINGS.data.asking(question.query)}</span>
          </div>
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

// A result without an interpretation (a dashboard tile's answer has none) shows none, on the page as in
// print; the properties panel's note on "Show how each question was read" says why.
const Tail = ({ caption, interpretation }) => (
  <div className={`${RB}-flow`} data-measure-tail=''>
    {caption ? <div className={`${RB}-caption`}>{caption}</div> : null}
    {interpretation ? (
      <div className={`${RB}-interpretation`}>
        <b>{STRINGS.data.interpretedAs}</b> {interpretation}
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
  onChartChange,
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
        {isLast ? <Tail caption={captionOf(view)} interpretation={interpretation} /> : <Continued />}
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
        <Tail caption={captionOf(view)} interpretation={interpretation} />
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
          // Its axes can be changed in the editor only; the pages print what was chosen.
          onConfigChange={mode === 'edit' ? onChartChange : undefined}
        />
      )}
      <Tail caption={captionOf(view)} interpretation={interpretation} />
    </div>
  )
}

// An analysis's wording: Auto Analyze's Markdown, formatted as it prints. In the editor it's edited where it
// sits, as a paragraph is, with the formatting bar; it stays in edit while it's being emptied, and goes back to
// the page while Auto Analyze rewrites it.
class AnalysisContent extends React.Component {
  state = { editing: false }

  isWriting = () => this.props.pending?.kind === 'analysis' && !this.props.pending.error

  canEdit = () => this.props.mode === 'edit' && typeof this.props.onTextChange === 'function' && !this.isWriting()

  render() {
    const { block, view, mode, piece } = this.props
    const writing = this.isWriting()
    const written = view?.state === 'written'
    const editing = this.canEdit() && (written || this.state.editing)
    if (!editing && !written) {
      if (mode !== 'edit') {
        return null
      }
      return (
        <Placeholder title={STRINGS.analysis.emptyTitle}>
          {writing
            ? STRINGS.analysis.writing
            : view?.canAnalyze
            ? STRINGS.analysis.emptyReady
            : view?.blocker === 'too-little' || view?.blocker === 'no-query-id'
            ? STRINGS.analysis.emptyBlocked
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
    return (
      <div
        className={`${RB}-analysis`}
        style={textStyleOf(block.style)}
        data-writing={writing || undefined}
        data-editing={(editing && this.state.editing) || undefined}
      >
        {editing ? (
          <RichTextEditor
            className={`${RB}-analysis-text`}
            value={toAnalysisMarkdown(block.text)}
            label={STRINGS.panel.wording}
            testId='report-builder-analysis-edit'
            onChange={this.props.onTextChange}
            onFocus={() => this.setState({ editing: true })}
            onBlur={() => this.setState({ editing: false })}
          />
        ) : (
          <RichTextView
            className={`${RB}-analysis-text`}
            markdown={toAnalysisMarkdown(view.text)}
            from={piece?.from}
            to={piece?.to}
          />
        )}
        {/* An analysis split across pages says where it's from once, at its end. */}
        {!piece || piece.isLast ? <div className={`${RB}-analysis-meta`}>✦ {meta}</div> : null}
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
      return <TextContent block={block} mode={mode} onTextChange={onTextChange} piece={rest.piece} />
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
          piece={rest.piece}
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
