import React, { Fragment } from 'react'
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
    disabled: PropTypes.bool
  }

  static defaultProps = {
    type: 'default',
    loading: false,
    size: 'large',
    disabled: false,
    onClick: () => {}
  }

  getType = () => {
    try {
      const type = this.props.type.trim().toLowerCase()
      if (validTypes.includes(type)) {
        return type
      }
    } catch (error) {
      console.error('The type provided was invalid')
      return 'default'
    }
  }

  getSize = () => {
    let size
    try {
      const trimmedSize = this.props.size.trim().toLowerCase()
      if (validSizes.includes(trimmedSize)) {
        size = trimmedSize
      }
    } catch (error) {
      console.error('The size provided was invalid')
      size = 'large'
    }

    let sizeCss = {}
    if (size === 'small') {
      sizeCss = {
        padding: '2px 8px',
        margin: '2px 3px'
      }
    } else if (size === 'large') {
      sizeCss = {
        padding: '5px 16px',
        margin: '2px 5px'
      }
    }

    return sizeCss
  }

  render = () => {
    const type = this.getType()
    const sizeCss = this.getSize()
    const isDisabled = this.props.loading || this.props.disabled

    return (
      <button
        className={`chata-btn ${type} ${this.props.className || ''}${
          isDisabled ? ' disabled' : ''
        }`}
        data-test="chata-btn"
        style={{ ...sizeCss, ...this.props.style }}
        onClick={this.props.onClick}
      >
        {this.props.loading && <Spinner />}
        {this.props.children}
      </button>
    )
  }
}
