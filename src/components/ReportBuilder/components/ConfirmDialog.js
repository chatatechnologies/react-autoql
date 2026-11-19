import React from 'react'
import PropTypes from 'prop-types'
import { RB } from '../constants'
import { STRINGS } from '../strings'
import { Icon } from './icons'

// A question the builder asks before going on, drawn as its other dialogs are (Branding): a title, what going on means
// (`message`), and the action (`confirmLabel`) beside Cancel. Escape, the backdrop and Cancel close it, and Tab stays
// inside it. Cancel has the focus first, so going on takes a deliberate choice, and the focus goes back where it was
// once it closes.

const FOCUSABLE = 'button:not([disabled])'

let confirmIds = 0

export class ConfirmDialog extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    confirmLabel: PropTypes.string.isRequired,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    testId: PropTypes.string,
  }

  static defaultProps = {
    testId: undefined,
  }

  constructor(props) {
    super(props)
    confirmIds += 1
    this.ids = { title: `${RB}-confirm-title-${confirmIds}`, message: `${RB}-confirm-message-${confirmIds}` }
    this.dialogRef = React.createRef()
    this.cancelRef = React.createRef()
  }

  componentDidMount() {
    this.returnFocus = typeof document !== 'undefined' ? document.activeElement : null
    this.cancelRef.current?.focus?.()
  }

  componentWillUnmount() {
    if (this.returnFocus?.isConnected) {
      this.returnFocus.focus?.()
    }
  }

  onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.props.onCancel()
      return
    }
    if (e.key !== 'Tab') {
      return
    }
    const focusable = Array.from(this.dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
    if (!focusable.length) {
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  render() {
    const { title, message, confirmLabel, onConfirm, onCancel, testId } = this.props
    return (
      <>
        <div className={`${RB}-modal-backdrop`} onMouseDown={onCancel} />
        <div
          ref={this.dialogRef}
          className={`${RB}-modal ${RB}-confirm`}
          role='alertdialog'
          aria-modal='true'
          aria-labelledby={this.ids.title}
          aria-describedby={this.ids.message}
          data-test={testId}
          onKeyDown={this.onKeyDown}
        >
          <div className={`${RB}-modal-header`}>
            <h2 className={`${RB}-modal-title`} id={this.ids.title}>
              {title}
            </h2>
            <button type='button' className={`${RB}-icon-button`} aria-label={STRINGS.close} onClick={onCancel}>
              <Icon name='close' />
            </button>
          </div>
          <div className={`${RB}-modal-body`}>
            <p className={`${RB}-confirm-message`} id={this.ids.message}>
              {message}
            </p>
          </div>
          <div className={`${RB}-modal-actions`} data-align='end'>
            <button
              ref={this.cancelRef}
              type='button'
              className={`${RB}-button`}
              data-test={testId ? `${testId}-cancel` : undefined}
              onClick={onCancel}
            >
              {STRINGS.approval.cancel}
            </button>
            <button
              type='button'
              className={`${RB}-button`}
              data-variant='primary'
              data-test={testId ? `${testId}-confirm` : undefined}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </>
    )
  }
}
