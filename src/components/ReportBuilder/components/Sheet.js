import React from 'react'
import { BLOCK_INFO, RB, TYPEFACES } from '../constants'
import { STRINGS } from '../strings'
import { groupIntoRows } from '../layout/paginate'
import { Icon } from './icons'
import { boxStyleOf, PaperBlock } from './PaperBlock'
import { getAnalysisBlocker } from '../model/analysis'
import { RunningFooter, RunningHeader } from './PageFurniture'

const BlockTools = ({ id, isFirst, isLast, onAction, onAnalyze }) => (
  <div className={`${RB}-block-tools`} role='toolbar' aria-label={STRINGS.panel.block}>
    {onAnalyze ? (
      <>
        <button
          type='button'
          title={STRINGS.analyzeResult}
          aria-label={STRINGS.analyzeResult}
          data-accent=''
          data-test='report-builder-analyze-result'
          onClick={onAnalyze}
        >
          <Icon name='analysis' />
        </button>
        <span className={`${RB}-block-tools-sep`} />
      </>
    ) : null}
    <button
      type='button'
      title={STRINGS.moveUp}
      aria-label={STRINGS.moveUp}
      disabled={isFirst}
      onClick={() => onAction(id, 'up')}
    >
      <Icon name='up' />
    </button>
    <button
      type='button'
      title={STRINGS.moveDown}
      aria-label={STRINGS.moveDown}
      disabled={isLast}
      onClick={() => onAction(id, 'down')}
    >
      <Icon name='down' />
    </button>
    <button
      type='button'
      title={STRINGS.duplicate}
      aria-label={STRINGS.duplicate}
      onClick={() => onAction(id, 'duplicate')}
    >
      <Icon name='duplicate' />
    </button>
    <button
      type='button'
      title={STRINGS.remove}
      aria-label={STRINGS.remove}
      data-danger=''
      onClick={() => onAction(id, 'remove')}
    >
      <Icon name='remove' />
    </button>
  </div>
)

export const EditorBlock = React.memo(function EditorBlock({
  block,
  view,
  selected,
  isFirst,
  isLast,
  onSelect,
  onAction,
  onText,
  onAsk,
  onPickTiles,
  onAnalyzeResult,
  onChartChange,
  ...paperProps
}) {
  const label = BLOCK_INFO[block.type]?.label || block.type
  const select = () => {
    if (!selected) onSelect(block.id)
  }
  // Only a result Auto Analyze can write about offers it: kept with the answer's query id, and one the magic
  // wand is offered on elsewhere.
  const analyzable =
    !!onAnalyzeResult && block.type === 'data' && !getAnalysisBlocker({ target: block, targetView: view })
  return (
    <div
      className={`${RB}-block`}
      data-block-id={block.id}
      data-type={block.type}
      data-width={block.type === 'pagebreak' ? 'full' : block.width}
      data-selected={selected || undefined}
      style={boxStyleOf(block.style)}
      role='group'
      aria-label={label}
      tabIndex={['data', 'analysis', 'pagebreak'].includes(block.type) ? 0 : undefined}
      onMouseDown={select}
      onFocus={select}
    >
      {selected ? <span className={`${RB}-block-tag`}>{label}</span> : null}
      {selected ? (
        <BlockTools
          id={block.id}
          isFirst={isFirst}
          isLast={isLast}
          onAction={onAction}
          onAnalyze={analyzable ? () => onAnalyzeResult(block.id) : undefined}
        />
      ) : null}
      <PaperBlock
        block={block}
        view={view}
        mode='edit'
        onTextChange={(text) => onText(block.id, text)}
        onAsk={(query) => onAsk(block.id, query)}
        onPickTiles={onPickTiles ? () => onPickTiles(block.id) : undefined}
        onChartChange={onChartChange ? (patch) => onChartChange(block.id, patch) : undefined}
        {...paperProps}
      />
    </div>
  )
})

const frontMatterNote = (page) => {
  if (page.coverPage && page.tableOfContents) return STRINGS.frontMatter.both
  if (page.coverPage) return STRINGS.frontMatter.cover
  if (page.tableOfContents) return STRINGS.frontMatter.toc
  return null
}

// The page each row of blocks is on: the page its first printable block starts on in print. A row that
// doesn't print (an empty heading, an unfilled Data block) stays on the page before it.
export const rowPagesOf = (rows, startPages) => {
  let current = 0
  return rows.map((row) => {
    const starts = row.map((block) => startPages[block.id]).filter((page) => page != null)
    if (starts.length) {
      current = Math.max(current, Math.min(...starts))
    }
    return current
  })
}

// The blank space that ends each page so that it's a page tall: `starts` and `ends` are where each page's
// content begins and where its blocks end, in pixels down the sheet. A page whose blocks need more room (a
// table kept whole here, though it flows on in print) just grows.
export const pageFills = ({ starts, ends, contentHeight }) =>
  ends.map((end, index) => Math.max(0, Math.floor(contentHeight - (end - (starts[index] ?? 0)))))

// The white pages drawn behind the blocks, one per page: each from where the gap before it ends to where the
// gap after it starts, the sheet's top and bottom at either end. `gaps` are the gaps' tops and heights, in
// pixels down the sheet. None without a gap: one page is the sheet itself.
export const pagePlates = ({ gaps, sheetHeight }) => {
  if (!gaps.length) {
    return []
  }
  const plates = []
  let top = 0
  gaps.forEach((gap) => {
    plates.push({ top, height: Math.max(0, gap.top - top) })
    top = gap.top + gap.height
  })
  plates.push({ top, height: Math.max(0, sheetHeight - top) })
  return plates
}

const samePlates = (a, b) =>
  a.length === b.length && a.every((plate, index) => plate.top === b[index].top && plate.height === b[index].height)

const offsetTopIn = (el, ancestor) => {
  let top = 0
  for (let node = el; node && node !== ancestor; node = node.offsetParent) {
    top += node.offsetTop
  }
  return top
}

// Where one page ends and the next begins: the rest of the page left blank, its footer and bottom margin,
// the space between the pages, then the next page's top margin and header.
const PageGap = ({ fill, footer, header, marginIn }) => (
  <div className={`${RB}-page-gap`} aria-hidden='true' data-test='report-builder-page-gap'>
    <div className={`${RB}-page-fill`} data-page-fill='' style={{ height: fill || 0 }} />
    {footer}
    <div className={`${RB}-page-gap-band`} data-page-gap-band='' style={{ margin: `${marginIn}in 0` }} />
    {header}
    <div data-page-start='' />
  </div>
)

// The editing surface, laid out at the page's true size (the builder's zoom fits it to the canvas). Once
// EditorPagination has laid the report out (`startPages`), it's shown as pages that break where the PDF
// breaks, each with its running header and footer; until then, and where nothing can be measured, it's
// one sheet. Blocks stay in one list either way, so moving to another page never remounts one: the pages
// are white plates drawn behind them, apart from each other as the preview's are. The print preview stays
// the source of truth for what prints.
export class Sheet extends React.Component {
  static defaultProps = {
    // Block id → the content page it starts on (getStartPages), or null for one sheet.
    startPages: null,
    // How many content pages, and how many print before them (cover, contents), for the page numbers.
    pageCount: 1,
    frontPages: 0,
  }

  sheetRef = React.createRef()
  blocksRef = React.createRef()
  state = { fills: [], plates: [] }

  componentDidMount() {
    this.measureFills()
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.measureFills())
      if (this.blocksRef.current) {
        this.observer.observe(this.blocksRef.current)
        this.observed = this.blocksRef.current
      }
    }
  }

  componentDidUpdate() {
    if (this.blocksRef.current && this.observed !== this.blocksRef.current) {
      this.observer?.disconnect()
      this.observer?.observe(this.blocksRef.current)
      this.observed = this.blocksRef.current
    }
    this.measureFills()
  }

  componentWillUnmount() {
    this.observer?.disconnect()
  }

  // Sizes each page's blank end from where its content actually sits, and the white plate behind each page
  // from where the gaps between pages are (layout sizes, which the zoom's transform doesn't change). Nothing
  // is plated where nothing is laid out.
  measureFills = () => {
    const sheet = this.sheetRef.current
    const blocksEl = this.blocksRef.current
    if (!sheet || !blocksEl || !this.props.startPages) {
      return
    }
    const starts = [
      offsetTopIn(blocksEl, sheet),
      ...Array.from(blocksEl.querySelectorAll('[data-page-start]'), (el) => offsetTopIn(el, sheet)),
    ]
    const ends = Array.from(blocksEl.querySelectorAll('[data-page-fill]'), (el) => offsetTopIn(el, sheet))
    const fills = pageFills({ starts, ends, contentHeight: this.props.geometry.contentHeightPx })
    const gaps = Array.from(blocksEl.querySelectorAll('[data-page-gap-band]'), (el) => ({
      top: offsetTopIn(el, sheet),
      height: el.offsetHeight,
    }))
    const plates = sheet.offsetHeight > 0 ? pagePlates({ gaps, sheetHeight: sheet.offsetHeight }) : []
    const current = this.state.fills
    const fillsChanged = fills.length !== current.length || fills.some((fill, index) => fill !== current[index])
    const platesChanged = !samePlates(plates, this.state.plates)
    if (fillsChanged || platesChanged) {
      this.setState({ ...(fillsChanged ? { fills } : null), ...(platesChanged ? { plates } : null) })
    }
  }

  render() {
    const {
      report,
      views,
      selectedId,
      geometry,
      branding,
      footerLeft,
      startPages,
      pageCount,
      frontPages,
      onSelect,
      onAction,
      onText,
      onAsk,
      dataFormatting,
      authentication,
      autoQLConfig,
      canRun,
      canCapture,
      onPickTiles,
      onAnalyzeResult,
      onChartChange,
      pending,
    } = this.props
    const { fills, plates } = this.state
    const { page, blocks } = report
    const stack = TYPEFACES[page.typeface]?.stack
    const note = frontMatterNote(page)
    const rows = groupIntoRows(blocks)
    const lastIndex = blocks.length - 1
    const paged = !!startPages && rows.length > 0
    const plated = paged && plates.length > 0
    const rowPages = paged ? rowPagesOf(rows, startPages) : rows.map(() => 0)
    const total = frontPages + Math.max(1, pageCount)

    // The running header and footer as a page prints them, in boxes of their printed height.
    const header =
      geometry.headerIn > 0 ? (
        <div className={`${RB}-page-header`} style={{ height: `${geometry.headerIn}in` }}>
          <RunningHeader branding={branding} title={report.title} />
        </div>
      ) : null
    const footerOf = (contentPage) =>
      geometry.footerIn > 0 ? (
        <div className={`${RB}-page-footer`} style={{ height: `${geometry.footerIn}in` }}>
          <RunningFooter
            left={page.footer ? footerLeft : ''}
            right={page.pageNumbers && paged ? STRINGS.preview.page(frontPages + contentPage + 1, total) : ''}
          />
        </div>
      ) : null

    let pageIndex = 0

    return (
      <div
        ref={this.sheetRef}
        className={`${RB}-paper ${RB}-sheet`}
        data-orientation={geometry.orientation}
        data-paged={paged || undefined}
        data-plated={plated || undefined}
        // Its true width in either orientation; the builder's zoom (ZoomFrame) fits it to the canvas.
        style={{ width: `${geometry.widthIn}in`, padding: `${geometry.marginIn}in`, fontFamily: stack || undefined }}
      >
        {plated
          ? plates.map((plate, index) => (
              <div
                key={index}
                className={`${RB}-page-plate`}
                aria-hidden='true'
                data-test='report-builder-page-plate'
                style={{ top: plate.top, height: plate.height }}
              />
            ))
          : null}
        {note ? (
          <div
            className={`${RB}-front-matter-note`}
            style={{
              top: `${geometry.marginIn / 2}in`,
              left: `${geometry.marginIn}in`,
              right: `${geometry.marginIn}in`,
            }}
          >
            {note}
          </div>
        ) : null}
        {header}

        {blocks.length ? (
          <div ref={this.blocksRef} className={`${RB}-sheet-blocks`}>
            {rows.map((row, rowIndex) => {
              const breaksBefore = paged && rowIndex > 0 && rowPages[rowIndex] > rowPages[rowIndex - 1]
              const ending = breaksBefore ? pageIndex++ : null
              return (
                <React.Fragment key={row[0].id}>
                  {breaksBefore ? (
                    <PageGap
                      fill={fills[ending]}
                      footer={footerOf(rowPages[rowIndex - 1])}
                      header={header}
                      marginIn={geometry.marginIn}
                    />
                  ) : null}
                  <div className={`${RB}-row`} data-count={row.length}>
                    {row.map((block) => {
                      const index = blocks.indexOf(block)
                      return (
                        <EditorBlock
                          key={block.id}
                          block={block}
                          view={views[block.id]}
                          selected={block.id === selectedId}
                          isFirst={index === 0}
                          isLast={index === lastIndex}
                          onSelect={onSelect}
                          onAction={onAction}
                          onText={onText}
                          onAsk={onAsk}
                          showInterpretation={page.showInterpretation}
                          dataFormatting={dataFormatting}
                          authentication={authentication}
                          autoQLConfig={autoQLConfig}
                          canRun={canRun}
                          canCapture={canCapture}
                          onPickTiles={onPickTiles}
                          onAnalyzeResult={onAnalyzeResult}
                          onChartChange={onChartChange}
                          // Its own entry only: the block is memoized.
                          pending={pending?.[block.id]}
                        />
                      )
                    })}
                  </div>
                </React.Fragment>
              )
            })}
            {paged ? (
              <div className={`${RB}-page-fill`} data-page-fill='' style={{ height: fills[pageIndex] || 0 }} />
            ) : null}
          </div>
        ) : (
          <div className={`${RB}-empty-report`}>
            <div className={`${RB}-empty-report-title`}>{STRINGS.emptyReportTitle}</div>
            <p>{STRINGS.emptyReportBody}</p>
          </div>
        )}

        {footerOf(rowPages[rowPages.length - 1] ?? 0)}
      </div>
    )
  }
}
