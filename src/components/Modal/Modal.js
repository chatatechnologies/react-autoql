import React from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'

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
    footer: PropTypes.instanceOf(<div></div>)
  }

  static defaultProps = {
    title: '',
    isVisible: false,
    width: 500,
    height: undefined,
    showCancelButton: true,
    enableBodyScroll: false,
    showFooter: true,
    confirmLoading: false,
    confirmText: undefined,
    footer: undefined,
    confirmDisabled: false,
    onClose: () => {},
    onConfirm: () => {}
  }

  render = () => {
    return (
      <Popover
        isOpen={this.props.isVisible}
        // onClickOutside={this.props.onClose}
        // position={'bottom'} // preferred position
        containerClassName="chata-modal-container"
        contentLocation={{ top: 0, left: 0 }}
        data-test="chata-modal"
        content={
          <div
            className="chata-modal"
            style={{
              ...this.props.style,
              width: this.props.width,
              height: this.props.height
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
                overflow: this.props.enableBodyScroll ? 'auto' : 'hidden'
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
          </div>
        }
      >
        <div />
      </Popover>
    )
  }
}
