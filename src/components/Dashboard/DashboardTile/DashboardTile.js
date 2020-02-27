import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'
import Autosuggest from 'react-autosuggest'

import { ResponseRenderer } from '../../ResponseRenderer'
import { VizToolbar } from '../../VizToolbar'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import LoadingDots from '../../LoadingDots/LoadingDots.js'
import { Icon } from '../../Icon'

import {
  runQuery,
  runQueryOnly,
  fetchSuggestions
} from '../../../js/queryService'

import {
  getSupportedDisplayTypes,
  getInitialDisplayType,
  isDisplayTypeValid
} from '../../../js/Util'

import {
  authenticationType,
  autoQLConfigType,
  dataFormattingType,
  themeConfigType
} from '../../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  themeConfigDefault
} from '../../../props/defaults'

import './DashboardTile.scss'

let autoCompleteArray = []

export default class DashboardTile extends React.Component {
  TILE_ID = uuid.v4()
  autoCompleteTimer = undefined

  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    themeConfig: themeConfigType,

    isEditing: PropTypes.bool.isRequired,
    tile: PropTypes.shape({}).isRequired,
    deleteTile: PropTypes.func.isRequired,
    queryResponse: PropTypes.shape({})
  }

  static defaultProps = {
    // Global
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    themeConfig: themeConfigDefault,

    query: '',
    title: '',
    displayType: 'table',
    isNewTile: false,
    safetyNetSelections: undefined,
    selectedSuggestion: undefined
  }

  state = {
    query: this.props.tile.query,
    sql: this.props.tile.sql,
    title: this.props.tile.title,
    isSql: !!this.props.tile.sql,
    isExecuting: false,
    suggestions: []
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

  componentWillUnmount = () => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
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
        isNewTile: false,
        selectedSuggestion: undefined,
        safetyNetSelection: undefined
      },
      this.props.tile.i
    )
  }

  endQuery = response => {
    const newDisplayType = isDisplayTypeValid(response, this.props.displayType)
      ? this.props.displayType
      : getInitialDisplayType(response)

    this.props.setParamsForTile(
      {
        queryResponse: response,
        isNewTile: false,
        // We want to keep the saved display type if possible
        // If not, we need to reset to the new default display type for that query
        displayType: newDisplayType,
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
          ...this.props.authentication,
          ...this.propa.autoQLConfig,
          source: 'dashboard'
        })
          .then(response => this.endQuery(response))
          .catch(error => this.endQuery(error))
      } else {
        runQuery({
          query: q,
          ...this.props.authentication,
          ...this.props.autoQLConfig,
          enableQueryValidation: !this.props.isEditing
            ? false
            : this.props.autoQLConfig.enableQueryValidation,
          source: 'dashboard'
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

  onSuggestionsFetchRequested = ({ value }) => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
    this.autoCompleteTimer = setTimeout(() => {
      fetchSuggestions({
        suggestion: value,
        ...this.props.authentication
      })
        .then(response => {
          const body = this.props.authentication.demo
            ? response.data
            : _get(response, 'data.data')

          const sortingArray = []
          let suggestionsMatchArray = []
          autoCompleteArray = []
          suggestionsMatchArray = body.matches

          for (let i = 0; i < suggestionsMatchArray.length; i++) {
            sortingArray.push(suggestionsMatchArray[i])

            if (i === 4) {
              break
            }
          }

          sortingArray.sort((a, b) => b.length - a.length)
          for (let idx = 0; idx < sortingArray.length; idx++) {
            const anObject = {
              name: sortingArray[idx]
            }
            autoCompleteArray.push(anObject)
          }

          this.setState({
            suggestions: autoCompleteArray
          })
        })
        .catch(error => {
          console.error(error)
        })
    }, 300)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: []
    })
  }

  userSelectedSuggestionHandler = userSelectedValueFromSuggestionBox => {
    if (
      userSelectedValueFromSuggestionBox &&
      userSelectedValueFromSuggestionBox.name
    ) {
      this.userSelectedValue = userSelectedValueFromSuggestionBox.name
      this.userSelectedSuggestion = true
      this.setState({ query: userSelectedValueFromSuggestionBox.name })
    }
  }

  onQueryInputChange = e => {
    if (this.userSelectedSuggestion && (e.keyCode === 38 || e.keyCode === 40)) {
      // keyup or keydown
      return // return to let the component handle it...
    }

    if (_get(e, 'target.value') || _get(e, 'target.value') === '') {
      this.setState({ query: e.target.value })
    } else {
      // User clicked on autosuggest item
      this.processTile(this.userSelectedValue)
    }
  }

  renderHeader = () => {
    if (this.props.isEditing) {
      return (
        <div className="dashboard-tile-edit-wrapper">
          <div
            className={`dashboard-tile-input-container ${
              this.state.isQueryInputFocused ? 'query-focused' : ''
            }`}
            onMouseDown={e => e.stopPropagation()}
          >
            {this.props.autoQLConfig.enableAutocomplete ? (
              <Autosuggest
                onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                getSuggestionValue={this.userSelectedSuggestionHandler}
                suggestions={this.state.suggestions}
                ref={ref => {
                  this.autoSuggest = ref
                }}
                renderSuggestion={suggestion => {
                  return <Fragment>{suggestion.name}</Fragment>
                }}
                inputProps={{
                  className: `dashboard-tile-autocomplete-input`,
                  placeholder: 'Query',
                  value: this.state.query,
                  onFocus: () => this.setState({ isQueryInputFocused: true }),
                  onChange: this.onQueryInputChange,
                  onKeyDown: this.onQueryTextKeyDown,
                  onBlur: e => {
                    if (_get(this.props, 'tile.query') !== e.target.value) {
                      this.props.setParamsForTile(
                        { query: e.target.value, displayType: undefined },
                        this.props.tile.i
                      )
                    }
                    this.setState({ isQueryInputFocused: false })
                  }
                }}
              />
            ) : (
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
            )}
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
            <Icon type="play" onClick={() => this.processTile()} />
          </div>
          <div
            className="dashboard-tile-delete-button"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => this.props.deleteTile(this.props.tile.i)}
          >
            <Icon type="close" />
          </div>
        </div>
      )
    }

    return (
      <div className="dashboard-tile-title-container">
        <span
          className="dashboard-tile-title"
          style={{ color: this.props.themeConfig.titleColor }}
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
            <Icon
              type="play"
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
                themeConfig={this.props.themeConfig}
                autoQLConfig={this.props.autoQLConfig}
                displayType={this.props.displayType}
                response={this.props.queryResponse}
                renderTooltips={false}
                autoSelectSafetyNetSuggestion={false}
                safetyNetSelections={this.props.tile.safetyNetSelections}
                renderSuggestionsAsDropdown={this.props.tile.h < 4}
                onSuggestionClick={this.onSuggestionClick}
                selectedSuggestion={this.props.tile.selectedSuggestion}
                dataFormatting={this.props.dataFormatting}
                onDataClick={(groupByObject, queryID, activeKey) =>
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
                demo={this.props.authentication.demo}
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
                  displayType={
                    this.props.displayType ||
                    getInitialDisplayType(this.props.queryResponse)
                  }
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
          data-test="chata-dashboard-tile"
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
