import React from 'react'
import PropTypes from 'prop-types'

import { Spinner } from '../Spinner'
import { Icon } from '../Icon'
import { Popover } from '../Popover'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { normalizeString } from 'autoql-fe-utils'

import './Button.scss'

const validTypes = ['default', 'primary', 'danger']
const validSizes = ['small', 'medium', 'large']

export class ButtonWithoutRef extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isSplitPopoverOpen: false,
    }
  }

  static propTypes = {
    type: PropTypes.oneOf(validTypes),
    size: PropTypes.oneOf(validSizes),
    onClick: PropTypes.func,
    loading: PropTypes.bool,
    disabled: PropTypes.bool,
    multiline: PropTypes.bool,
    filled: PropTypes.bool,
    border: PropTypes.bool,
    tooltip: PropTypes.string,
    icon: PropTypes.string,
    iconOnly: PropTypes.bool,
    splitButton: PropTypes.shape({
      popoverContent: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
      popoverProps: PropTypes.object,
    }),
  }

  static defaultProps = {
    type: 'default',
    loading: false,
    size: 'large',
    disabled: false,
    multiline: false,
    tooltip: undefined,
    filled: false,
    border: true,
    icon: undefined,
    iconOnly: false,
    splitButton: undefined,
    onClick: () => {},
  }

  getType = () => {
    try {
      const type = normalizeString(this.props.type)
      if (validTypes.includes(type)) {
        return type
      }
    } catch (error) {
      console.warn('Warning: The type provided was invalid, using "default" instead')
      return 'default'
    }
    return 'default'
  }

  getSize = () => {
    try {
      const trimmedSize = normalizeString(this.props.size)
      if (validSizes.includes(trimmedSize)) {
        return trimmedSize
      }
    } catch (error) {
      console.warn('Warning: The size provided was invalid, using "large" instead')
      return 'large'
    }
    return 'large'
  }

  renderIcon = () => {
    if (!this.props.icon) {
      return null
    }

    return <Icon className='react-autoql-btn-icon' type={this.props.icon} />
  }

  renderButton = (isSplitRight = false) => {
    const type = this.getType()
    const size = this.getSize()
    const isDisabled = this.props.loading || this.props.disabled
    const splitButton = this.props.splitButton

    return (
      <button
        ref={isSplitRight ? undefined : this.props.innerRef}
        className={`react-autoql-btn
          ${this.props.className || ''}
          react-autoql-btn-${type}
          react-autoql-btn-${size}
          ${isDisabled ? ' disabled' : ''}
          ${this.props.border ? '' : 'btn-no-border'}
          ${this.props.filled ? 'btn-filled' : ''}
          ${isSplitRight ? 'icon-only btn-split-right' : this.props.iconOnly ? 'icon-only' : ''}
          ${splitButton && !isSplitRight ? 'btn-split-left' : ''}`}
        data-test='react-autoql-btn'
        data-multiline={this.props.multiline}
        style={{ ...this.props.style }}
        onClick={isSplitRight ? () => this.setState({ isSplitPopoverOpen: !this.state.isSplitPopoverOpen }) : this.props.onClick}
        data-tooltip-html={this.props.tooltip}
        data-tooltip-id={this.props.tooltipID}
      >
        {isSplitRight ? (
          <Icon className='react-autoql-btn-icon' type='caret-down' />
        ) : (
          <>
            {this.props.loading ? <Spinner data-test='react-autoql-btn-loading' /> : this.renderIcon()}
            <div>{this.props.children}</div>
          </>
        )}
      </button>
    )
  }

  render = () => {
    const { splitButton } = this.props

    if (!splitButton) {
      return (
        <ErrorBoundary>
          {this.renderButton()}
        </ErrorBoundary>
      )
    }

    const handlePopoverClose = () => {
      this.setState({ isSplitPopoverOpen: false })
      if (splitButton.onPopoverClose) {
        splitButton.onPopoverClose()
      }
    }

    // Create popover content function that passes close handler
    const popoverContent = typeof splitButton.popoverContent === 'function'
      ? (params) => {
          const content = splitButton.popoverContent({ ...params, closePopover: handlePopoverClose })
          return content
        }
      : () => splitButton.popoverContent

    const defaultPopoverProps = {
      isOpen: this.state.isSplitPopoverOpen,
      onClickOutside: handlePopoverClose,
      positions: ['bottom', 'top'],
      align: 'start',
      padding: 12,
    }

    const popoverProps = {
      ...defaultPopoverProps,
      ...splitButton.popoverProps,
      isOpen: this.state.isSplitPopoverOpen,
      onClickOutside: handlePopoverClose,
      content: popoverContent,
    }

    return (
      <ErrorBoundary>
        <div className={`react-autoql-btn-split-container ${this.props.border ? 'with-border' : ''}`}>
          {this.renderButton(false)}
          <Popover {...popoverProps}>
            {this.renderButton(true)}
          </Popover>
        </div>
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef((props, ref) => <ButtonWithoutRef innerRef={ref} {...props} />)
