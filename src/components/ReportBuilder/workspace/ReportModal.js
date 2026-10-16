import React from 'react'
import ReactDOM from 'react-dom'
import { Icon } from '../components/icons'
import { RS } from './constants'
import { REPORTS_STRINGS } from './strings'
import './Reports.scss'

// A dialog over the whole page, drawn the way the builder draws its own: the workspace's New report and dashboard
// tiles, and "Add to Report…" wherever a host shows it. It renders into document.body, so a host's layout can't
// clip it. Escape and the backdrop close it (not while `busy`), Tab stays inside it, and focus goes back where it
// was when it closes.
//
// Props: title, description (the line under it), size ('small' or 'large'), headerExtra (more of the header, under
// the description), status (the line beside the actions; statusTone 'error' for a failure), actions (its buttons),
// initialFocus (a ref to focus first; else the body's first field or button), busy, onClose, testId, children.

const FOCUSABLE_PARTS = [
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
]
const FOCUSABLE = FOCUSABLE_PARTS.join(', ')
// The same, inside the body only: where focus starts when nothing else is asked for.
const FOCUSABLE_IN_BODY = FOCUSABLE_PARTS.map((part) => `.${RS}-modal-body ${part}`).join(', ')

let modalIds = 0

export class ReportModal extends React.Component {
  constructor(props) {
    super(props)
    modalIds += 1
    this.ids = { title: `${RS}-modal-title-${modalIds}`, what: `${RS}-modal-what-${modalIds}` }
    this.dialogRef = React.createRef()
  }

  componentDidMount() {
    this.returnFocus = typeof document !== 'undefined' ? document.activeElement : null
    const dialog = this.dialogRef.current
    const first = this.props.initialFocus?.current || dialog?.querySelector(FOCUSABLE_IN_BODY) || dialog
    first?.focus?.()
  }

  componentWillUnmount() {
    const back = this.returnFocus
    if (back && typeof back.focus === 'function' && document.body.contains(back)) {
      back.focus()
    }
  }

  close = () => {
    if (!this.props.busy) {
      this.props.onClose?.()
    }
  }

  // Escape closes it (unless something inside it used the key already), and Tab stays inside it.
  onKeyDown = (e) => {
    if (e.defaultPrevented) {
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.close()
      return
    }
    if (e.key !== 'Tab') {
      return
    }
    const focusable = Array.from(this.dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
    if (!focusable.length) {
      e.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === this.dialogRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  render() {
    if (typeof document === 'undefined') {
      return null
    }
    const { title, description, size, headerExtra, status, statusTone, actions, busy, testId, className, children } =
      this.props
    return ReactDOM.createPortal(
      <div className={`${RS}-layer`}>
        <div className={`${RS}-modal-backdrop`} onMouseDown={this.close} />
        <div
          ref={this.dialogRef}
          className={`${RS}-modal${className ? ` ${className}` : ''}`}
          role='dialog'
          aria-modal='true'
          aria-labelledby={this.ids.title}
          aria-describedby={description ? this.ids.what : undefined}
          data-size={size === 'large' ? 'large' : 'small'}
          data-test={testId}
          tabIndex={-1}
          onKeyDown={this.onKeyDown}
        >
          <div className={`${RS}-modal-header`}>
            <div className={`${RS}-modal-heading`}>
              <h2 className={`${RS}-modal-title`} id={this.ids.title}>
                {title}
              </h2>
              {description ? (
                <p className={`${RS}-modal-what`} id={this.ids.what}>
                  {description}
                </p>
              ) : null}
              {headerExtra || null}
            </div>
            <button
              type='button'
              className={`${RS}-icon-button`}
              aria-label={REPORTS_STRINGS.close}
              title={REPORTS_STRINGS.close}
              disabled={busy}
              onClick={this.close}
            >
              <Icon name='close' />
            </button>
          </div>
          <div className={`${RS}-modal-body`}>{children}</div>
          {status || actions ? (
            <div className={`${RS}-modal-actions`}>
              <div className={`${RS}-modal-status`} role='status' data-tone={statusTone || undefined}>
                {status || null}
              </div>
              {actions || null}
            </div>
          ) : null}
        </div>
      </div>,
      document.body,
    )
  }
}
