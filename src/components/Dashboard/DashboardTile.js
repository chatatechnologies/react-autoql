import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import { MdClose } from 'react-icons/md'

import { ResponseRenderer } from '../ResponseRenderer'
import LoadingDots from '../LoadingDots/LoadingDots.js'

import { runQuery } from '../../js/queryService'

export default class DashboardTile extends React.PureComponent {
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
    title: PropTypes.string,
    tileId: PropTypes.string.isRequired,
    setResponseForTile: PropTypes.func.isRequired,
    deleteTile: PropTypes.func.isRequired,
    queryResponse: PropTypes.shape({})
  }

  static defaultProps = {
    query: '',
    title: ''
  }

  processTile = () => {
    if (this.props.query) {
      // Reset query response so tile starts "loading" again
      this.props.setResponseForTile(null, this.props.tileId)
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
        this.props.setResponseForTile(response, this.props.tileId)
      })
    }
  }

  renderDragHandle = () => <div className="chata-dashboard-tile-drag-handle" />

  renderHeader = () => {
    if (this.props.isEditing) {
      return (
        <div className="dashboard-tile-edit-wrapper">
          <div
            className="dashboard-tile-input-container"
            onMouseDown={e => e.stopPropagation()}
          >
            <input
              className="dashboard-tile-input query"
              defaultValue={this.props.query}
              placeholder="Query"
            />
            <input
              className="dashboard-tile-input title"
              defaultValue={this.props.title}
              placeholder="Title (optional)"
            />
          </div>
          <div
            onMouseDown={e => e.stopPropagation()}
            className="dashboard-tile-delete-button"
            onClick={() => this.props.deleteTile(this.props.tileId)}
          >
            <MdClose />
          </div>
        </div>
      )
    }
    return (
      <div className="dashboard-tile-title-container">
        <span className="dashboard-tile-title">
          {this.props.title || this.props.query}
        </span>
        <div className="dashboard-tile-title-divider"></div>
      </div>
    )
  }

  renderDraggingPlaceholder = () => {
    return (
      <div className="chata-db-dragging-placeholder-container">
        <div className="chata-db-dragging-placeholder-title"></div>
        <div className="chata-db-dragging-placeholder-content"></div>
      </div>
    )
  }

  renderContent = () => (
    <div
      className={`dashboard-tile-response-wrapper${
        this.props.isEditing ? ' editing' : ''
      }`}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        className="dashboard-tile-response-container"
      >
        {this.props.queryResponse ? (
          <ResponseRenderer
            displayType={this.props.displayType}
            response={this.props.queryResponse}
            renderTooltips={false}
          />
        ) : (
          <div className="dashboard-tile-loading-container">
            <LoadingDots />
          </div>
        )}
      </div>
    </div>
  )

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
            {this.props.isDragging ? (
              this.renderDraggingPlaceholder()
            ) : (
              <Fragment>
                {this.renderHeader()}
                {this.renderContent()}
              </Fragment>
            )}
          </div>
        </div>
      </Fragment>
    )
  }
}
