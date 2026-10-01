import React from 'react'
import { deepEqual } from 'autoql-fe-utils'
import { TYPEFACES } from '../constants'
import { getPageGeometry } from '../layout/pageGeometry'
import { LayoutMeasurer, measureContentPages } from './preview/PrintPreview'

// How long the editor waits after an edit before laying the pages out again.
const DEBOUNCE_MS = 250

// Where the editor's pages break: the report's printable blocks laid out offscreen exactly as the preview
// lays them out, and put onto pages by the same rules, so the editor's pages break where the PDF does.
// Calls onPages with the content pages (paginate's), after each change has settled. Renders only the
// measurer, which must sit outside the zoom (ZoomFrame) so it measures true sizes. It starts once the space
// it's in has a size, so where nothing can be laid out (jsdom, a builder still hidden) there's no measurer
// and nothing is reported; the editor then shows one sheet.
export class EditorPagination extends React.Component {
  static defaultProps = {
    onPages: () => {},
    debounceMs: DEBOUNCE_MS,
  }

  anchorRef = React.createRef()
  measurerRef = React.createRef()
  token = 0
  state = { active: false }

  componentDidMount() {
    this.mounted = true
    if (!this.activateIfLaidOut() && typeof ResizeObserver !== 'undefined') {
      const space = this.anchorRef.current?.parentElement
      if (space) {
        this.spaceObserver = new ResizeObserver(() => this.activateIfLaidOut())
        this.spaceObserver.observe(space)
      }
    }
  }

  activateIfLaidOut = () => {
    const space = this.anchorRef.current?.parentElement
    if (this.state.active || !space || !(space.getBoundingClientRect().width > 0)) {
      return this.state.active
    }
    this.spaceObserver?.disconnect()
    this.setState({ active: true }, () => this.schedule(0))
    return true
  }

  // The measurer only changes with the report.
  shouldComponentUpdate(nextProps, nextState) {
    return (
      nextState.active !== this.state.active ||
      nextProps.report !== this.props.report ||
      nextProps.views !== this.props.views ||
      nextProps.canRun !== this.props.canRun ||
      !deepEqual(nextProps.dataFormatting, this.props.dataFormatting)
    )
  }

  componentDidUpdate(prevProps) {
    if (!this.state.active) {
      return
    }
    if (
      prevProps.report !== this.props.report ||
      prevProps.views !== this.props.views ||
      !deepEqual(prevProps.dataFormatting, this.props.dataFormatting)
    ) {
      this.schedule(this.props.debounceMs)
    }
  }

  componentWillUnmount() {
    this.mounted = false
    this.token += 1
    clearTimeout(this.timer)
    this.spaceObserver?.disconnect()
  }

  schedule = (ms) => {
    clearTimeout(this.timer)
    this.timer = setTimeout(this.layout, ms)
  }

  layout = async () => {
    const token = ++this.token
    const pages = await measureContentPages({
      report: this.props.report,
      views: this.props.views,
      measurer: () => this.measurerRef.current,
      isCurrent: () => this.mounted && token === this.token,
      estimate: false,
    })
    if (pages && this.mounted && token === this.token) {
      this.props.onPages(pages)
    }
  }

  render() {
    const { report, views, dataFormatting, authentication, autoQLConfig, canRun } = this.props
    if (!this.state.active) {
      return <span ref={this.anchorRef} hidden />
    }
    return (
      <LayoutMeasurer
        ref={this.measurerRef}
        blocks={report.blocks}
        views={views}
        geometry={getPageGeometry(report.page)}
        fontFamily={TYPEFACES[report.page.typeface]?.stack || undefined}
        paperProps={{
          showInterpretation: report.page.showInterpretation,
          dataFormatting,
          authentication,
          autoQLConfig,
          canRun,
        }}
      />
    )
  }
}
