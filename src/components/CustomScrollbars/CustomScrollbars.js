import React from 'react'
import { Scrollbars } from 'react-custom-scrollbars-2'

import './CustomScrollbars.scss'

export default class CustomScrollbars extends React.Component {
  static propTypes = {}

  static defaultProps = {}

  state = {}

  render = () => {
    return (
      <Scrollbars
        {...this.props}
        ref={this.props.innerRef}
        className={`react-autoql-custom-scrollbars ${this.props.className}`}
        renderTrackVertical={(props) => (
          <div {...props} className="track-vertical" />
        )}
        renderTrackHorizontal={(props) => (
          <div {...props} className="track-horizontal" />
        )}
        renderThumbVertical={(props) => (
          <div {...props} className="thumb-vertical" />
        )}
        renderThumbHorizontal={(props) => (
          <div {...props} className="thumb-horizontal" />
        )}
        renderView={(props) => (
          <div {...props} className="custom-scrollbar-view" />
        )}
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
