import React from 'react'
import PropTypes from 'prop-types'
import PerfectScrollbar from 'react-perfect-scrollbar'

import './CustomScrollbars.scss'
import 'react-perfect-scrollbar/dist/css/styles.css'

export default class CustomScrollbars extends React.Component {
  static propTypes = {
    style: PropTypes.shape({}),
    autoHide: PropTypes.bool,
  }

  static defaultProps = {
    style: {},
    autoHide: false,
  }

  update = () => this.forceUpdate()

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

  getStyleProp = () => {
    let style = {}

    if (this.props.style) {
      style = { ...this.props.style }
    }

    style.maxHeight = this.props.maxHeight
    style.minHeight = this.props.minHeight

    return style
  }

  render = () => {
    if (!this.props.children) {
      return null
    }

    return (
      <PerfectScrollbar
        className={`react-autoql-custom-scrollbars 
            ${this.props.className ?? ''}
            ${this.props.autoHide ? 'autohide' : ''}`}
        ref={(r) => (this.ref = r)}
        style={this.getStyleProp()}
      >
        {this.props.children}
      </PerfectScrollbar>
    )
  }
}
