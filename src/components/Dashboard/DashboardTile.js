import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import uuid from 'uuid'

import { MdClose, MdPlayCircleOutline } from 'react-icons/md'

import { ResponseRenderer } from '../ResponseRenderer'
import LoadingDots from '../LoadingDots/LoadingDots.js'

import { runQuery } from '../../js/queryService'

export default class DashboardTile extends React.PureComponent {
  supportedDisplayTypes = []
  TILE_ID = uuid.v4()

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
    isNewTile: PropTypes.bool,
    queryResponse: PropTypes.shape({}),
    safetyNetSelections: PropTypes.arrayOf(PropTypes.shape({})),
    updateTileSafetyNetSelections: PropTypes.func.isRequired
  }

  static defaultProps = {
    query: '',
    title: '',
    isNewTile: false,
    safetyNetSelections: undefined
  }

  state = {
    query: this.props.query,
    title: this.props.title
  }

  processTile = () => {
    if (this.state.query) {
      // Reset query response so tile starts "loading" again
      this.props.setResponseForTile(null, this.props.tileId)
      runQuery(
        this.state.query,
        this.props.demo,
        this.props.debug,
        !this.props.isEditing ? false : this.props.enableSafetyNet,
        this.props.domain,
        this.props.apiKey,
        this.props.customerId,
        this.props.userId
      )
        .then(response => {
          this.props.setResponseForTile(response, this.props.tileId)
        })
        .catch(error => {
          this.props.setResponseForTile(error, this.props.tileId)
        })
    }
  }

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
              placeholder="Query"
              value={this.state.query}
              onChange={e => this.setState({ query: e.target.value })}
              onBlur={e =>
                this.props.updateTileQuery(e.target.value, this.props.tileId)
              }
            />
            <input
              className="dashboard-tile-input title"
              placeholder="Title (optional)"
              value={this.state.title}
              onChange={e => this.setState({ title: e.target.value })}
              onBlur={e =>
                this.props.updateTileTitle(e.target.value, this.props.tileId)
              }
            />
          </div>
          <div
            onMouseDown={e => e.stopPropagation()}
            className={`dashboard-tile-play-button${
              !this.state.query ? ' disabled' : ''
            }`}
          >
            <MdPlayCircleOutline onClick={() => this.processTile()} />
          </div>
          <div
            className="dashboard-tile-delete-button"
            onMouseDown={e => e.stopPropagation()}
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
          {this.props.title || this.props.query || 'Untitled'}
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

  renderContentPlaceholder = () => {
    let content = null
    if (this.props.isNewTile && this.props.isEditing) {
      content = (
        <div className="dashboard-tile-placeholder-text">
          <em>
            1. Type your query in the search bar
            <br />
            2. Click{' '}
            <MdPlayCircleOutline
              style={{
                display: 'inline-block',
                marginRight: '3px',
                marginBottom: '-2px'
              }}
            />
            to fill this tile
          </em>
        </div>
      )
    } else if (this.props.isNewTile) {
      content = (
        <div className="dashboard-tile-placeholder-text">
          <em>This tile has no query</em>
        </div>
      )
    } else {
      content = <LoadingDots />
    }

    return <div className="dashboard-tile-loading-container">{content}</div>
  }

  renderContent = () => {
    const containerElement = document.getElementById(
      `chata-dashboard-tile-inner-div-${this.TILE_ID}`
    )
    let tileHeight
    if (containerElement) {
      tileHeight = containerElement.clientHeight
    }

    return (
      <div
        className={`dashboard-tile-response-wrapper
      ${this.props.isEditing ? ' editing' : ''}
      ${tileHeight < 350 ? ' small' : ''}`}
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
              autoSelectSafetyNetSuggestion={false}
              safetyNetSelections={this.props.safetyNetSelections}
              onSafetyNetSelectOption={(queryText, suggestionList) => {
                this.setState({ query: queryText })
                this.props.updateTileQuery(queryText, this.props.tileId)
                this.props.updateTileSafetyNetSelections(
                  suggestionList,
                  this.props.tileId
                )
              }}
            />
          ) : (
            this.renderContentPlaceholder()
          )}
        </div>
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
          <div
            id={`chata-dashboard-tile-inner-div-${this.TILE_ID}`}
            className="chata-dashboard-tile-inner-div"
          >
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
