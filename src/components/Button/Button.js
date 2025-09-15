import React from 'react'
import PropTypes from 'prop-types'

import { Spinner } from '../Spinner'
import { Icon } from '../Icon'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { normalizeString } from 'autoql-fe-utils'

import './Button.scss'

const validTypes = ['default', 'primary', 'danger']
const validSizes = ['small', 'medium', 'large']

export class ButtonWithoutRef extends React.Component {
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

  render = () => {
    const type = this.getType()
    const size = this.getSize()
    const isDisabled = this.props.loading || this.props.disabled

    return (
      <ErrorBoundary>
        <button
          ref={this.props.innerRef}
          className={`react-autoql-btn
            ${this.props.className || ''}
            react-autoql-btn-${type}
            react-autoql-btn-${size}
            ${isDisabled ? ' disabled' : ''}
            ${this.props.border ? '' : 'btn-no-border'}
            ${this.props.filled ? 'btn-filled' : ''}
            ${this.props.iconOnly ? 'icon-only' : ''}`}
          data-test='react-autoql-btn'
          data-multiline={this.props.multiline}
          style={{ ...this.props.style }}
          onClick={this.props.onClick}
          data-tooltip-html={this.props.tooltip}
          data-tooltip-id={this.props.tooltipID}
        >
          {this.props.loading ? <Spinner data-test='react-autoql-btn-loading' /> : this.renderIcon()}
          <div>{this.props.children}</div>
        </button>
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef((props, ref) => <ButtonWithoutRef innerRef={ref} {...props} />)
