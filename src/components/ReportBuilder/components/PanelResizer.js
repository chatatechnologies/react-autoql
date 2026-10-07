import React from 'react'
import { RB } from '../constants'
import { STRINGS } from '../strings'

// The properties panel's left edge. Dragging it, or the arrow keys on it, widen the panel (Shift for bigger
// steps, Home and End for the narrowest and widest); a double-click gives the panel back its own width. It
// sits between the canvas and the panel. The builder keeps the width and remembers it in this browser.

const STEP = 16
const BIG_STEP = 64
// The panel's own width (15rem), for when it can't be measured.
const FALLBACK_MIN = 240
const MAX_PANEL_REM = 40
// Never so wide that the page gets less than this.
const MIN_CANVAS_REM = 25

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const PANEL_WIDTH_KEY = 'react-autoql-report-builder-panel-width'

// The width the panel was last left at in this browser, or null for its own width.
export const readPanelWidth = () => {
  try {
    const value = Number(window.localStorage.getItem(PANEL_WIDTH_KEY))
    return Number.isFinite(value) && value >= 100 && value <= 4000 ? value : null
  } catch (error) {
    return null
  }
}

export const storePanelWidth = (width) => {
  try {
    if (width == null) window.localStorage.removeItem(PANEL_WIDTH_KEY)
    else window.localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(width)))
  } catch (error) {
    // Blocked storage (a private window, say): the width just isn't remembered.
  }
}

export class PanelResizer extends React.Component {
  ref = React.createRef()
  drag = null
  state = { dragging: false }

  componentWillUnmount() {
    this.stopListening()
  }

  // How wide the panel is and may be: its own width at the least, 40rem at the most, and never so wide that
  // the canvas (just before this edge) is left with less than 25rem.
  getBounds = () => {
    const el = this.ref.current
    const panel = this.props.controls ? document.getElementById(this.props.controls) : null
    const canvas = el?.previousElementSibling
    const style = window.getComputedStyle?.bind(window)
    const rem = parseFloat(style?.(document.documentElement)?.fontSize) || 16
    const min = (panel && parseFloat(style?.(panel)?.minWidth)) || FALLBACK_MIN
    const panelWidth = panel?.getBoundingClientRect().width || 0
    const canvasWidth = canvas?.getBoundingClientRect().width || 0
    let max = MAX_PANEL_REM * rem
    if (panelWidth && canvasWidth) {
      max = Math.min(max, panelWidth + canvasWidth - MIN_CANVAS_REM * rem)
    }
    max = Math.max(min, max)
    return { min, max, width: clamp(panelWidth || this.props.width || min, min, max) }
  }

  resize = (width, done) => {
    this.props.onResize(width)
    if (done) this.props.onResizeEnd?.(width)
  }

  onMouseDown = (e) => {
    if (e.button !== 0) return
    // No text selection starts under the pointer; the edge takes focus, so the keyboard can carry on.
    e.preventDefault()
    this.ref.current?.focus()
    const { min, max, width } = this.getBounds()
    this.drag = { startX: e.clientX, startWidth: width, width, min, max }
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mouseup', this.onMouseUp)
  }

  onMouseMove = (e) => {
    const drag = this.drag
    if (!drag) return
    // A button let go outside the window never sends mouseup.
    if (e.buttons === 0) {
      this.onMouseUp()
      return
    }
    // The edge is the panel's left side, so moving it left widens the panel.
    const width = clamp(drag.startWidth + drag.startX - e.clientX, drag.min, drag.max)
    if (width !== drag.width) {
      drag.width = width
      // The overlay only once the edge really moves: put under a plain click, it would take the mouseup,
      // and the browser then sends no click or double-click at all.
      if (!this.state.dragging) this.setState({ dragging: true })
      this.resize(width, false)
    }
  }

  onMouseUp = () => {
    const drag = this.drag
    this.drag = null
    this.stopListening()
    if (this.state.dragging) this.setState({ dragging: false })
    if (drag && drag.width !== drag.startWidth) {
      this.props.onResizeEnd?.(drag.width)
    }
  }

  stopListening = () => {
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mouseup', this.onMouseUp)
  }

  onKeyDown = (e) => {
    const { min, max, width } = this.getBounds()
    const step = e.shiftKey ? BIG_STEP : STEP
    let next
    if (e.key === 'ArrowLeft') next = width + step
    else if (e.key === 'ArrowRight') next = width - step
    else if (e.key === 'Home') next = min
    else if (e.key === 'End') next = max
    else return
    e.preventDefault()
    next = clamp(next, min, max)
    if (next !== width) this.resize(next, true)
  }

  render() {
    const { width, controls } = this.props
    const { dragging } = this.state
    return (
      <div
        ref={this.ref}
        className={`${RB}-panel-resizer`}
        role='separator'
        aria-orientation='vertical'
        aria-label={STRINGS.resizePanel}
        aria-controls={controls}
        aria-valuenow={Math.round(width || FALLBACK_MIN)}
        aria-valuemin={FALLBACK_MIN}
        aria-valuemax={MAX_PANEL_REM * 16}
        title={STRINGS.resizePanelHint}
        tabIndex={0}
        data-dragging={dragging || undefined}
        data-test='report-builder-panel-resizer'
        onMouseDown={this.onMouseDown}
        onKeyDown={this.onKeyDown}
        onDoubleClick={this.props.onReset}
      >
        {/* While dragging, the whole window keeps the resize cursor and nothing underneath is selected. */}
        {dragging ? <div className={`${RB}-panel-resize-overlay`} /> : null}
      </div>
    )
  }
}
