import React from 'react'
import PropTypes from 'prop-types'
import PerfectScrollbar from 'react-perfect-scrollbar'

import './CustomScrollbars.scss'

export default class CustomScrollbars extends React.Component {
  MAX_UPDATE_DURATION = 5000

  static propTypes = {
    style: PropTypes.shape({}),
    autoHide: PropTypes.bool,
    autoHeightMax: PropTypes.number,
    autoHeightMin: PropTypes.number,
    contentHidden: PropTypes.bool,
  }

  static defaultProps = {
    style: {},
    autoHide: false,
    autoHeightMin: undefined,
    autoHeightMax: undefined,
    contentHidden: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.update()
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.contentHidden && !this.props.contentHidden) {
      this.update()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearInterval(this.intervalID)
    clearTimeout(this.timeoutID)
  }

  update = (duration) => {
    if (!this._isMounted) {
      return
    }

    if (typeof duration !== 'number' || duration > this.MAX_UPDATE_DURATION) {
      this.ref?._ps?.update()
    } else {
      clearInterval(this.intervalID)

      const intervalFrequency = 50
      const numUpdates = Math.ceil(duration / intervalFrequency)

      this.x = 0
      this.intervalID = setInterval(() => {
        this.ref?._ps?.update()

        if (++this.x === numUpdates) {
          clearInterval(this.intervalID)
        }
      }, intervalFrequency)
    }
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
