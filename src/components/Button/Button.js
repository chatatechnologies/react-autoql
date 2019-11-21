import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'
import { MdClose } from 'react-icons/md'

import styles from './Button.css'

export default class Button extends React.Component {
  validTypes = ['default', 'primary']
  validSizes = ['small', 'large']

  static propTypes = {
    type: PropTypes.string,
    onClick: PropTypes.func,
    loading: PropTypes.bool,
    size: PropTypes.string
  }

  static defaultProps = {
    type: 'default',
    loading: false,
    size: 'large',
    onClick: () => {}
  }

  getType = () => {
    try {
      const type = this.props.type.trim().toLowerCase()
      if (this.validTypes.includes(type)) {
        return type
      }
    } catch (error) {
      return 'default'
    }
  }

  getSize = () => {
    let size
    try {
      const trimmedSize = this.props.size.trim().toLowerCase()
      if (this.validSizes.includes(trimmedSize)) {
        size = trimmedSize
      }
    } catch (error) {
      console.error(error)
      size = 'large'
    }

    let sizeCss = {}
    if (size === 'small') {
      sizeCss = {
        padding: '2px 8px',
        margin: '2px 3px'
      }
    } else if (size === 'large') {
      sizeCss = {
        padding: '5px 16px',
        margin: '2px 5px'
      }
    }

    return sizeCss
  }

  render = () => {
    const type = this.getType()
    const sizeCss = this.getSize()

    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <div
          className={`chata-btn ${type} ${this.props.className || ''}`}
          onClick={this.props.onClick}
          style={{ ...sizeCss }}
        >
          {this.props.loading && <div>...</div>}
          {this.props.children}
        </div>
      </Fragment>
    )
  }
}
