import React from 'react'
import PropTypes from 'prop-types'
import ReactModal from 'react-modal'

import { Button } from '../Button'
import { Icon } from '../Icon'

import './Modal.scss'

export default class Modal extends React.Component {
  static propTypes = {
    title: PropTypes.string,
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
  }

  static defaultProps = {
    title: '',
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
    onClose: () => {},
    onConfirm: () => {},
  }

  render = () => {
    return (
      <ReactModal
        isOpen={this.props.isVisible}
        bodyOpenClassName="chata-modal-container"
        ariaHideApp={false}
        contentLocation={{ top: 0, left: 0 }}
        closeTimeoutMS={200}
        data-test="chata-modal"
        style={{
          content: {
            ...this.props.style,
            bottom: 'auto',
            width: this.props.width,
          },
        }}
      >
        <div className="chata-modal-header">
          {this.props.title}
          <Icon
            type="close"
            className="chata-modal-close-btn"
            onClick={this.props.onClose}
          />
        </div>
        <div
          className="chata-modal-body"
          style={{
            overflow: this.props.enableBodyScroll ? 'auto' : 'hidden',
          }}
        >
          {this.props.children}
        </div>
        {this.props.showFooter && (
          <div className="chata-modal-footer">
            {this.props.footer || (
              <div>
                {this.props.showCancelButton && (
                  <Button type="default" onClick={this.props.onClose}>
                    Cancel
                  </Button>
                )}
                <Button
                  type="primary"
                  onClick={this.props.onConfirm}
                  loading={this.props.confirmLoading}
                  disabled={this.props.confirmDisabled}
                >
                  {this.props.confirmText || 'Ok'}
                </Button>
              </div>
            )}
          </div>
        )}
      </ReactModal>
    )
  }
}
