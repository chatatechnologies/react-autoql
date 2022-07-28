import React from 'react'
import PropTypes from 'prop-types'
import { Scrollbars } from 'react-custom-scrollbars-2'

import './CustomScrollbars.scss'

export default class CustomScrollbars extends React.Component {
  static propTypes = {
    autoHeight: PropTypes.bool,
    style: PropTypes.shape({}),
  }

  static defaultProps = {
    autoHeight: false,
    style: {},
  }

  state = {}

  render = () => {
    return (
      <Scrollbars
        ref={this.props.innerRef}
        className={`react-autoql-custom-scrollbars ${this.props.className}`}
        style={this.props.style}
        renderThumbVertical={(props) => (
          <div {...props} className="thumb-vertical" />
        )}
        renderThumbHorizontal={(props) => (
          <div {...props} className="thumb-horizontal" />
        )}
        renderView={(props) => (
          <div {...props} className="custom-scrollbar-view" />
        )}
        autoHeight={this.props.autoHeight}
        autoHide
      >
        <div
          style={{
            position: 'absolute',
            height: '100%',
            width: '100%',
          }}
        >
          {this.props.children}
        </div>
      </Scrollbars>
    )
  }
}
