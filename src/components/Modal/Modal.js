import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'
import { MdClose } from 'react-icons/md'

import { Button } from '../Button'

import styles from './Modal.css'

export default class Modal extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    isVisible: PropTypes.bool,
    onClose: PropTypes.func,
    onConfirm: PropTypes.func,
    width: PropTypes.number,
    height: PropTypes.number,
    showCancelButton: PropTypes.bool,
    showFooter: PropTypes.bool,
    enableBodyScroll: PropTypes.bool,
    confirmLoading: PropTypes.bool
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
    onClose: () => {},
    onConfirm: () => {}
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <Popover
          isOpen={this.props.isVisible}
          // onClickOutside={this.props.onClose}
          // position={'bottom'} // preferred position
          containerClassName="chata-modal-container"
          contentLocation={{ top: 0, left: 0 }}
          content={
            <div
              className="chata-modal"
              // onScroll={e => console.log('SCROLL START')}
              style={{
                ...this.props.style,
                width: this.props.width,
                height: this.props.height
              }}
            >
              <div className="chata-modal-header">
                {this.props.title}
                <MdClose
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
                  {this.props.showCancelButton && (
                    <Button type="default" onClick={this.props.onClose}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="primary"
                    onClick={this.props.onConfirm}
                    loading={this.props.confirmLoading}
                  >
                    {this.props.confirmText || 'Ok'}
                  </Button>
                </div>
              )}
            </div>
          }
        >
          <div />
        </Popover>
      </Fragment>
    )
  }
}
