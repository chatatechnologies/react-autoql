import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'
import { MdClose, MdPlayCircleOutline } from 'react-icons/md'

import { ResponseRenderer } from '../ResponseRenderer'
import { VizToolbar } from '../VizToolbar'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import LoadingDots from '../LoadingDots/LoadingDots.js'

import { getSupportedDisplayTypes } from '../../js/Util'
import { runQuery, runQueryOnly } from '../../js/queryService'

import './DashboardTile.css'

export default class DashboardTile extends React.Component {
  TILE_ID = uuid.v4()

  static propTypes = {
    token: PropTypes.string,
    apiKey: PropTypes.string,
    customerId: PropTypes.string,
    userId: PropTypes.string,
    username: PropTypes.string,
    domain: PropTypes.string,
    demo: PropTypes.bool.isRequired,
    debug: PropTypes.bool.isRequired,
    test: PropTypes.bool.isRequired,
    enableSafetyNet: PropTypes.bool.isRequired,
    isEditing: PropTypes.bool.isRequired,
    tile: PropTypes.shape({}).isRequired,
    deleteTile: PropTypes.func.isRequired,
    chartColors: PropTypes.arrayOf(PropTypes.string),
    queryResponse: PropTypes.shape({}),
    currencyCode: PropTypes.string,
    languageCode: PropTypes.string,
    currencyDecimals: PropTypes.number,
    quantityDecimals: PropTypes.number,
    titleColor: PropTypes.string.isRequired
  }

  static defaultProps = {
    query: '',
    title: '',
    displayType: 'table',
    token: undefined,
    apiKey: undefined,
    customerId: undefined,
    userId: undefined,
    username: undefined,
    domain: undefined,
    isNewTile: false,
    safetyNetSelections: undefined,
    selectedSuggestion: undefined,
    currencyCode: undefined,
    languageCode: undefined,
    currencyDecimals: undefined,
    quantityDecimals: undefined,
    chartColors: undefined
  }

  state = {
    query: this.props.tile.query,
    title: this.props.tile.title,
    isExecuting: false
  }

  componentDidUpdate = prevProps => {
    // If query or title change from props (due to undo for example), update state
    if (_get(this.props, 'tile.query') !== _get(prevProps, 'tile.query')) {
      this.setState({ query: _get(this.props, 'tile.query') })
    }

    if (_get(this.props, 'tile.title') !== _get(prevProps, 'tile.title')) {
      this.setState({ title: _get(this.props, 'tile.title') })
    }
  }

  isQueryValid = query => {
    return query && query.trim()
  }

  startQuery = () => {
    this.setState({
      isExecuting: true
    })
    this.props.setParamsForTile(
      {
        queryResponse: null,
        displayType: null,
        isNewTile: false,
        selectedSuggestion: undefined,
        safetyNetSelection: undefined
      },
      this.props.tile.i
    )
  }

  endQuery = response => {
    this.props.setParamsForTile(
      {
        queryResponse: response,
        isNewTile: false,
        selectedSuggestion: undefined,
        safetyNetSelection: undefined
      },
      this.props.tile.i
    )
    this.setState({
      isExecuting: false
    })
  }

  processTile = (query, skipSafetyNet) => {
    const q = query || this.props.tile.selectedSuggestion || this.state.query
    if (this.isQueryValid(q)) {
      this.startQuery()

      if (
        skipSafetyNet ||
        _get(this.props.queryResponse, 'data.full_suggestion')
      ) {
        runQueryOnly({
          query: q,
          demo: this.props.demo,
          debug: this.props.debug,
          domain: this.props.domain,
          apiKey: this.props.apiKey,
          customerId: this.props.customerId,
          userId: this.props.userId,
          username: this.props.username,
          token: this.props.token
        })
          .then(response => this.endQuery(response))
          .catch(error => this.endQuery(error))
      } else {
        runQuery({
          query: q,
          demo: this.props.demo,
          debug: this.props.debug,
          domain: this.props.domain,
          apiKey: this.props.apiKey,
          customerId: this.props.customerId,
          userId: this.props.userId,
          username: this.props.username,
          token: this.props.token,
          useSafetyNet: !this.props.isEditing
            ? false
            : this.props.enableSafetyNet
        })
          .then(response => this.endQuery(response))
          .catch(error => this.endQuery(error))
      }
    }
  }

  onQueryTextKeyDown = e => {
    if (e.key === 'Enter') {
      this.processTile(e.target.value)
      e.target.blur()
    }
  }

  onSuggestionClick = (suggestion, isButtonClick) => {
    this.setState({ query: suggestion })

    if (isButtonClick) {
      this.props.setParamsForTile({ query: suggestion }, this.props.tile.i)
      this.processTile(suggestion, true)
    } else {
      this.props.setParamsForTile(
        { selectedSuggestion: suggestion },
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
              onBlur={e => {
                if (_get(this.props, 'tile.query') !== e.target.value) {
                  this.props.setParamsForTile(
                    { query: e.target.value, displayType: undefined },
                    this.props.tile.i
                  )
                }
              }}
            />
            <input
              className="dashboard-tile-input title"
              placeholder="Title (optional)"
              value={this.state.title}
              onChange={e => this.setState({ title: e.target.value })}
              onBlur={e =>
                this.props.setParamsForTile(
                  { title: e.target.value },
                  this.props.tile.i
                )
              }
            />
          </div>
          <div
            onMouseDown={e => e.stopPropagation()}
            className={`dashboard-tile-play-button${
              !this.isQueryValid(this.state.query) ? ' disabled' : ''
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
        <span
          className="dashboard-tile-title"
          style={{ color: this.props.titleColor }}
        >
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
    if (this.state.isExecuting) {
      // This should always take priority over the other conditions below
      content = <LoadingDots />
    } else if (this.props.tile.isNewTile && this.props.isEditing) {
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
          {this.props.queryResponse && !this.state.isExecuting ? (
            <Fragment>
              <ResponseRenderer
                ref={ref => (this.responseRef = ref)}
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
                currencyDecimals={this.props.currencyDecimals}
                quantityDecimals={this.props.quantityDecimals}
                chartColors={this.props.chartColors}
                processDrilldown={(groupByObject, queryID, activeKey) =>
                  this.props.processDrilldown(
                    this.props.tile.i,
                    groupByObject,
                    queryID,
                    activeKey
                  )
                }
                backgroundColor={document.documentElement.style.getPropertyValue(
                  '--chata-dashboard-background-color'
                )}
                demo={this.props.demo}
                onSafetyNetSelectOption={(queryText, suggestionList) => {
                  this.setState({ query: queryText })
                  this.props.setParamsForTile(
                    {
                      query: queryText,
                      safetyNetSelections: suggestionList
                    },
                    this.props.tile.i
                  )
                }}
              />
              {this.props.isEditing && (
                <VizToolbar
                  displayType={this.props.displayType}
                  onDisplayTypeChange={displayType =>
                    this.props.setParamsForTile(
                      { displayType },
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
      <ErrorBoundary>
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
      </ErrorBoundary>
    )
  }
}
