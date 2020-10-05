import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactModal from 'react-modal'

import { Button } from '../Button'
import { Icon } from '../Icon'

import './ConfirmModal.scss'

export default class ConfirmModal extends React.Component {
  static propTypes = {
    isVisible: PropTypes.bool,
    onClose: PropTypes.func,
    onConfirm: PropTypes.func,
    width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    confirmLoading: PropTypes.bool,
    confirmText: PropTypes.string,
    footer: PropTypes.element,
  }

  static defaultProps = {
    title: '',
    isVisible: false,
    width: '400px',
    height: undefined,
    confirmLoading: false,
    confirmText: undefined,
    footer: undefined,
    onClose: () => {},
    onConfirm: () => {},
  }

  state = {
    isConfirmCloseModalVisible: false,
  }

  renderFooter = () => {
    if (this.props.footer) {
      return this.props.footer
    }

    return (
      <div>
        <Button type="default" onClick={this.props.onClose}>
          Back
        </Button>
        <Button
          type="danger"
          onClick={this.props.onConfirm}
          loading={this.props.confirmLoading}
        >
          {this.props.confirmText || 'Continue'}
        </Button>
      </div>
    )
  }

  render = () => {
    return (
      <ReactModal
        isOpen={this.props.isVisible}
        bodyOpenClassName="chata-modal-container"
        ariaHideApp={false}
        contentLocation={{ top: 0, left: 0 }}
        closeTimeoutMS={200}
        data-test="chata-confirm-modal"
        style={{
          content: {
            ...this.props.style,
            bottom: 'auto',
            width: this.props.width,
            height: this.props.height,
          },
        }}
      >
        <div className="chata-modal-body">{this.props.children}</div>
        <div className="chata-modal-footer">{this.renderFooter()}</div>
      </ReactModal>
    )
  }
}
