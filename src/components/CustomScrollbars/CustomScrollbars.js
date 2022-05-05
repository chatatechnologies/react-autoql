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
        className={this.props.className}
        ref={this.props.innerRef}
        renderTrackHorizontal={({ style, ...props }) => (
          <div
            {...props}
            style={{
              ...style,
              left: '50%',
              width: '100px',
              top: 0,
              transform: 'translateX(-50%)',
            }}
          />
        )}
      >
        {this.props.children}
      </Scrollbars>
    )
  }
}
