import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import uuid from 'uuid'

import { MdClose, MdPlayCircleOutline } from 'react-icons/md'

import { ResponseRenderer } from '../ResponseRenderer'
import { VizToolbar } from '../VizToolbar'
import LoadingDots from '../LoadingDots/LoadingDots.js'

import { getSupportedDisplayTypes } from '../../js/Util'
import { runQuery, runQueryOnly } from '../../js/queryService'

export default class DashboardTile extends React.PureComponent {
  TILE_ID = uuid.v4()

  static propTypes = {
    token: PropTypes.string,
    apiKey: PropTypes.string,
    customerId: PropTypes.string,
    userId: PropTypes.string,
    domain: PropTypes.string,
    demo: PropTypes.bool.isRequired,
    debug: PropTypes.bool.isRequired,
    enableSafetyNet: PropTypes.bool.isRequired,
    isEditing: PropTypes.bool.isRequired,
    tile: PropTypes.shape({}).isRequired,
    deleteTile: PropTypes.func.isRequired,
    chartColors: PropTypes.arrayOf(PropTypes.string),
    queryResponse: PropTypes.shape({}),
    currencyCode: PropTypes.string,
    languageCode: PropTypes.string
  }

  static defaultProps = {
    query: '',
    title: '',
    token: undefined,
    apiKey: undefined,
    customerId: undefined,
    userId: undefined,
    domain: undefined,
    isNewTile: false,
    safetyNetSelections: undefined,
    selectedSuggestion: undefined,
    currencyCode: undefined,
    languageCode: undefined,
    chartColors: undefined
  }

  state = {
    query: this.props.tile.query,
    title: this.props.tile.title
  }

  onQueryTextKeyDown = e => {
    if (e.key === 'Enter') {
      this.processTile()
      e.target.blur()
    }
  }

  processTile = (query, skipSafetyNet) => {
    if (query || this.state.query) {
      const id = this.props.tile.i
      // Reset query response so tile starts "loading" again
      this.props.setParamForTile('isExecuting', true, id)
      this.props.setParamForTile('queryResponse', null, id)

      if (skipSafetyNet) {
        runQueryOnly(
          query || this.props.tile.selectedSuggestion || this.state.query,
          this.props.demo,
          this.props.debug,
          this.props.domain,
          this.props.apiKey,
          this.props.customerId,
          this.props.userId,
          this.props.token
        )
          .then(response => {
            this.props.setParamForTile('isExecuting', false, id)
            this.props.setParamForTile('queryResponse', response, id)
          })
          .catch(error => {
            this.props.setParamForTile('isExecuting', false, id)
            this.props.setParamForTile('queryResponse', error, id)
          })
      } else {
        runQuery(
          query || this.props.tile.selectedSuggestion || this.state.query,
          this.props.demo,
          this.props.debug,
          !this.props.isEditing ? false : this.props.enableSafetyNet,
          this.props.domain,
          this.props.apiKey,
          this.props.customerId,
          this.props.userId,
          this.props.token
        )
          .then(response => {
            this.props.setParamForTile('isExecuting', false, id)
            this.props.setParamForTile('queryResponse', response, id)
          })
          .catch(error => {
            this.props.setParamForTile('isExecuting', false, id)
            this.props.setParamForTile('queryResponse', error, id)
          })
      }
    }
  }

  onSuggestionClick = (suggestion, isButtonClick) => {
    this.setState({ query: suggestion })

    if (isButtonClick) {
      this.props.setParamForTile('query', suggestion, this.props.tile.i)
      this.processTile(suggestion, true)
    } else {
      this.props.setParamForTile(
        'selectedSuggestion',
        suggestion,
        this.props.tile.i
      )
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
              onKeyDown={this.onQueryTextKeyDown}
              onBlur={e =>
                this.props.setParamForTile(
                  'query',
                  e.target.value,
                  this.props.tile.i
                )
              }
            />
            <input
              className="dashboard-tile-input title"
              placeholder="Title (optional)"
              value={this.state.title}
              onChange={e => this.setState({ title: e.target.value })}
              onBlur={e =>
                this.props.setParamForTile(
                  'title',
                  e.target.value,
                  this.props.tile.i
                )
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
            onClick={() => this.props.deleteTile(this.props.tile.i)}
          >
            <MdClose />
          </div>
        </div>
      )
    }
    return (
      <div className="dashboard-tile-title-container">
        <span className="dashboard-tile-title">
          {this.props.tile.title || this.props.tile.query || 'Untitled'}
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
    if (this.props.tile.isNewTile && this.props.isEditing) {
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
    } else if (this.props.tile.isNewTile) {
      content = (
        <div className="dashboard-tile-placeholder-text">
          <em>This tile has no query</em>
        </div>
      )
    } else if (this.props.tile.isExecuting) {
      content = <LoadingDots />
    } else {
      content = (
        <div className="dashboard-tile-placeholder-text">
          <em>{this.props.notExecutedText || 'Not Executed'}</em>
        </div>
      )
    }

    return <div className="dashboard-tile-loading-container">{content}</div>
  }

  renderContent = () => {
    return (
      <div
        className={`dashboard-tile-response-wrapper
      ${this.props.isEditing ? ' editing' : ''}
      ${this.props.tile.h < 4 ? ' small' : ''}`}
      >
        <div
          onMouseDown={e => e.stopPropagation()}
          className="dashboard-tile-response-container"
        >
          {this.props.queryResponse && !this.props.tile.isExecuting ? (
            <Fragment>
              <ResponseRenderer
                displayType={this.props.displayType}
                response={this.props.queryResponse}
                renderTooltips={false}
                autoSelectSafetyNetSuggestion={false}
                safetyNetSelections={this.props.tile.safetyNetSelections}
                renderSuggestionsAsDropdown={this.props.tile.h < 4}
                onSuggestionClick={this.onSuggestionClick}
                selectedSuggestion={this.props.tile.selectedSuggestion}
                enableSuggestions={this.props.isEditing}
                currencyCode={this.props.currencyCode}
                languageCode={this.props.languageCode}
                chartColors={this.props.chartColors}
                onSafetyNetSelectOption={(queryText, suggestionList) => {
                  this.setState({ query: queryText })
                  this.props.setParamForTile(
                    'query',
                    queryText,
                    this.props.tile.i
                  )
                  this.props.setParamForTile(
                    'safetyNetSelections',
                    suggestionList,
                    this.props.tile.i
                  )
                }}
              />
              {this.props.isEditing && (
                <VizToolbar
                  displayType={this.props.displayType}
                  onDisplayTypeChange={displayType =>
                    this.props.setParamForTile(
                      'displayType',
                      displayType,
                      this.props.tile.i
                    )
                  }
                  supportedDisplayTypes={
                    getSupportedDisplayTypes(this.props.queryResponse) || []
                  }
                />
              )}
            </Fragment>
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
