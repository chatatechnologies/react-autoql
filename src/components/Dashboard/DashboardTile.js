import React, { Fragment } from 'react'

import { ResponseRenderer } from '../ResponseRenderer'
import LoadingDots from '../LoadingDots/LoadingDots.js'

export default class DashboardTile extends React.Component {
  supportedDisplayTypes = []

  static propTypes = {}

  static defaultProps = {}

  state = {}

  renderTilePlaceholder = () => {
    return <LoadingDots />
  }

  render = () => {
    const { onMouseDown, onMouseUp, onTouchStart, onTouchEnd } = this.props
    const propsToPassToDragHandle = {
      onMouseDown,
      onMouseUp,
      onTouchStart,
      onTouchEnd
    }

    return (
      <Fragment>
        <div
          className={this.props.className}
          style={{ ...this.props.style }}
          key={this.props.key}
          data-grid={this.props.tile}
          {...propsToPassToDragHandle}
        >
          {this.props.children}
          <div className="chata-dashboard-tile-drag-handle" />
          <div className="chata-dashboard-tile-inner-div">
            {this.props.response ? (
              <ResponseRenderer />
            ) : (
              this.renderTilePlaceholder()
            )}
          </div>
        </div>
      </Fragment>
    )
  }
}
