import React from 'react'
import PropTypes from 'prop-types'
import { Popover } from '../Popover'
import { Button } from '../Button'
import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './ConfirmPopover.scss'

export default class ConfirmPopover extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      isOpen: false,
    }
  }

  static propTypes = {
    title: PropTypes.string,
    text: PropTypes.string,
    backText: PropTypes.string,
    confirmText: PropTypes.string,
    danger: PropTypes.bool,
    padding: PropTypes.number,
    positions: PropTypes.arrayOf(PropTypes.string),
    align: PropTypes.string,
    icon: PropTypes.string,
    onClose: PropTypes.func,
    onConfirm: PropTypes.func,
    disable: PropTypes.bool,
  }

  static defaultProps = {
    title: 'Are you sure you want to proceed?',
    text: '',
    backText: 'Go back',
    confirmText: 'Continue',
    danger: false,
    padding: undefined,
    positions: undefined,
    align: undefined,
    icon: undefined,
    onClose: () => {},
    onConfirm: () => {},
    disable: false,
  }

  close = () => {
    this.setState({ isOpen: false })
  }

  onConfirmClick = async () => {
    this.setState({ loading: true })

    try {
      await this.props.onConfirm()
    } catch (error) {
      console.error(error)
    }

    this.setState({ isOpen: false, loading: false })
  }

  renderContent = () => {
    return (
      <div className='react-autoql-confirm-popover-content'>
        <div className='react-autoql-confirm-popover-title'>
          {this.props.icon ? <Icon type={this.props.icon} /> : null}
          {this.props.title}
        </div>
        <div className='react-autoql-confirm-popover-text'>{this.props.text}</div>
        <div className='react-autoql-confirm-popover-button-container'>
          <Button type='default' size='medium' onClick={this.close} tooltipID={this.props.tooltipID}>
            {this.props.backText}
          </Button>
          <Button
            type={this.props.danger ? 'danger' : 'primary'}
            onClick={this.onConfirmClick}
            loading={this.props.confirmLoading}
            tooltipID={this.props.tooltipID}
            size='medium'
            filled
          >
            {this.props.confirmText}
          </Button>
        </div>
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Popover
          isOpen={this.state.isOpen}
          content={this.renderContent}
          className='react-autoql-confirm-popover'
          parentElement={this.props.popoverParentElement}
          boundaryElement={this.props.popoverParentElement}
          positions={this.props.positions}
          padding={this.props.padding}
          align={this.props.align}
          onClickOutside={this.close}
        >
          <div
            className={`react-autoql-confirm-popover-click-wrapper ${this.props.className ?? ''}`}
            onClick={(event) => {
              if (this.props.disable) {
                event.preventDefault()
                return
              }
              this.setState({ isOpen: !this.state.isOpen })
            }}
          >
            {this.props.children}
          </div>
        </Popover>
      </ErrorBoundary>
    )
  }
}
