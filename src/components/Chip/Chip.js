import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { ConfirmPopover } from '../ConfirmPopover'

import './Chip.scss'

export default class Chip extends React.Component {
  COMPONENT_KEY = `react-autoql-chip-${uuid()}`

  static propTypes = {
    onClick: PropTypes.func,
    onDelete: PropTypes.func,
    disabled: PropTypes.bool,
    multiline: PropTypes.bool,
    selected: PropTypes.bool,
    confirmDelete: PropTypes.bool,
    confirmText: PropTypes.string,
    deleteTooltip: PropTypes.string,
    tooltip: PropTypes.string,
  }

  static defaultProps = {
    onClick: () => {},
    onDelete: () => {},
    disabled: false,
    multiline: false,
    selected: false,
    confirmDelete: false,
    confirmText: 'Are you sure?',
    deleteTooltip: undefined,
    tooltip: undefined,
  }

  state = {
    isConfirmPopoverVisible: false,
  }

  onCloseClick = () => {
    this.setState({ isConfirmPopoverVisible: true })
  }

  renderDeleteButton = () => {
    if (this.props.confirmDelete) {
      return (
        <ConfirmPopover
          className='react-autoql-chip-delete-confirm-popover'
          popoverParentElement={this.props.popoverParentElement}
          title={this.props.confirmText}
          onConfirm={() => {
            this.setState({ isConfirmPopoverVisible: false }, this.props.onDelete)
          }}
          confirmText='Remove'
          backText='Cancel'
          positions={['top', 'bottom', 'right', 'left']}
          padding={this.props.popoverPadding}
          align='end'
        >
          <Icon
            className='react-autoql-chip-delete-btn'
            type='close'
            onClick={this.onCloseClick}
            data-tooltip-html={this.props.deleteTooltip}
            data-tooltip-id={this.props.tooltipID}
          />
        </ConfirmPopover>
      )
    }

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
          data-tooltip-id={this.props.tooltipID}
          data-tooltip-content={this.props.tooltip}
        >
          <div className='react-autoql-chip-background' />
          <div className='react-autoql-chip-content'>
            <div>{this.props.children}</div>
            {this.renderDeleteButton()}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
