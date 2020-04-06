import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'
import Autosuggest from 'react-autosuggest'
import ReactTooltip from 'react-tooltip'
import SplitterLayout from 'react-splitter-layout'
import 'react-splitter-layout/lib/index.css'

import { QueryOutput } from '../../QueryOutput'
import { VizToolbar } from '../../VizToolbar'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import LoadingDots from '../../LoadingDots/LoadingDots.js'
import { Icon } from '../../Icon'

import {
  runQuery,
  runQueryOnly,
  fetchAutocomplete,
  fetchSuggestions
} from '../../../js/queryService'

import {
  getSupportedDisplayTypes,
  getDefaultDisplayType,
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
    queryValidationSelections: undefined,
    selectedSuggestion: undefined
  }

  state = {
    query: this.props.tile.query,
    secondQuery: this.props.tile.secondQuery || this.props.tile.query,
    sql: this.props.tile.sql,
    title: this.props.tile.title,
    isSql: !!this.props.tile.sql,
    isExecuting: false,
    suggestions: [],
    isSecondQueryInputOpen: false,
    currentSource: 'user'
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
      isExecuting: true,
      isSecondQueryInputOpen: false
    })
    this.props.setParamsForTile(
      {
        isNewTile: false,
        queryResponse: null,
        secondQueryResponse: null,
        selectedSuggestion: undefined,
        safetyNetSelection: undefined,
        secondSelectedSuggestion: undefined,
        secondSafetyNetSelection: undefined
      },
      this.props.tile.i
    )
  }

  endQuery = responseArray => {
    let response = responseArray[0]
    if (responseArray && !response) {
      // An error was caught
      response = responseArray
    }

    const newDisplayType = isDisplayTypeValid(response, this.props.displayType)
      ? this.props.displayType
      : getDefaultDisplayType(response)

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

    if (responseArray[1]) {
      const secondResponse = responseArray[1]
      const newDisplayType = isDisplayTypeValid(
        secondResponse,
        this.props.secondDisplayType
      )
        ? this.props.secondDisplayType
        : getDefaultDisplayType(secondResponse)

      this.props.setParamsForTile(
        {
          secondQueryResponse: secondResponse,
          secondDisplayType: newDisplayType,
          secondSelectedSuggestion: undefined,
          secondSafetyNetSelection: undefined
        },
        this.props.tile.i
      )
    }

    this.setState({
      isExecuting: false
    })
  }

  fetchSuggestionsFromErrorResponse = error => {
    console.error(error)
    if (_get(error, 'data.suggestionResponse')) {
      return fetchSuggestions(
        error.data.originalQuery,
        ...this.props.authentication
      )
    }
    return Promise.reject(error)
  }

  processQuery = ({ query, skipSafetyNet, source }) => {
    if (this.isQueryValid(query)) {
      const finalSource = ['dashboards']
      if (source) {
        finalSource.push(source)
      } else {
        finalSource.push('user')
      }

      if (
        skipSafetyNet ||
        _get(this.props.queryResponse, 'data.full_suggestion')
      ) {
        return runQueryOnly({
          query,
          ...this.props.authentication,
          ...this.props.autoQLConfig,
          source: finalSource
        })
          .then(response => {
            return Promise.resolve(response)
          })
          .catch(this.fetchSuggestionsFromErrorResponse)
      } else {
        return runQuery({
          query,
          ...this.props.authentication,
          ...this.props.autoQLConfig,
          enableQueryValidation: !this.props.isEditing
            ? false
            : this.props.autoQLConfig.enableQueryValidation,
          source: finalSource
        })
          .then(response => {
            return Promise.resolve(response)
          })
          .catch(this.fetchSuggestionsFromErrorResponse)
      }
    }
  }

  processTile = ({ query, secondQuery, skipSafetyNet, source } = {}) => {
    this.startQuery()

    const q1 = query || this.props.tile.selectedSuggestion || this.state.query
    const q2 =
      secondQuery ||
      this.props.tile.secondSelectedSuggestion ||
      this.state.secondQuery

    const firstQueryPromise = this.processQuery({
      query: q1,
      skipSafetyNet,
      source
    })
    const queryPromises = [firstQueryPromise]

    if (_get(this.props.tile, 'splitView') && q1 !== q2) {
      const secondQueryPromise = this.processQuery({
        query: q2,
        skipSafetyNet,
        source
      })
      queryPromises.push(secondQueryPromise)
    }

    Promise.all(queryPromises)
      .then(responses => {
        this.endQuery(responses)
      })
      .catch(error => {
        this.endQuery(error)
      })
  }

  onQueryTextKeyDown = e => {
    if (e.key === 'Enter') {
      this.processTile({ query: e.target.value })
      e.target.blur()
    }
  }

  onSecondQueryTextKeyDown = e => {
    if (e.key === 'Enter') {
      this.processTile({ secondQuery: e.target.value })
      e.target.blur()
    }
  }

  onSuggestionClick = (suggestion, isButtonClick, skipSafetyNet, source) => {
    this.setState({ query: suggestion })

    if (isButtonClick) {
      this.props.setParamsForTile({ query: suggestion }, this.props.tile.i)
      this.processTile({ query: suggestion, skipSafetyNet: true, source })
    } else {
      this.props.setParamsForTile(
        { selectedSuggestion: suggestion },
        this.props.tile.i
      )
    }
  }

  onSecondSuggestionClick = (suggestion, isButtonClick) => {
    this.setState({ secondQuery: suggestion })

    if (isButtonClick) {
      this.props.setParamsForTile(
        { secondQuery: suggestion },
        this.props.tile.i
      )
      this.processTile({ secondQuery: suggestion, skipSafetyNet: true })
    } else {
      this.props.setParamsForTile(
        { secondSelectedSuggestion: suggestion },
        this.props.tile.i
      )
    }
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
    this.autoCompleteTimer = setTimeout(() => {
      fetchAutocomplete({
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
      this.processTile({ query: this.userSelectedValue })
    }
  }

  onDisplayTypeChange = displayType => {
    this.props.setParamsForTile({ displayType }, this.props.tile.i)
  }

  onSecondDisplayTypeChange = secondDisplayType => {
    this.props.setParamsForTile({ secondDisplayType }, this.props.tile.i)
  }

  getIsSplitView = () => {
    return (
      _get(this.props.tile, 'splitView') &&
      _get(this.props.queryResponse, 'data.data.display_type') === 'data'
    )
  }

  toggleSecondQueryInput = () => {
    this.setState({
      isSecondQueryInputOpen: !this.state.isSecondQueryInputOpen
    })
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
              placeholder="Add descriptive title (optional)"
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
            To get started, type a query in the search bar and click{' '}
            <Icon
              type="play"
              style={{
                display: 'inline-block',
                marginRight: '3px',
                marginBottom: '-2px'
              }}
            />
          </em>
        </div>
      )
    } else if (this.props.tile.isNewTile) {
      content = (
        <div className="dashboard-tile-placeholder-text">
          <em>You haven’t filled this tile yet.</em>
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

  onQueryValidationSelectOption = (queryText, suggestionList) => {
    this.setState({ query: queryText })
    this.props.setParamsForTile(
      {
        query: queryText,
        queryValidationSelections: suggestionList
      },
      this.props.tile.i
    )
  }

  onSecondSafetyNetSelectOption = (queryText, suggestionList) => {
    this.setState({ secondQuery: queryText })
    this.props.setParamsForTile(
      {
        secondQuery: queryText,
        secondqueryValidationSelections: suggestionList
      },
      this.props.tile.i
    )
  }

  getIsSuggestionResponse = response => {
    return !!_get(response, 'data.data.items')
  }

  renderSuggestionPrefix = () => {
    return <div>I want to make sure I understood your query. Did you mean:</div>
  }

  renderSingleResponse = ({
    displayType,
    onDisplayTypeChange,
    response,
    queryValidationSelections,
    selectedSuggestion,
    onSuggestionClick,
    onQueryValidationSelectOption
  }) => {
    const queryResponse = response || this.props.queryResponse
    return (
      <Fragment>
        {this.getIsSuggestionResponse(queryResponse) &&
          this.renderSuggestionPrefix()}
        <QueryOutput
          ref={ref => (this.responseRef = ref)}
          themeConfig={this.props.themeConfig}
          autoQLConfig={this.props.autoQLConfig}
          displayType={displayType || this.props.displayType}
          queryResponse={queryResponse}
          renderTooltips={false}
          autoSelectQueryValidationSuggestion={false}
          queryValidationSelections={
            queryValidationSelections ||
            this.props.tile.queryValidationSelections
          }
          renderSuggestionsAsDropdown={this.props.tile.h < 4}
          onSuggestionClick={onSuggestionClick || this.onSuggestionClick}
          selectedSuggestion={
            selectedSuggestion || this.props.tile.selectedSuggestion
          }
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
          onQueryValidationSelectOption={
            onQueryValidationSelectOption || this.onQueryValidationSelectOption
          }
        />
        {this.props.isEditing && (
          <VizToolbar
            displayType={displayType}
            onDisplayTypeChange={onDisplayTypeChange}
            supportedDisplayTypes={
              getSupportedDisplayTypes(queryResponse) || []
            }
          />
        )}
      </Fragment>
    )
  }

  renderSplitResponse = () => {
    const firstDisplayType =
      this.props.displayType || getDefaultDisplayType(this.props.queryResponse)

    const secondDisplayType =
      this.props.secondDisplayType ||
      getDefaultDisplayType(this.props.queryResponse)

    const innerTileDiv = document.querySelector(
      `#chata-dashboard-tile-inner-div-${this.TILE_ID}`
    )

    const secondQueryInputWidth = _get(innerTileDiv, 'clientWidth')
      ? `${innerTileDiv.clientWidth - 70}px`
      : '0px'

    return (
      <SplitterLayout
        vertical={true}
        onDragStart={e => {}}
        percentage={true}
        secondaryInitialSize={this.props.secondDisplayPercentage || 50}
        onDragEnd={() => {
          setTimeout(() => {
            const secondaryContainer = document.querySelector(
              `#chata-dashboard-tile-inner-div-${this.TILE_ID} .layout-pane:not(.layout-pane-primary)`
            )

            const percentString = _get(secondaryContainer, 'style.height', '')
            const percentNumber = Number(
              percentString.substring(0, percentString.length - 1)
            )

            if (!Number.isNaN(percentNumber)) {
              this.props.setParamsForTile(
                {
                  secondDisplayPercentage: percentNumber
                },
                this.props.tile.i
              )
            }
          }, 1000)
        }}
      >
        <div className="dashboard-tile-split-pane-container">
          {this.renderSingleResponse({
            displayType: firstDisplayType,
            onDisplayTypeChange: this.onDisplayTypeChange
          })}
        </div>
        <div className="dashboard-tile-split-pane-container">
          {this.renderSingleResponse({
            displayType: secondDisplayType || 'table',
            onDisplayTypeChange: this.onSecondDisplayTypeChange,
            response: this.props.tile.secondQueryResponse,
            queryValidationSelections: this.props.tile
              .secondqueryValidationSelections,
            selectedSuggestion: this.props.tile.secondSelectedSuggestion,
            onSuggestionClick: this.onSecondSuggestionClick,
            onQueryValidationSelectOption: this.onSecondSafetyNetSelectOption
          })}
          {this.props.isEditing && (
            <div
              className="viz-toolbar split-view-btn"
              data-test="split-view-btn"
              style={{
                position: 'absolute',
                top: '7px',
                left: '7px',
                bottom: 'unset'
              }}
            >
              <button
                onClick={() => {
                  this.toggleSecondQueryInput()
                  ReactTooltip.hide()
                }}
                className="chata-toolbar-btn"
                data-tip="Query"
                data-for="chata-dashboard-toolbar-btn-tooltip"
                style={{ paddingLeft: '3px', marginRight: '10px' }}
              >
                <Icon type="chata-bubbles-outlined" />
                <Icon
                  type={
                    this.state.isSecondQueryInputOpen
                      ? 'caret-left'
                      : 'caret-right'
                  }
                  style={{
                    position: 'absolute',
                    top: '5px',
                    left: '31px',
                    fontSize: '10px'
                  }}
                />
              </button>
              <input
                className={`dashboard-tile-input query second ${
                  this.state.isSecondQueryInputOpen ? 'open' : ''
                }`}
                value={this.state.secondQuery}
                onChange={e => this.setState({ secondQuery: e.target.value })}
                onKeyDown={this.onSecondQueryTextKeyDown}
                onBlur={e => {
                  if (_get(this.props, 'tile.secondQuery') !== e.target.value) {
                    this.props.setParamsForTile(
                      {
                        secondQuery: e.target.value,
                        secondDisplayType: undefined
                      },
                      this.props.tile.i
                    )
                  }
                }}
                placeholder="Query"
                style={{
                  width: this.state.isSecondQueryInputOpen
                    ? secondQueryInputWidth
                    : '0px'
                }}
              />
            </div>
          )}
        </div>
      </SplitterLayout>
    )
  }

  renderContent = () => {
    const displayType =
      this.props.displayType || getDefaultDisplayType(this.props.queryResponse)

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
              {this.getIsSplitView()
                ? this.renderSplitResponse()
                : this.renderSingleResponse({
                    displayType,
                    onDisplayTypeChange: this.onDisplayTypeChange
                  })}
              {this.props.isEditing &&
                _get(this.props, 'queryResponse.data.data.display_type') ===
                  'data' && (
                  <div
                    className="viz-toolbar split-view-btn"
                    data-test="split-view-btn"
                  >
                    <button
                      onClick={() => {
                        this.props.setParamsForTile(
                          { splitView: !this.props.tile.splitView },
                          this.props.tile.i
                        )
                        ReactTooltip.hide()
                      }}
                      className="chata-toolbar-btn"
                      data-tip={
                        this.props.tile.splitView
                          ? 'Turn Off Split View'
                          : 'Turn On Split View'
                      }
                      data-for="chata-dashboard-toolbar-btn-tooltip"
                      data-test="viz-toolbar-button"
                    >
                      <Icon
                        type="split-view"
                        style={{
                          color: this.props.tile.splitView
                            ? this.props.themeConfig.accentColor
                            : 'inherit'
                        }}
                      />
                    </button>
                  </div>
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
            className={`chata-dashboard-tile-inner-div ${
              this.getIsSplitView() ? 'split' : ''
            }`}
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
