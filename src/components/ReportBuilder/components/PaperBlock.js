import React from 'react'
import { formatElement, getDataFormatting } from 'autoql-fe-utils'
import { RB, TEXT_SIZES, TEXT_WEIGHTS, TYPEFACES } from '../constants'
import { STRINGS } from '../strings'
import { ReportTable } from './ReportTable'
import { ReportChart } from './ReportChart'
import { AutoGrowTextarea } from './AutoGrowTextarea'
import { formatPrintedDate } from '../run/reportRun'

// The content of one block, on paper. The editor sheet, the offscreen measurer and the printed pages all
// render blocks through this, so what is measured is what prints.
//   mode 'edit'     headings and text are editable; empty and unfinished data blocks explain themselves
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

const EmptyDataContent = ({ mode, onAsk, canRun }) => {
  if (mode !== 'edit') {
    return null
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
}) => {
  if (!view || view.state === 'empty') {
    return <EmptyDataContent mode={mode} onAsk={onAsk} canRun={canRun} />
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
        />
      )}
      <Tail caption={captionOf(view)} interpretation={interpretation} />
    </div>
  )
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
    case 'pagebreak':
      return <PageBreakContent mode={mode} />
    default:
      // A block from a newer version is kept in the report as it is. The editor shows it, so it can be
      // found and removed; it doesn't print.
      return mode === 'edit' ? <Placeholder>{STRINGS.panel.unknownNote}</Placeholder> : null
  }
}
