import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'

import { Spinner } from '../Spinner'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Button.scss'

const validTypes = ['default', 'primary', 'danger']
const validSizes = ['small', 'large']

export default class Button extends React.Component {
  COMPONENT_KEY = `react-autoql-btn-${uuid.v4()}`

  static propTypes = {
    type: PropTypes.oneOf(validTypes),
    size: PropTypes.oneOf(validSizes),
    onClick: PropTypes.func,
    loading: PropTypes.bool,
    disabled: PropTypes.bool,
    tooltip: PropTypes.string,
  }

  static defaultProps = {
    type: 'default',
    loading: false,
    size: 'large',
    disabled: false,
    tooltip: undefined,
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
      <ErrorBoundary>
        <button
          className={`react-autoql-btn
          ${this.props.className || ''}
          ${type}
          ${size}
          ${isDisabled ? ' disabled' : ''}`}
          data-test="react-autoql-btn"
          style={{ ...this.props.style }}
          onClick={this.props.onClick}
          data-tip={this.props.tooltip}
          data-for={this.COMPONENT_KEY}
        >
          {this.props.loading && (
            <Spinner data-test="react-autoql-btn-loading" />
          )}
          {this.props.children}
        </button>
        <ReactTooltip
          className="react-autoql-drawer-tooltip"
          id={this.COMPONENT_KEY}
          effect="solid"
          delayShow={500}
          place="top"
        />
      </ErrorBoundary>
    )
  }
}
