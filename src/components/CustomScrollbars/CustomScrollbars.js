import React from 'react'
import PropTypes from 'prop-types'
import PerfectScrollbar from 'react-perfect-scrollbar'

import './CustomScrollbars.scss'

export default class CustomScrollbars extends React.Component {
  static propTypes = {
    style: PropTypes.shape({}),
    autoHide: PropTypes.bool,
    autoHeightMax: PropTypes.number,
    autoHeightMin: PropTypes.number,
  }

  static defaultProps = {
    style: {},
    autoHide: false,
    autoHeightMin: undefined,
    autoHeightMax: undefined,
  }

  getContainer = () => {
    return this.ref?._container
  }

  getScrollTop = () => {
    return this.ref?._container?.scrollTop
  }

  getClientHeight = () => {
    return this.ref?._container?.clientHeight
  }

  scrollToTop = () => {
    if (this.ref?._container) {
      this.ref._container.scrollTop = 0
    }
  }

  scrollToBottom = () => {
    const container = this.ref?._container
    if (container) {
      container.scrollBottom = 0
      container.scrollTop = container.scrollHeight - container.clientHeight
    }
  }

  render = () => {
    const style = {
      maxHeight: this.props.autoHeightMax,
      minHeight: this.props.autoHeightMin,
      // ...this.props.style,
    }

    if (this.props.children) {
      return (
        <PerfectScrollbar
          className={`react-autoql-custom-scrollbars 
            ${this.props.className ?? ''}
            ${this.props.autoHide ? 'autohide' : ''}`}
          ref={(r) => (this.ref = r)}
          style={style}
        >
          {this.props.children}
        </PerfectScrollbar>
      )
    }

    return null
  }
}
