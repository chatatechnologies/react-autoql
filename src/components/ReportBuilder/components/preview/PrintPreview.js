import React from 'react'
import { deepEqual } from 'autoql-fe-utils'
import { RB, TYPEFACES } from '../../constants'
import { STRINGS } from '../../strings'
import { getPageGeometry } from '../../layout/pageGeometry'
import {
  buildLayoutItems,
  estimateMeasurements,
  getHeadingPages,
  groupIntoRows,
  isPrintable,
  paginate,
} from '../../layout/paginate'
import { readMeasurements } from '../../layout/measure'
import { loadFontStack, waitForFonts } from '../../print/fonts'
import { PAGE_CLASS } from '../../print/printFrame'
import { formatPrintedDate } from '../../run/reportRun'
import { boxStyleOf, Continued, PaperBlock } from '../PaperBlock'
import { footerText, hasDataBlocks, RunningFooter, RunningHeader } from '../PageFurniture'
import { CoverPage, TableOfContents } from './FrontMatter'

// True Letter pages. Every printable block is first laid out offscreen at the page's content width
// (after fonts load) and measured; paginate() turns the heights into pages, which are then drawn at full
// size. Where there's no layout to measure (jsdom, a hidden container), estimated heights are used.

const nextFrame = () =>
  new Promise((resolve) =>
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => resolve()) : setTimeout(resolve, 0),
  )

const Cell = ({ block, children, measureId, split }) => (
  <div
    className={`${RB}-cell`}
    data-width={block.type === 'pagebreak' ? 'full' : block.width}
    data-measure-id={measureId}
    data-measure-split={split ? '' : undefined}
  >
    <div className={`${RB}-block-box`} data-type={block.type} style={boxStyleOf(block.style)}>
      {children}
    </div>
  </div>
)

// Every printable block, laid out as a page lays it out, for measuring. Charts are empty boxes of their
// fixed height, so measuring never draws a chart.
const LayoutMeasurer = React.forwardRef(function LayoutMeasurer(
  { blocks, views, geometry, fontFamily, paperProps },
  ref,
) {
  const rows = groupIntoRows(blocks.filter(isPrintable))
  return (
    <div
      ref={ref}
      className={`${RB}-paper ${RB}-measurer`}
      aria-hidden='true'
      style={{ width: geometry.contentWidthPx, fontFamily }}
    >
      {rows.map((row) => (
        <div key={row[0].id} className={`${RB}-row`} data-count={row.length}>
          {row.map((block) => (
            <Cell
              key={block.id}
              block={block}
              measureId={block.id}
              split={row.length === 1 && !!views[block.id]?.split}
            >
              <PaperBlock block={block} view={views[block.id]} mode='measure' {...paperProps} />
            </Cell>
          ))}
        </div>
      ))}
      <div className={`${RB}-flow`} data-measure-continued=''>
        <Continued />
      </div>
    </div>
  )
})

export class PrintPreview extends React.Component {
  static defaultProps = {
    onLayout: () => {},
  }

  measurerRef = React.createRef()
  pagesRef = React.createRef()
  layoutToken = 0
  state = { measuring: true, contentPages: null }

  componentDidMount() {
    this.mounted = true
    this.readyPromise = new Promise((resolve) => (this.resolveReady = resolve))
    this.layout()
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.report !== this.props.report ||
      prevProps.views !== this.props.views ||
      !deepEqual(prevProps.dataFormatting, this.props.dataFormatting)
    ) {
      this.layout()
    }
  }

  componentWillUnmount() {
    this.mounted = false
    this.layoutToken += 1
  }

  getGeometry = () => getPageGeometry(this.props.report.page)

  getFontFamily = () => TYPEFACES[this.props.report.page.typeface]?.stack || undefined

  // Resolves once the latest layout has been drawn as pages.
  whenReady = () => this.readyPromise

  getPagesElement = () => this.pagesRef.current

  getPageElements = () => Array.from(this.pagesRef.current?.querySelectorAll(`.${PAGE_CLASS}`) || [])

  layout = () => {
    const token = ++this.layoutToken
    if (!this.state.measuring) {
      this.readyPromise = new Promise((resolve) => (this.resolveReady = resolve))
    }
    this.setState({ measuring: true }, async () => {
      await loadFontStack(this.getFontFamily())
      await waitForFonts()
      await nextFrame()
      if (!this.mounted || token !== this.layoutToken) return

      const { report, views } = this.props
      const geometry = this.getGeometry()
      const measurements =
        readMeasurements(this.measurerRef.current) ||
        estimateMeasurements({ blocks: report.blocks, views, contentWidthPx: geometry.contentWidthPx })
      const items = buildLayoutItems({ blocks: report.blocks, views, measurements })
      const contentPages = paginate(items, {
        contentHeight: geometry.contentHeightPx,
        repeatTableHeaders: report.page.repeatTableHeaders,
      })

      this.setState({ measuring: false, contentPages }, () => {
        if (!this.mounted || token !== this.layoutToken) return
        this.props.onLayout(this.getLayoutInfo())
        this.resolveReady()
      })
    })
  }

  getFrontMatter = () => {
    const { report } = this.props
    const headings = report.blocks.filter((block) => block.type === 'heading' && isPrintable(block))
    return {
      cover: !!report.page.coverPage,
      toc: !!report.page.tableOfContents && headings.length > 0,
      headings,
    }
  }

  getLayoutInfo = () => {
    const { cover, toc } = this.getFrontMatter()
    const contentPages = this.state.contentPages || []
    return {
      pageCount: contentPages.length + (cover ? 1 : 0) + (toc ? 1 : 0),
      overflowCount: contentPages.filter((page) => page.overflow).length,
    }
  }

  renderPage = ({ key, number, total, header = true, footer = true, overflow = false, children }) => {
    const { report, branding, runAt, generatedAt } = this.props
    const geometry = this.getGeometry()
    const inches = (n) => `${n}in`
    const showHeader = header && geometry.headerIn > 0
    const showFooter = footer && geometry.footerIn > 0
    const left = report.page.footer
      ? footerText({
          generated: formatPrintedDate(generatedAt),
          dataAsOf: runAt ? formatPrintedDate(runAt, { time: true }) : null,
          hasData: this.props.canRun && hasDataBlocks(report),
        })
      : ''
    const right = report.page.pageNumbers ? STRINGS.preview.page(number, total) : ''

    return (
      <div key={key} className={`${RB}-page-frame`}>
        <span className={`${RB}-page-label`} aria-hidden='true'>
          {number}
        </span>
        <div
          className={`${PAGE_CLASS} ${RB}-paper`}
          data-orientation={geometry.orientation}
          style={{
            width: inches(geometry.widthIn),
            height: inches(geometry.heightIn),
            padding: inches(geometry.marginIn),
            fontFamily: this.getFontFamily(),
          }}
        >
          {showHeader ? (
            <div className={`${RB}-page-header`} style={{ height: inches(geometry.headerIn) }}>
              <RunningHeader branding={branding} title={report.title} />
            </div>
          ) : null}
          <div
            className={`${RB}-page-content`}
            style={{
              height: inches(
                geometry.contentHeightIn + (header ? 0 : geometry.headerIn) + (footer ? 0 : geometry.footerIn),
              ),
            }}
          >
            {children}
          </div>
          {showFooter ? (
            <div className={`${RB}-page-footer`} style={{ height: inches(geometry.footerIn) }}>
              <RunningFooter left={left} right={right} />
            </div>
          ) : null}
        </div>
        {overflow ? (
          <span className={`${RB}-page-overflow`} role='note'>
            {STRINGS.preview.overflow}
          </span>
        ) : null}
      </div>
    )
  }

  renderCells = (page) => {
    const { report, views, dataFormatting, authentication, autoQLConfig } = this.props
    const byId = {}
    report.blocks.forEach((block) => {
      byId[block.id] = block
    })
    const paperProps = {
      showInterpretation: report.page.showInterpretation,
      dataFormatting,
      authentication,
      autoQLConfig,
      canRun: this.props.canRun,
    }

    return page.cells.map((cell) => {
      if (cell.kind === 'table') {
        const block = byId[cell.id]
        if (!block) return null
        return (
          <div key={`${cell.id}:${cell.from}`} className={`${RB}-row`} data-count={1}>
            <Cell block={block}>
              <PaperBlock block={block} view={views[block.id]} mode='page' piece={cell} {...paperProps} />
            </Cell>
          </div>
        )
      }
      const blocks = cell.ids.map((id) => byId[id]).filter(Boolean)
      return (
        <div key={cell.ids.join('+')} className={`${RB}-row`} data-count={blocks.length}>
          {blocks.map((block) => (
            <Cell key={block.id} block={block}>
              <PaperBlock block={block} view={views[block.id]} mode='page' {...paperProps} />
            </Cell>
          ))}
        </div>
      )
    })
  }

  renderPages = () => {
    const { report, branding, runAt, generatedAt } = this.props
    const contentPages = this.state.contentPages || []
    const { cover, toc, headings } = this.getFrontMatter()
    const front = (cover ? 1 : 0) + (toc ? 1 : 0)
    const total = front + contentPages.length
    const pages = []

    if (cover) {
      pages.push(
        this.renderPage({
          key: 'cover',
          number: 1,
          total,
          header: false,
          footer: false,
          children: (
            <CoverPage
              title={report.title}
              branding={branding}
              generated={formatPrintedDate(generatedAt)}
              dataAsOf={runAt ? formatPrintedDate(runAt, { time: true }) : ''}
              hasData={this.props.canRun && hasDataBlocks(report)}
            />
          ),
        }),
      )
    }
    if (toc) {
      const headingPages = getHeadingPages(contentPages, headings)
      const entries = headings.map((block) => ({
        id: block.id,
        text: block.text,
        level: block.level,
        page: headingPages[block.id] != null ? headingPages[block.id] + front : '',
      }))
      pages.push(
        this.renderPage({ key: 'toc', number: cover ? 2 : 1, total, children: <TableOfContents entries={entries} /> }),
      )
    }
    contentPages.forEach((page, index) => {
      pages.push(
        this.renderPage({
          key: `page-${index}`,
          number: front + index + 1,
          total,
          overflow: page.overflow,
          children: this.renderCells(page),
        }),
      )
    })
    return pages
  }

  render() {
    const { report, views, dataFormatting, authentication, autoQLConfig } = this.props
    const geometry = this.getGeometry()
    const { measuring, contentPages } = this.state

    return (
      <div className={`${RB}-preview`} data-test='report-builder-preview'>
        {measuring ? (
          <LayoutMeasurer
            ref={this.measurerRef}
            blocks={report.blocks}
            views={views}
            geometry={geometry}
            fontFamily={this.getFontFamily()}
            paperProps={{
              showInterpretation: report.page.showInterpretation,
              dataFormatting,
              authentication,
              autoQLConfig,
              canRun: this.props.canRun,
            }}
          />
        ) : null}
        <div className={`${RB}-preview-pages`} ref={this.pagesRef} data-measuring={measuring || undefined}>
          {contentPages ? (
            this.renderPages()
          ) : (
            <div className={`${RB}-preview-status`}>{STRINGS.preview.measuring}</div>
          )}
        </div>
      </div>
    )
  }
}
