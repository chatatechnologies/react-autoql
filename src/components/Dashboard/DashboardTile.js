import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import { ResponseRenderer } from '../ResponseRenderer'
import LoadingDots from '../LoadingDots/LoadingDots.js'

import { runQuery } from '../../js/queryService'

export default class DashboardTile extends React.Component {
  supportedDisplayTypes = []

  static propTypes = {
    apiKey: PropTypes.string.isRequired,
    customerId: PropTypes.string.isRequired,
    userId: PropTypes.string.isRequired,
    domain: PropTypes.string.isRequired,
    demo: PropTypes.bool.isRequired,
    debug: PropTypes.bool.isRequired,
    enableSafetyNet: PropTypes.bool.isRequired,
    isEditing: PropTypes.bool.isRequired,
    query: PropTypes.string,
    title: PropTypes.string
  }

  static defaultProps = {
    query: '',
    title: ''
  }

  state = {
    response: null
  }

  componentDidMount = () => {}

  processTile = () => {
    if (this.props.query) {
      runQuery(
        this.props.query,
        this.props.demo,
        this.props.debug,
        this.props.enableSafetyNet,
        this.props.domain,
        this.props.apiKey,
        this.props.customerId,
        this.props.userId
      ).then(response => {
        this.setState({ response })
      })
    }
  }

  renderDragHandle = () => <div className="chata-dashboard-tile-drag-handle" />

  renderTitle = () => {
    return (
      <div className="dashboard-tile-title-container">
        {this.props.title || this.props.query}
        <div className="dashboard-tile-title-divider"></div>
      </div>
    )
  }

  renderTilePlaceholder = () => {
    if (this.props.isDragging) {
      return null
    }
    return (
      <div className="dashboard-tile-loading-container">
        <LoadingDots />
      </div>
    )
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
          <div className="chata-dashboard-tile-inner-div">
            {this.props.isEditing && this.renderDragHandle()}
            {this.renderTitle()}
            <div className="dashboard-tile-response-container">
              {!this.props.isDragging && this.state.response ? (
                <ResponseRenderer
                  displayType={this.props.displayType}
                  response={this.state.response}
                  renderTooltips={false}
                />
              ) : (
                this.renderTilePlaceholder()
              )}
            </div>
          </div>
        </div>
      </Fragment>
    )
  }
}
