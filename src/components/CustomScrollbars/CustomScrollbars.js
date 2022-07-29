import React from 'react'
import PropTypes from 'prop-types'
import { Scrollbars } from 'react-custom-scrollbars-2'

import './CustomScrollbars.scss'

export default class CustomScrollbars extends React.Component {
  constructor(props) {
    super(props)
    this.viewRef = React.createRef()
  }

  static propTypes = {
    autoHeight: PropTypes.bool,
    autoHide: PropTypes.bool,
    style: PropTypes.shape({}),
  }

  static defaultProps = {
    autoHeight: false,
    autoHide: true,
    style: {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  getView = () => {
    return this.scrollComponent?.view
  }

  getClassName = () =>
    `react-autoql-custom-scrollbars ${this.props.className || ''}`

  renderThumbHorizontal = (props) => (
    <div {...props} className="thumb-horizontal" />
  )

  renderThumbVertical = (props) => <div {...props} className="thumb-vertical" />

  renderView = (props) => <div {...props} className="custom-scrollbar-view" />

  render = () => {
    return (
      <Scrollbars
        ref={(r) => (this.scrollComponent = r)}
        className={this.getClassName()}
        style={this.props.style}
        renderView={this.renderView}
        autoHide={this.props.autoHide}
        autoHeight={this.props.autoHeight}
        renderThumbVertical={this.renderThumbVertical}
        renderThumbHorizontal={this.renderThumbHorizontal}
      >
        {this.props.children}
      </Scrollbars>
    )
  }
}
