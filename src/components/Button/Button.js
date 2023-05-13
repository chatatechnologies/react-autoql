import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { Spinner } from '../Spinner'
import { Icon } from '../Icon'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './Button.scss'

const validTypes = ['default', 'primary', 'danger']
const validSizes = ['small', 'medium', 'large']

class Button extends React.Component {
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
    onClick: () => {},
  }

  getType = () => {
    try {
      const type = this.props.type.trim().toLowerCase()
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
      const trimmedSize = this.props.size.trim().toLowerCase()
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
            ${this.props.filled ? 'btn-filled' : ''}`}
          data-test='react-autoql-btn'
          data-multiline={this.props.multiline}
          style={{ ...this.props.style }}
          onClick={this.props.onClick}
          data-tip={this.props.tooltip}
          data-for={this.props.tooltipID}
        >
          {this.props.loading ? <Spinner data-test='react-autoql-btn-loading' /> : this.renderIcon()}
          <div>{this.props.children}</div>
        </button>
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef((props, ref) => <Button innerRef={ref} {...props} />)
