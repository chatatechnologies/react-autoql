import React from 'react'
import PropTypes from 'prop-types'
import { Scrollbars } from 'rc-scrollbars'
import { isMobile } from 'react-device-detect'

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
    autoHeight: true,
    autoHide: isMobile,
    autoHeightMin: '100%',
    autoHeightMax: '100%',
    style: {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  getView = () => {
    return this.ref?.view
  }

  getClassName = () => `react-autoql-custom-scrollbars ${this.props.className || ''}`

  renderThumbHorizontal = (props) => <div {...props} className='thumb-horizontal' />

  renderThumbVertical = (props) => <div {...props} className='thumb-vertical' />

  renderView = (props) => <div {...props} className='custom-scrollbar-view' />

  render = () => {
    return (
      <Scrollbars
        ref={(r) => (this.ref = r)}
        className={this.getClassName()}
        style={{
          ...this.props.style,
          height: '100%',
          width: '100%',
        }}
        renderView={this.renderView}
        autoHide={this.props.autoHide}
        autoHeight={this.props.autoHeight}
        autoHeightMin={this.props.autoHeightMin}
        autoHeightMax={this.props.autoHeightMax}
        renderThumbVertical={this.renderThumbVertical}
        renderThumbHorizontal={this.renderThumbHorizontal}
        thumbMinSize={30}
        // universal={true}
      >
        {this.props.children}
      </Scrollbars>
    )
  }
}
