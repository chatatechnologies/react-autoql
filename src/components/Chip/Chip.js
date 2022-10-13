import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Chip.scss'

export default class Chip extends React.Component {
  COMPONENT_KEY = `react-autoql-chip-${uuid()}`

  static propTypes = {
    onClick: PropTypes.func,
    onDelete: PropTypes.func,
    disabled: PropTypes.bool,
    multiline: PropTypes.bool,
    selected: PropTypes.bool,
  }

  static defaultProps = {
    onClick: () => {},
    onDelete: () => {},
    disabled: false,
    multiline: false,
    selected: false,
  }

  renderDeleteButton = () => {
    return <Icon className='react-autoql-chip-delete-btn' type='close' onClick={this.props.onDelete} />
  }

  render = () => {
    const isDisabled = this.props.loading || this.props.disabled

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-chip
          ${this.props.className || ''}
          ${isDisabled ? ' disabled' : ''}
          ${this.props.selected ? ' selected' : ''}`}
          data-test='react-autoql-chip'
          data-multiline={this.props.multiline}
          style={{ ...this.props.style }}
          onClick={this.props.onClick}
        >
          {this.props.children}
          {this.renderDeleteButton()}
        </div>
      </ErrorBoundary>
    )
  }
}
