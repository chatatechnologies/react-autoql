import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'
import { MdClose } from 'react-icons/md'

import styles from './Modal.css'

export default class Modal extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    isVisible: PropTypes.bool,
    onClose: PropTypes.func,
    onConfirm: PropTypes.func
  }

  static defaultProps = {
    title: '',
    isVisible: false,
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
            <div className="chata-modal">
              <div className="chata-modal-header">
                {this.props.title}
                <MdClose
                  className="chata-modal-close-btn"
                  onClick={this.props.onClose}
                />
              </div>
              <div className="chata-modal-body">{this.props.children}</div>
              <div className="chata-modal-footer">
                <div
                  className="chata-confirm-btn no"
                  onClick={this.props.onClose}
                >
                  Cancel
                </div>
                <div
                  className="chata-confirm-btn yes"
                  onClick={this.props.onConfirm}
                >
                  Save Columns
                </div>
              </div>
            </div>
          }
        >
          <div />
        </Popover>
      </Fragment>
    )
  }
}
