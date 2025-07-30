import React from 'react'
import PropTypes from 'prop-types'
import ReactModal from 'react-modal'
import { isMobile } from 'react-device-detect'
import { deepEqual } from 'autoql-fe-utils'

import { Button } from '../Button'
import { Icon } from '../Icon'
import { ConfirmModal } from '../ConfirmModal'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Modal.scss'

export default class Modal extends React.Component {
  static propTypes = {
    title: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
    titleIcon: PropTypes.oneOfType([PropTypes.element, PropTypes.instanceOf(Icon)]),
    subtitle: PropTypes.string,
    isVisible: PropTypes.bool,
    onClose: PropTypes.func,
    onConfirm: PropTypes.func,
    width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    showCancelButton: PropTypes.bool,
    showFooter: PropTypes.bool,
    enableBodyScroll: PropTypes.bool,
    confirmLoading: PropTypes.bool,
    confirmText: PropTypes.string,
    confirmDisabled: PropTypes.bool,
    footer: PropTypes.element,
    confirmOnClose: PropTypes.bool,
    shouldRender: PropTypes.bool,
    onOpened: PropTypes.func,
    onClosed: PropTypes.func,
  }

  static defaultProps = {
    title: '',
    titleIcon: undefined,
    subtitle: '',
    isVisible: false,
    width: '80vw',
    height: undefined,
    showCancelButton: true,
    enableBodyScroll: false,
    showFooter: true,
    confirmLoading: false,
    confirmText: undefined,
    footer: undefined,
    confirmDisabled: false,
    confirmOnClose: false,
    shouldRender: true,
    onClose: () => {},
    onConfirm: () => {},
    onOpened: () => {},
    onClosed: () => {},
  }

  state = {
    isConfirmCloseModalVisible: false,
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (!nextProps.shouldRender && !this.props.shouldRender) {
      return false
    }

    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.isVisible && !prevProps.isVisible) {
      this.props.onOpened()
    }

    if (!this.props.isVisible && prevProps.isVisible) {
      this.props.onClosed()
    }
  }

  onClose = (deleteFromPortal = true) => {
    if (this.props.confirmOnClose && deleteFromPortal) {
      this.setState({ isConfirmCloseModalVisible: true })
    } else {
      this.props.onClose()
    }
  }

  renderFooter = () => {
    if (this.props.footer) {
      return this.props.footer
    }

    return (
      <div className='modal-footer-button-container right'>
        {this.props.showCancelButton && (
          <Button type='default' onClick={this.onClose} border={false}>
            Cancel
          </Button>
        )}
        <Button
          type='primary'
          onClick={this.props.onConfirm}
          loading={this.props.confirmLoading}
          disabled={this.props.confirmDisabled}
        >
          {this.props.confirmText || 'Ok'}
        </Button>
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <ReactModal
          ref={(r) => (this.ref = r)}
          isOpen={this.props.isVisible}
          className={`${isMobile ? 'react-autoql-modal-mobile' : 'react-autoql-modal'}${
            this.props.contentClassName ? ` ${this.props.contentClassName}` : ''
          }`}
          bodyOpenClassName={`react-autoql-modal-container${this.props.className ? ` ${this.props.className}` : ''}`}
          ariaHideApp={false}
          contentLocation={{ top: 0, left: 0 }}
          closeTimeoutMS={200}
          data-test='react-autoql-modal'
          style={{
            content: {
              ...this.props.style,
              width: this.props.width,
              height: this.props.height,
            },
            overlay: { ...this.props.overlayStyle },
          }}
        >
          <div
            className={`react-autoql-modal-content${isMobile ? ' react-autoql-modal-content-mobile' : ''}`}
            ref={(r) => (this.modalContent = r)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className='react-autoql-modal-header'>
              <div className='react-autoql-modal-header-title-container'>
                <div className='react-autoql-modal-header-title'>
                  {this.props.titleIcon} {this.props.title}
                </div>
                <div className='react-autoql-modal-header-subtitle'>{this.props.subtitle}</div>
              </div>
              <Icon type='close' className='react-autoql-modal-close-btn' onClick={this.onClose} />
            </div>
            <div
              className={`react-autoql-modal-body ${this.props.bodyClassName ?? ''}`}
              style={{
                overflow: this.props.enableBodyScroll ? 'auto' : 'hidden',
              }}
            >
              {this.props.children}
            </div>
            {this.props.showFooter && <div className='react-autoql-modal-footer'>{this.renderFooter()}</div>}
          </div>
        </ReactModal>
        {!!this.props.confirmOnClose && (
          <ConfirmModal
            isVisible={this.state.isConfirmCloseModalVisible}
            onClose={() => this.setState({ isConfirmCloseModalVisible: false })}
            confirmText='Discard Changes'
            onConfirm={() => {
              this.props.onClose()
              this.setState({ isConfirmCloseModalVisible: false })
            }}
          >
            <h3>Are you sure you want to leave this page?</h3>
            <p>All unsaved changes will be lost.</p>
          </ConfirmModal>
        )}
      </ErrorBoundary>
    )
  }
}
