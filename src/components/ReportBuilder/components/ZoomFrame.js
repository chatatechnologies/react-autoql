import React from 'react'
import { RB } from '../constants'
import { MEASURE_SCALE_ATTRIBUTE } from '../../Charts/measureScale'

// The zoom a report's pages are shown at: FIT, or one of ZOOM_LEVELS. Remembered in this browser.
export const FIT = 'fit'
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5]
// Fit never shows a page above its true size, nor below this.
const MIN_FIT = 0.25

const ZOOM_KEY = 'react-autoql-report-builder-zoom'

export const readZoom = () => {
  try {
    const value = window.localStorage.getItem(ZOOM_KEY)
    const level = Number(value)
    return value !== null && ZOOM_LEVELS.includes(level) ? level : FIT
  } catch (error) {
    return FIT
  }
}

export const storeZoom = (zoom) => {
  try {
    window.localStorage.setItem(ZOOM_KEY, String(zoom))
  } catch (error) {
    // Blocked storage (a private window, say): the zoom just isn't remembered.
  }
}

// What fit comes to for content `width` wide in `available` pixels: whole percents, rounded down so the
// content always fits.
export const fitScale = (available, width) => {
  if (!(available > 0) || !(width > 0)) {
    return 1
  }
  return Math.max(MIN_FIT, Math.min(1, Math.floor((available / width) * 100) / 100))
}

// Shows its content at a zoom without changing its layout. The content keeps its true size (a page is as
// wide as the paper), a transform shrinks or enlarges it, and the frame takes the zoomed size so what's
// around it scrolls as it should. Fit makes the content as wide as the space the frame is in. Charts inside
// lay themselves out at true size: the transformed element carries data-react-autoql-scale
// (Charts/measureScale). Until something can be measured (and in jsdom), the content shows as it is.
export class ZoomFrame extends React.Component {
  static defaultProps = {
    zoom: FIT,
    // Called with what fit comes to, whenever that changes.
    onFit: undefined,
  }

  frameRef = React.createRef()
  contentRef = React.createRef()
  state = { available: 0, width: 0, height: 0 }

  componentDidMount() {
    this.measure()
    this.reportFit()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    this.observer = new ResizeObserver(() => this.measure())
    const container = this.frameRef.current?.parentElement
    if (container) {
      this.observer.observe(container)
    }
    if (this.contentRef.current) {
      this.observer.observe(this.contentRef.current)
    }
  }

  componentDidUpdate() {
    this.reportFit()
  }

  componentWillUnmount() {
    this.observer?.disconnect()
  }

  measure = () => {
    const content = this.contentRef.current
    const container = this.frameRef.current?.parentElement
    if (!content || !container) {
      return
    }
    const style = window.getComputedStyle(container)
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
    const available = container.clientWidth - padding
    // Layout sizes, which the transform doesn't change.
    const width = content.offsetWidth
    const height = content.offsetHeight
    if (available !== this.state.available || width !== this.state.width || height !== this.state.height) {
      this.setState({ available, width, height })
    }
  }

  reportFit = () => {
    const fit = fitScale(this.state.available, this.state.width)
    if (fit !== this.reportedFit) {
      this.reportedFit = fit
      this.props.onFit?.(fit)
    }
  }

  getScale = () => {
    const { available, width } = this.state
    if (!(available > 0) || !(width > 0)) {
      return 1
    }
    return this.props.zoom === FIT ? fitScale(available, width) : this.props.zoom
  }

  render() {
    const scale = this.getScale()
    const { width, height } = this.state
    const zoomed = scale !== 1 && width > 0 && height > 0
    const scaleProps = zoomed ? { [MEASURE_SCALE_ATTRIBUTE]: String(scale) } : {}

    return (
      <div
        ref={this.frameRef}
        className={`${RB}-zoom-frame`}
        style={zoomed ? { width: width * scale, height: height * scale } : undefined}
        data-test='report-builder-zoom-frame'
      >
        <div
          ref={this.contentRef}
          className={`${RB}-zoom-content`}
          style={zoomed ? { transform: `scale(${scale})` } : undefined}
          {...scaleProps}
        >
          {this.props.children}
        </div>
      </div>
    )
  }
}
