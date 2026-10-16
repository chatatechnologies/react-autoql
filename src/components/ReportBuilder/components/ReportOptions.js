import React from 'react'
import { RB } from '../constants'
import { STRINGS } from '../strings'
import { Icon } from './icons'

// The report options menu (⋮) at the end of the toolbar, as the prototype has it: Page setup, and Branding…
// where the host lets the organisation's branding be changed here. A choice, Escape, Tab or a click anywhere
// else closes it; the arrow keys move between its items.

let menuIds = 0

export class ReportOptions extends React.Component {
  constructor(props) {
    super(props)
    menuIds += 1
    this.menuId = `${RB}-options-menu-${menuIds}`
    this.rootRef = React.createRef()
    this.buttonRef = React.createRef()
    this.itemRefs = []
    this.state = { open: false }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.open && !prevState.open) {
      document.addEventListener('mousedown', this.onDocumentMouseDown)
      this.itemRefs[0]?.focus?.()
    } else if (!this.state.open && prevState.open) {
      document.removeEventListener('mousedown', this.onDocumentMouseDown)
    }
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.onDocumentMouseDown)
  }

  // Where focus goes back to once a dialog opened from here closes.
  focusButton = () => this.buttonRef.current?.focus?.()

  onDocumentMouseDown = (e) => {
    if (!this.rootRef.current?.contains(e.target)) this.setState({ open: false })
  }

  toggle = () => this.setState(({ open }) => ({ open: !open }))

  choose = (action) => this.setState({ open: false }, action)

  onMenuKeyDown = (e) => {
    const items = this.itemRefs.filter(Boolean)
    const index = items.indexOf(document.activeElement)
    const focusAt = (i) => items[(i + items.length) % items.length]?.focus()
    if (e.key === 'Escape') {
      // Only the menu closes: the builder would otherwise also clear the selection.
      e.preventDefault()
      e.stopPropagation()
      this.setState({ open: false }, this.focusButton)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusAt(index + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusAt(index - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusAt(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusAt(items.length - 1)
    } else if (e.key === 'Tab') {
      this.setState({ open: false })
    }
  }

  render() {
    const { onPageSetup, onBranding } = this.props
    const { open } = this.state
    const items = [
      { key: 'page-setup', label: STRINGS.reportOptions.pageSetup, action: onPageSetup },
      onBranding ? { key: 'branding', label: STRINGS.reportOptions.branding, action: onBranding } : null,
    ].filter(Boolean)
    this.itemRefs = []
    return (
      <span className={`${RB}-options`} ref={this.rootRef}>
        <button
          ref={this.buttonRef}
          type='button'
          className={`${RB}-button ${RB}-options-button`}
          aria-label={STRINGS.reportOptions.label}
          title={STRINGS.reportOptions.label}
          aria-haspopup='menu'
          aria-expanded={open}
          aria-controls={open ? this.menuId : undefined}
          data-test='report-builder-options'
          onClick={this.toggle}
        >
          <Icon name='more' size={15} />
        </button>
        {open ? (
          <div
            id={this.menuId}
            className={`${RB}-menu`}
            role='menu'
            aria-label={STRINGS.reportOptions.label}
            onKeyDown={this.onMenuKeyDown}
          >
            {items.map(({ key, label, action }, i) => (
              <button
                key={key}
                ref={(el) => {
                  this.itemRefs[i] = el
                }}
                type='button'
                role='menuitem'
                tabIndex={-1}
                className={`${RB}-menu-item`}
                data-test={`report-builder-options-${key}`}
                onClick={() => this.choose(action)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </span>
    )
  }
}
