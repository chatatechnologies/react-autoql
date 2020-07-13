import React from 'react'
import PropTypes from 'prop-types'

import { Spinner } from '../Spinner'

import './Button.scss'

const validTypes = ['default', 'primary', 'danger']
const validSizes = ['small', 'large']

export default class Button extends React.Component {
  static propTypes = {
    type: PropTypes.oneOf(validTypes),
    size: PropTypes.oneOf(validSizes),
    onClick: PropTypes.func,
    loading: PropTypes.bool,
    disabled: PropTypes.bool,
  }

  static defaultProps = {
    type: 'default',
    loading: false,
    size: 'large',
    disabled: false,
    onClick: () => {},
  }

  getType = () => {
    try {
      const type = this.props.type.trim().toLowerCase()
      if (validTypes.includes(type)) {
        return type
      }
    } catch (error) {
      console.warn(
        'Warning: The type provided was invalid, using "default" instead'
      )
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
      console.warn(
        'Warning: The size provided was invalid, using "large" instead'
      )
      return 'large'
    }
    return 'large'
  }

  render = () => {
    const type = this.getType()
    const size = this.getSize()
    const isDisabled = this.props.loading || this.props.disabled

    return (
      <button
        className={`chata-btn
          ${this.props.className || ''}
          ${type}
          ${size}
          ${isDisabled ? ' disabled' : ''}`}
        data-test="chata-btn"
        style={{ ...this.props.style }}
        onClick={this.props.onClick}
      >
        {this.props.loading && <Spinner data-test="chata-button-loading" />}
        {this.props.children}
      </button>
    )
  }
}
