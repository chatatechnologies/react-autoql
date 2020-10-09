import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactModal from 'react-modal'
import _isEqual from 'lodash.isequal'

import { Button } from '../Button'
import { Icon } from '../Icon'
import { ConfirmModal } from '../ConfirmModal'

import { themeConfigType } from '../../props/types'
import { themeConfigDefault } from '../../props/defaults'
import { setCSSVars } from '../../js/Util'

import './Modal.scss'

export default class Modal extends React.Component {
  static propTypes = {
    themeConfig: themeConfigType,
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
    confirmOnClose: PropTypes.bool,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
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
    confirmOnClose: false,
    onClose: () => {},
    onConfirm: () => {},
  }

  state = {
    isConfirmCloseModalVisible: false,
  }

  componentDidMount = () => {
    const { themeConfig } = this.props
    const prefix = '--react-autoql-modal-'
    setCSSVars({ themeConfig, prefix })
  }

  componentDidUpdate = (prevProps) => {
    if (!_isEqual(this.props.themeConfig, prevProps.themeConfig)) {
      const { themeConfig } = this.props
      const prefix = '--react-autoql-modal-'
      setCSSVars({ themeConfig, prefix })
    }
  }

  onClose = () => {
    if (this.props.confirmOnClose) {
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
      <div>
        {this.props.showCancelButton && (
          <Button type="default" onClick={this.onClose}>
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
    )
  }

  render = () => {
    return (
      <Fragment>
        <ReactModal
          isOpen={this.props.isVisible}
          bodyOpenClassName="react-autoql-modal-container"
          ariaHideApp={false}
          contentLocation={{ top: 0, left: 0 }}
          closeTimeoutMS={200}
          data-test="react-autoql-modal"
          style={{
            content: {
              ...this.props.style,
              bottom: 'auto',
              width: this.props.width,
              height: this.props.height,
            },
          }}
        >
          <div className="react-autoql-modal-header">
            {this.props.title}
            <Icon
              type="close"
              className="react-autoql-modal-close-btn"
              onClick={this.onClose}
            />
          </div>
          <div
            className="react-autoql-modal-body"
            style={{
              overflow: this.props.enableBodyScroll ? 'auto' : 'hidden',
            }}
          >
            {this.props.children}
          </div>
          {this.props.showFooter && (
            <div className="react-autoql-modal-footer">
              {this.renderFooter()}
            </div>
          )}
        </ReactModal>
        <ConfirmModal
          isVisible={this.state.isConfirmCloseModalVisible}
          onClose={() => {
            this.setState({ isConfirmCloseModalVisible: false })
          }}
          confirmText="Discard Changes"
          onConfirm={() => {
            this.setState({ isConfirmCloseModalVisible: false })
            this.props.onClose()
          }}
        >
          <h3>Are you sure you want to leave this page?</h3>
          <p>All unsaved changes will be lost.</p>
        </ConfirmModal>
      </Fragment>
    )
  }
}
