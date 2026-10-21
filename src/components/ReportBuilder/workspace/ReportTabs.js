import React from 'react'
import { Icon } from '../components/icons'
import { RS } from './constants'
import { REPORTS_STRINGS } from './strings'
import { MIN_TAB_WIDTH } from './tabs'

// The workspace's tab strip: the home page first, then a tab per report open here, then New report, the one way
// to start a report. A tab fits its title (a very long one is cut short, and the tooltip has it all); dragging its
// right edge sets its width, from 96px to the whole title, and double-clicking the edge makes it as wide as the
// whole title. The tab shown joins the page below it. Closing a tab (its ×, or a middle click) never deletes
// anything; reports are deleted from the home page. A report that isn't saved keeps a dot on its tab while
// another one is shown.
//
// Props: tabs ([{ id, title, notSaved }], notSaved when its last save failed or it was changed elsewhere),
// shownId (the report shown; null for the home page), onHome, onSelect(id), onClose(id) (closes the tab only: the
// report stays in the list), onNew, newDisabled, widths (the widths tabs were given, px by report id; the others
// fit their title), and onResize(id, width) (an edge was dragged to a width, or double-clicked to fit the whole
// title). Without onResize there's no edge to drag.

const S = REPORTS_STRINGS.tabs

// A pointer on the edge that moves less than this (px) is a click, half of a double-click, not a drag.
const DRAG_THRESHOLD = 3

const widthAt = (drag, clientX) =>
  Math.min(drag.max, Math.max(MIN_TAB_WIDTH, Math.round(drag.startWidth + clientX - drag.startX)))

// The tab's width with its whole title showing, whatever it is now.
const fullWidthOf = (tab) => {
  const title = tab.querySelector('[data-tab-title]')
  const button = title?.parentElement
  if (!title || !button) {
    return MIN_TAB_WIDTH
  }
  const box = tab.getBoundingClientRect()
  const before = title.getBoundingClientRect().left - box.left
  const after = box.right - button.getBoundingClientRect().right
  // scrollWidth is rounded: a pixel to spare keeps the last letter from turning into an ellipsis.
  return Math.max(MIN_TAB_WIDTH, Math.ceil(before + title.scrollWidth + after) + 1)
}

export class ReportTabs extends React.Component {
  static defaultProps = {
    tabs: [],
    shownId: null,
    newDisabled: false,
  }

  scrollerRef = React.createRef()

  // The edge being dragged: its width shows here as it moves (state.dragged), and goes to onResize when let go.
  drag = null

  state = { dragged: null }

  componentDidMount() {
    this.showShownTab()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.shownId !== this.props.shownId || prevProps.tabs.length !== this.props.tabs.length) {
      this.showShownTab()
    }
  }

  // The tab shown stays in view when there are more than fit.
  showShownTab = () => {
    const { shownId } = this.props
    const scroller = this.scrollerRef.current
    if (shownId === null || !scroller) {
      return
    }
    const tab = Array.from(scroller.children).find((child) => child.getAttribute('data-tab') === shownId)
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  // A middle click closes the tab, as in a browser; pressing the middle button doesn't start autoscroll.
  onTabMouseDown = (e) => {
    if (e.button === 1) {
      e.preventDefault()
    }
  }

  onTabAuxClick = (e, id) => {
    if (e.button !== 1) {
      return
    }
    e.preventDefault()
    this.props.onClose?.(id)
  }

  startResize = (e, id) => {
    const tab = e.currentTarget.parentElement
    if (e.button !== 0 || !this.props.onResize || !tab) {
      return
    }
    e.preventDefault()
    this.drag = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startWidth: tab.getBoundingClientRect().width,
      // As wide as the whole title, and no wider.
      max: fullWidthOf(tab),
      moved: false,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  moveResize = (e) => {
    const drag = this.drag
    if (!drag || e.pointerId !== drag.pointerId) {
      return
    }
    if (!drag.moved && Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD) {
      return
    }
    drag.moved = true
    this.setState({ dragged: { id: drag.id, width: widthAt(drag, e.clientX) } })
  }

  endResize = (e) => {
    const drag = this.drag
    if (!drag || e.pointerId !== drag.pointerId) {
      return
    }
    this.drag = null
    if (drag.moved) {
      this.props.onResize?.(drag.id, widthAt(drag, e.clientX))
    }
    this.clearDragged()
  }

  cancelResize = () => {
    this.drag = null
    this.clearDragged()
  }

  clearDragged = () => this.setState((state) => (state.dragged ? { dragged: null } : null))

  fitTitle = (e, id) => {
    const tab = e.currentTarget.parentElement
    if (tab) {
      this.props.onResize?.(id, fullWidthOf(tab))
    }
  }

  renderTab = (tab) => {
    const { shownId, widths, onSelect, onClose, onResize } = this.props
    const { dragged } = this.state
    const shown = tab.id === shownId
    const dragging = dragged?.id === tab.id
    const width = dragging ? dragged.width : widths?.[tab.id]
    const sized = typeof width === 'number'

    return (
      <div
        key={tab.id}
        className={`${RS}-tab`}
        data-tab={tab.id}
        data-shown={shown ? '' : undefined}
        // A tab given a width keeps exactly that width; the others fit their title (_tabs.scss).
        style={sized ? { flex: '0 0 auto', width, maxWidth: 'none' } : undefined}
        onMouseDown={this.onTabMouseDown}
        onAuxClick={(e) => this.onTabAuxClick(e, tab.id)}
      >
        <button
          type='button'
          className={`${RS}-tab-select`}
          title={tab.title}
          aria-current={shown ? 'page' : undefined}
          onClick={() => onSelect?.(tab.id)}
        >
          <Icon name='file' size={14} />
          <span className={`${RS}-tab-title`} data-tab-title='' data-capped={sized ? undefined : ''}>
            {tab.title}
          </span>
          {tab.notSaved ? <span className={`${RS}-sr-only`}>{S.notSaved}</span> : null}
        </button>
        <span className={`${RS}-tab-end`}>
          <button
            type='button'
            className={`${RS}-tab-close`}
            aria-label={S.close(tab.title)}
            title={S.closeTitle}
            onClick={() => onClose?.(tab.id)}
          >
            <Icon name='close' size={14} />
          </button>
          {/* Shown, the tab has its close button instead; the builder's toolbar says it isn't saved. */}
          {tab.notSaved && !shown ? (
            <span className={`${RS}-tab-dot`} aria-hidden='true' data-test='reports-tab-not-saved' />
          ) : null}
        </span>
        {onResize ? (
          // The edge to drag. Pointer only: the whole title is the tab's name for assistive tech, and the
          // builder's title field shows it too.
          <span
            className={`${RS}-tab-resize`}
            aria-hidden='true'
            title={S.resize}
            data-dragging={dragging ? '' : undefined}
            data-test='reports-tab-resize'
            onPointerDown={(e) => this.startResize(e, tab.id)}
            onPointerMove={this.moveResize}
            onPointerUp={this.endResize}
            onPointerCancel={this.cancelResize}
            onDoubleClick={(e) => this.fitTitle(e, tab.id)}
          />
        ) : null}
      </div>
    )
  }

  render() {
    const { tabs, shownId, onHome, onNew, newDisabled } = this.props
    return (
      <nav className={`${RS}-tabs`} aria-label={S.label} data-test='reports-tabs'>
        <button
          type='button'
          className={`${RS}-tabs-home`}
          aria-label={S.home}
          title={S.home}
          aria-current={shownId === null ? 'page' : undefined}
          onClick={() => onHome?.()}
        >
          <Icon name='home' size={16} />
        </button>

        <div ref={this.scrollerRef} className={`${RS}-tabs-scroller`}>
          {tabs.map(this.renderTab)}
        </div>

        <button type='button' className={`${RS}-tabs-new`} disabled={!!newDisabled} onClick={() => onNew?.()}>
          <Icon name='plus' size={15} />
          {S.newReport}
        </button>
      </nav>
    )
  }
}
