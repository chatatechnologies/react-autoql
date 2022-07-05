import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import _omit from 'lodash.omit'
import _functions from 'lodash.functions'
import Autosuggest from 'react-autosuggest'
import ReactTooltip from 'react-tooltip'
import SplitterLayout from 'react-splitter-layout'

import { QueryOutput } from '../../QueryOutput'
import { VizToolbar } from '../../VizToolbar'
import { OptionsToolbar } from '../../OptionsToolbar'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import LoadingDots from '../../LoadingDots/LoadingDots.js'
import { Icon } from '../../Icon'

import { runQuery, fetchAutocomplete } from '../../../js/queryService'

import { getSupportedDisplayTypes } from '../../../js/Util'

import {
  authenticationType,
  autoQLConfigType,
  dataFormattingType,
  themeConfigType,
} from '../../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  themeConfigDefault,
  getAuthentication,
  getDataFormatting,
  getAutoQLConfig,
  getThemeConfig,
} from '../../../props/defaults'

import './DashboardTile.scss'

let autoCompleteArray = []

class DashboardTile extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.QUERY_RESPONSE_KEY = uuid()
    this.autoCompleteTimer = undefined
    this.debounceTime = 50
    this.paramsToSet = {}
    this.callbackArray = []

    const supportedDisplayTypes =
      getSupportedDisplayTypes({ response: props.queryResponse }) || []
    const secondSupportedDisplayTypes =
      getSupportedDisplayTypes({ response: props.secondQueryResponse }) || []

    this.state = {
      query: props.tile.query,
      secondQuery: props.tile.secondQuery || this.props.tile.query,
      title: props.tile.title,
      isTopExecuting: false,
      isBottomExecuting: false,
      suggestions: [],
      isSecondQueryInputOpen: false,
      currentSource: 'user',
      supportedDisplayTypes,
      secondSupportedDisplayTypes,
    }
  }

  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    themeConfig: themeConfigType,

    isEditing: PropTypes.bool.isRequired,
    tile: PropTypes.shape({}).isRequired,
    deleteTile: PropTypes.func.isRequired,
    queryResponse: PropTypes.shape({}),
    notExecutedText: PropTypes.string,
    onErrorCallback: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    onCSVDownloadStart: PropTypes.func,
    onCSVDownloadProgress: PropTypes.func,
    onCSVDownloadFinish: PropTypes.func,
    enableAjaxTableData: PropTypes.bool.isRequired,
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
    queryValidationSelections: undefined,
    selectedSuggestion: undefined,
    notExecutedText: 'Hit "Execute" to run this dashboard',
    autoChartAggregations: true,
    onErrorCallback: () => {},
    onSuccessCallback: () => {},
    onCSVDownloadStart: () => {},
    onCSVDownloadProgress: () => {},
    onCSVDownloadFinish: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    const thisPropsFiltered = this.getFilteredProps(this.props)
    const nextPropsFiltered = this.getFilteredProps(nextProps)

    if (
      !_isEqual(
        _omit(thisPropsFiltered, _functions(thisPropsFiltered)),
        _omit(nextPropsFiltered, _functions(nextPropsFiltered))
      )
    ) {
      return true
    } else if (!_isEqual(this.state, nextState)) {
      return true
    }
    return false
  }

  componentDidUpdate = (prevProps, prevState) => {
    // If query or title change from props (due to undo for example), update state
    if (_get(this.props, 'tile.query') !== _get(prevProps, 'tile.query')) {
      this.setState({ query: _get(this.props, 'tile.query') }, () => {
        this.setState({
          supportedDisplayTypes: getSupportedDisplayTypes({
            response: _get(this.props, 'queryResponse'),
          }),
        })
      })
    }

    if (_get(this.props, 'tile.title') !== _get(prevProps, 'tile.title')) {
      this.setState({ title: _get(this.props, 'tile.title') })
    }

    if (this.secondOptionsToolbarRef?._isMounted) {
      this.secondOptionsToolbarRef.forceUpdate()
    }

    if (this.optionsToolbarRef?._isMounted) {
      this.optionsToolbarRef.forceUpdate()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false

    clearTimeout(this.autoCompleteTimer)
    clearTimeout(this.dragEndTimeout)

    // todo: Cancel all dashboard calls here
  }

  debouncedSetParamsForTile = (params, callback) => {
    this.paramsToSet = {
      ...this.paramsToSet,
      ...params,
    }

    if (typeof callback === 'function') {
      this.callbackArray = [...this.callbackArray, callback]
    }

    clearTimeout(this.setParamsForTileTimout)
    this.setParamsForTileTimout = setTimeout(() => {
      this.props.setParamsForTile(
        this.paramsToSet,
        this.props.tile.i,
        _cloneDeep(this.callbackArray)
      )
      this.paramsToSet = {}
      this.callbackArray = []
    }, this.debounceTime)
  }

  getFilteredProps = (props) => {
    return {
      ...props,
      children: undefined,
    }
  }

  toggleTableFilter = (ref, isFilteringTable) => {
    ref?.toggleTableFilter({ isFilteringTable })
  }

  isQueryValid = (query) => {
    return !!query && !!query.trim()
  }

  setTopExecuted = () => {
    if (this._isMounted) {
      this.setState({
        isTopExecuting: false,
        isTopExecuted: true,
      })
    }
  }

  endTopQuery = ({ response }) => {
    // Update component key after getting new response
    // so QueryOutput completely resets
    this.QUERY_RESPONSE_KEY = uuid()
    this.debouncedSetParamsForTile(
      {
        queryResponse: response,
        selectedSuggestion: undefined,
      },
      this.setTopExecuted
    )
  }

  setBottomExecuted = () => {
    if (this._isMounted) {
      this.setState({
        isBottomExecuting: false,
        isBottomExecuted: true,
      })
    }
  }

  endBottomQuery = ({ response }) => {
    this.debouncedSetParamsForTile(
      {
        secondQueryResponse: response,
        secondSelectedSuggestion: undefined,
      },
      this.setBottomExecuted
    )
  }

  processQuery = ({ query, userSelection, skipQueryValidation, source }) => {
    if (this.isQueryValid(query)) {
      const finalSource = ['dashboards']
      if (source) {
        finalSource.push(source)
      } else {
        finalSource.push('user')
      }

      return runQuery({
        query,
        userSelection,
        ...getAuthentication(this.props.authentication),
        ...getAutoQLConfig(this.props.autoQLConfig),
        enableQueryValidation: !this.props.isEditing
          ? false
          : getAutoQLConfig(this.props.autoQLConfig).enableQueryValidation,
        source: finalSource,
        skipQueryValidation: skipQueryValidation,
      })
        .then((response) => {
          return Promise.resolve(response)
        })
        .catch((error) => Promise.reject(error))
    }
    return Promise.reject()
  }

  processTileTop = ({ query, userSelection, skipQueryValidation, source }) => {
    this.setState({ isTopExecuting: true, customMessage: undefined })

    const skipValidation =
      !!skipQueryValidation ||
      !!(this.props.tile.query === query && this.props.tile.skipQueryValidation)

    const queryValidationSelections =
      userSelection ||
      (this.props.tile.query === query
        ? _get(this.props.tile, 'queryValidationSelections')
        : undefined)

    // New query is running, reset temporary state fields
    this.debouncedSetParamsForTile({
      query,
      dataConfig:
        this.props.tile.query === query
          ? undefined
          : this.props.tile.dataConfig,
      skipQueryValidation: skipValidation,
      queryResponse: null,
      selectedSuggestion: undefined,
      queryValidationSelections,
    })

    this.processQuery({
      query,
      userSelection: queryValidationSelections,
      skipQueryValidation: skipQueryValidation,
      source,
    })
      .then((response) => {
        if (this._isMounted) this.endTopQuery({ response })
      })
      .catch((response) => {
        if (this._isMounted) this.endTopQuery({ response })
      })
  }

  processTileBottom = ({
    query,
    userSelection,
    skipQueryValidation,
    source,
  }) => {
    this.setState({
      isBottomExecuting: true,
      isSecondQueryInputOpen: false,
      secondCustomMessage: undefined,
    })

    const skipValidation =
      skipQueryValidation ||
      !!(
        this.props.tile.secondQuery === query &&
        this.props.tile.secondskipQueryValidation
      )

    const queryValidationSelections =
      userSelection ||
      (this.props.tile.secondQuery === query
        ? _get(this.props.tile, 'secondQueryValidationSelections')
        : undefined)

    // New query is running, reset temporary state fields
    this.debouncedSetParamsForTile({
      secondQuery: query,
      secondDataConfig:
        this.props.tile.secondQuery === query
          ? undefined
          : this.props.tile.secondDataConfig,
      secondskipQueryValidation: skipValidation,
      secondQueryResponse: null,
      secondSelectedSuggestion: undefined,
      secondQueryValidationSelections: queryValidationSelections,
    })

    this.processQuery({
      query,
      userSelection: queryValidationSelections,
      skipQueryValidation: skipQueryValidation,
      source,
    })
      .then((response) => {
        if (this._isMounted) this.endBottomQuery({ response })
      })
      .catch((response) => {
        if (this._isMounted) this.endBottomQuery({ response })
      })
  }

  clearQueryResponses = () => {
    this.setState({
      isTopExecuting: false,
      isTopExecuted: false,
      customMessage: undefined,
    })
    this.debouncedSetParamsForTile({
      queryResponse: undefined,
      secondQueryResponse: undefined,
    })
  }

  processTile = ({
    query,
    secondQuery,
    skipQueryValidation,
    secondskipQueryValidation,
    source,
  } = {}) => {
    const q1 = query || this.props.tile.selectedSuggestion || this.state.query
    const q2 =
      secondQuery ||
      this.props.tile.secondSelectedSuggestion ||
      this.state.secondQuery

    this.processTileTop({ query: q1, skipQueryValidation, source })

    if (this.getIsSplitView() && q2 && q1 !== q2) {
      this.processTileBottom({
        query: q2,
        skipQueryValidation: secondskipQueryValidation,
        source,
      })
    }
  }

  onQueryTextKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.value) {
      this.processTile({ query: e.target.value })
      e.target.blur()
    }
  }

  onSecondQueryTextKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.processTileBottom({ query: e.target.value })
      e.target.blur()
    }
  }

  onSuggestionClick = ({ query, userSelection, isButtonClick, source }) => {
    this.setState({ query })

    if (isButtonClick) {
      this.processTileTop({
        query,
        userSelection,
        skipQueryValidation: true,
        source,
      })
    } else {
      this.debouncedSetParamsForTile({ selectedSuggestion: query })
    }
  }

  onSecondSuggestionClick = ({
    query,
    userSelection,
    isButtonClick,
    source,
  }) => {
    this.setState({ secondQuery: query })

    if (isButtonClick) {
      this.debouncedSetParamsForTile({
        secondQuery: query,
        secondQueryValidationSelections: userSelection,
      })
      this.processTileBottom({
        query,
        userSelection,
        skipQueryValidation: true,
        source,
      })
    } else {
      this.debouncedSetParamsForTile({ secondQuery: query })
    }
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
    this.autoCompleteTimer = setTimeout(() => {
      fetchAutocomplete({
        suggestion: value,
        ...getAuthentication(this.props.authentication),
      })
        .then((response) => {
          if (this._isMounted) {
            const body = _get(response, 'data.data')

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
                name: sortingArray[idx],
              }
              autoCompleteArray.push(anObject)
            }

            this.setState({
              suggestions: autoCompleteArray,
            })
          }
        })
        .catch((error) => {
          console.error(error)
        })
    }, 300)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }

  userSelectedSuggestionHandler = (userSelectedValueFromSuggestionBox) => {
    if (
      userSelectedValueFromSuggestionBox &&
      userSelectedValueFromSuggestionBox.name
    ) {
      const newQuery = userSelectedValueFromSuggestionBox.name
      this.userSelectedValue = newQuery
      this.userSelectedSuggestion = true
      this.setState({ query: newQuery })
      this.debouncedSetParamsForTile({ query: newQuery })
    }
  }

  onQueryInputChange = (e) => {
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

  onDisplayTypeChange = (displayType) => {
    this.debouncedSetParamsForTile({ displayType })
  }

  onSecondDisplayTypeChange = (secondDisplayType) => {
    this.debouncedSetParamsForTile({ secondDisplayType })
  }

  getIsSplitView = () => {
    return _get(this.props.tile, 'splitView')
  }

  toggleSecondQueryInput = () => {
    this.setState({
      isSecondQueryInputOpen: !this.state.isSecondQueryInputOpen,
    })
  }

  renderHeader = () => {
    if (this.props.isEditing) {
      return (
        <div className="dashboard-tile-edit-wrapper">
          <div
            className={`dashboard-tile-input-container
            ${this.state.isQueryInputFocused ? 'query-focused' : ''}
            ${this.state.isTitleInputFocused ? 'title-focused' : ''}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="dashboard-tile-left-input-container">
              <Icon
                className="query-input-icon"
                type="react-autoql-bubbles-outlined"
              />
              {getAutoQLConfig(this.props.autoQLConfig).enableAutocomplete ? (
                <Autosuggest
                  onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                  onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                  getSuggestionValue={this.userSelectedSuggestionHandler}
                  suggestions={this.state.suggestions}
                  ref={(ref) => {
                    this.autoSuggest = ref
                  }}
                  renderSuggestion={(suggestion) => {
                    return <Fragment>{suggestion.name}</Fragment>
                  }}
                  inputProps={{
                    className: `dashboard-tile-autocomplete-input`,
                    placeholder: 'Type a query in your own words',
                    value: this.state.query,
                    'data-tip': 'Query',
                    'data-for': 'react-autoql-dashboard-toolbar-btn-tooltip',
                    'data-place': 'bottom',
                    onFocus: () => this.setState({ isQueryInputFocused: true }),
                    onChange: this.onQueryInputChange,
                    onKeyDown: this.onQueryTextKeyDown,
                    onBlur: (e) => {
                      if (_get(this.props, 'tile.query') !== e.target.value) {
                        this.debouncedSetParamsForTile({
                          query: e.target.value,
                          dataConfig: undefined,
                          queryValidationSelections: undefined,
                        })
                      }
                      this.setState({ isQueryInputFocused: false })
                    },
                  }}
                />
              ) : (
                <input
                  className="dashboard-tile-input query"
                  placeholder="Type a query in your own words"
                  value={this.state.query}
                  data-tip="Query"
                  data-for="react-autoql-dashboard-toolbar-btn-tooltip"
                  data-place="bottom"
                  onChange={(e) => {
                    this.setState({ query: e.target.value })
                  }}
                  onKeyDown={this.onQueryTextKeyDown}
                  onFocus={() => this.setState({ isQueryInputFocused: true })}
                  onBlur={(e) => {
                    if (_get(this.props, 'tile.query') !== e.target.value) {
                      this.debouncedSetParamsForTile({
                        query: e.target.value,
                        dataConfig: undefined,
                        queryValidationSelections: undefined,
                      })
                    }
                    this.setState({ isQueryInputFocused: false })
                  }}
                />
              )}
            </div>

            <div className="dashboard-tile-right-input-container">
              <Icon className="title-input-icon" type="title" />
              <input
                className="dashboard-tile-input title"
                placeholder="Add descriptive title (optional)"
                value={this.state.title}
                data-tip="Title"
                data-for="react-autoql-dashboard-toolbar-btn-tooltip"
                data-place="bottom"
                onChange={(e) => this.setState({ title: e.target.value })}
                onFocus={() => this.setState({ isTitleInputFocused: true })}
                onBlur={(e) => {
                  this.debouncedSetParamsForTile({ title: e.target.value })
                  this.setState({ isTitleInputFocused: false })
                }}
              />
            </div>
          </div>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className={`dashboard-tile-play-button${
              !this.isQueryValid(this.state.query) ? ' disabled' : ''
            }`}
          >
            <Icon
              type="play"
              onClick={() => this.processTile()}
              data-tip="Run tile"
              data-place="left"
            />
          </div>
          <div
            className="dashboard-tile-delete-button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => this.props.deleteTile(this.props.tile.i)}
          >
            <Icon style={{ fontSize: '18px' }} type="close" />
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
      <div className="react-autoql-db-dragging-placeholder-container">
        <div className="react-autoql-db-dragging-placeholder-title"></div>
        <div className="react-autoql-db-dragging-placeholder-content"></div>
      </div>
    )
  }

  renderContentPlaceholder = ({ isExecuting, isExecuted } = {}) => {
    let content = null
    if (isExecuting) {
      // This should always take priority over the other conditions below
      content = <LoadingDots />
    } else if (!this.props.isEditing && isExecuted) {
      content = (
        <div className="dashboard-tile-placeholder-text">
          <em>No query was supplied for this tile.</em>
        </div>
      )
    } else if (this.props.isEditing && !_get(this.state.query, 'trim()')) {
      content = (
        <div className="dashboard-tile-placeholder-text">
          <em>
            To get started, enter a query and click{' '}
            <Icon className="play-icon" type="play" />
          </em>
        </div>
      )
    } else {
      content = (
        <div className="dashboard-tile-placeholder-text">
          <em>
            {this.props.isEditing ? (
              <span>
                Hit <Icon className="edit-mode-placeholder-icon" type="play" />{' '}
                to run this tile
              </span>
            ) : (
              <span>{this.props.notExecutedText}</span>
            )}
          </em>
        </div>
      )
    }

    return <div className="loading-container-centered">{content}</div>
  }

  onQueryValidationSelectOption = (queryText, suggestionList) => {
    this.setState({ query: queryText })
    this.debouncedSetParamsForTile({
      query: queryText,
      queryValidationSelections: suggestionList,
    })
  }

  onSecondQueryValidationSelectOption = (queryText, suggestionList) => {
    this.setState({ secondQuery: queryText })
    this.debouncedSetParamsForTile({
      secondQuery: queryText,
      secondqueryValidationSelections: suggestionList,
    })
  }

  getIsSuggestionResponse = (response) => {
    return !!_get(response, 'data.data.items')
  }

  onDataConfigChange = (config) => {
    this.debouncedSetParamsForTile({ dataConfig: config })
  }

  onSecondDataConfigChange = (config) => {
    this.debouncedSetParamsForTile({ secondDataConfig: config })
  }

  reportProblemCallback = () => {
    if (this.optionsToolbarRef?._isMounted) {
      this.optionsToolbarRef.setState({ activeMenu: 'other-problem' })
    }
  }

  secondReportProblemCallback = () => {
    if (this.secondOptionsToolbarRef?._isMounted) {
      this.secondOptionsToolbarRef.setState({ activeMenu: 'other-problem' })
    }
  }

  onNoneOfTheseClick = () => {
    this.setState({
      customMessage: (
        <div className="feedback-message">
          Thank you for your feedback!
          <br />
          To continue, try asking another query.
        </div>
      ),
    })
  }

  secondOnNoneOfTheseClick = () => {
    this.setState({
      secondCustomMessage: (
        <div className="feedback-message">
          Thank you for your feedback!
          <br />
          To continue, try asking another query.
        </div>
      ),
    })
  }

  renderSuggestionPrefix = () => {
    return <div>I want to make sure I understood your query. Did you mean:</div>
  }

  renderSplitResponse = () => {
    const secondQueryInputWidth = _get(this.tileInnerDiv, 'clientWidth')
      ? `${this.tileInnerDiv.clientWidth - 70}px`
      : '0px'

    return (
      <SplitterLayout
        vertical={true}
        percentage={true}
        secondaryInitialSize={this.props.secondDisplayPercentage || 50}
        onDragEnd={() => {
          this.dragEndTimeout = setTimeout(() => {
            const percentString = _get(this.tileInnerDiv, 'style.height', '')
            const percentNumber = Number(
              percentString.substring(0, percentString.length - 1)
            )

            if (!Number.isNaN(percentNumber)) {
              this.debouncedSetParamsForTile({
                secondDisplayPercentage: percentNumber,
              })
            }
          }, 1000)
        }}
      >
        <div className="dashboard-tile-split-pane-container">
          {this.renderTopResponse()}
        </div>
        <div className="dashboard-tile-split-pane-container">
          {this.renderBottomResponse()}
          {this.props.isEditing && (
            <div
              className="viz-toolbar split-view-btn split-view-query-btn"
              data-test="split-view-query-btn"
            >
              <button
                onClick={() => {
                  this.toggleSecondQueryInput()
                  ReactTooltip.hide()
                }}
                className="react-autoql-toolbar-btn"
                data-tip="Query"
                data-for="react-autoql-dashboard-toolbar-btn-tooltip"
                style={{ paddingLeft: '3px', marginRight: '10px' }}
              >
                <Icon type="react-autoql-bubbles-outlined" />
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
                    fontSize: '10px',
                  }}
                />
              </button>
              <input
                className={`dashboard-tile-input query second ${
                  this.state.isSecondQueryInputOpen ? 'open' : ''
                }`}
                value={this.state.secondQuery}
                onChange={(e) => {
                  this.setState({ secondQuery: e.target.value })
                }}
                onKeyDown={this.onSecondQueryTextKeyDown}
                onBlur={(e) => {
                  if (_get(this.props, 'tile.secondQuery') !== e.target.value) {
                    this.debouncedSetParamsForTile({
                      secondQuery: e.target.value,
                      secondDataConfig: undefined,
                      secondQueryValidationSelections: undefined,
                    })
                  }
                }}
                placeholder={
                  this.props.tile.query || 'Type a query in your own words'
                }
                style={{
                  width: this.state.isSecondQueryInputOpen
                    ? secondQueryInputWidth
                    : '0px',
                }}
              />
            </div>
          )}
        </div>
      </SplitterLayout>
    )
  }

  onSplitViewClick = () => {
    const splitView = !this.props.tile?.splitView
    let secondQuery = this.props.tile?.secondQuery

    if (splitView && !secondQuery) {
      secondQuery = this.props.tile?.query
    }

    this.debouncedSetParamsForTile({
      splitView,
      secondQuery,
    })

    ReactTooltip.hide()
  }

  renderSplitViewBtn = () => {
    return (
      <div className="viz-toolbar split-view-btn" data-test="split-view-btn">
        <button
          onClick={this.onSplitViewClick}
          className="react-autoql-toolbar-btn"
          data-tip={this.props.tile.splitView ? 'Single View' : 'Split View'}
          data-for="react-autoql-dashboard-toolbar-btn-tooltip"
          data-test="viz-toolbar-button"
        >
          <Icon
            type={this.getIsSplitView() ? 'single-view' : 'split-view'}
            style={{
              color: this.props.tile.splitView
                ? getThemeConfig(this.props.themeConfig).accentColor
                : 'inherit',
            }}
          />
        </button>
      </div>
    )
  }

  onSupportedDisplayTypesChange = (supportedDisplayTypes) => {
    this.setState({ supportedDisplayTypes })
    this.debouncedSetParamsForTile({ dataConfig: undefined })
  }

  onSecondSupportedDisplayTypesChange = (secondSupportedDisplayTypes) => {
    this.setState({ secondSupportedDisplayTypes })
    this.debouncedSetParamsForTile({ secondDataConfig: undefined })
  }

  onCSVDownloadStart = (params) =>
    this.props.onCSVDownloadStart({
      ...params,
      tileId: this.props.tile.i,
    })

  onCSVDownloadProgress = (params) =>
    this.props.onCSVDownloadProgress({
      ...params,
      tileId: this.props.tile.i,
    })

  onCSVDownloadFinish = (params) =>
    this.props.onCSVDownloadFinish({
      ...params,
      tileId: this.props.tile.i,
    })

  renderSuggestionMessage = (customMessage) => {
    if (customMessage) {
      return customMessage
    }

    return (
      <div style={{ paddingTop: '20px' }}>{this.renderSuggestionPrefix()}</div>
    )
  }

  renderToolbars = ({
    queryOutputProps,
    vizToolbarProps,
    optionsToolbarProps,
    isSecondHalf,
  }) => {
    const dataLimitWarningIcon = document.querySelector(
      `#${queryOutputProps.key} .dashboard-data-limit-warning-icon`
    )

    return (
      <div
        className={`dashboard-tile-toolbars-container ${
          !!dataLimitWarningIcon ? 'left-padding' : ''
        }`}
      >
        <div className="dashboard-tile-toolbars-left-container">
          {this.props.isEditing &&
            (isSecondHalf || !this.getIsSplitView()) &&
            this.renderSplitViewBtn()}
          {!this.props.isDragging && this.props.isEditing && (
            <VizToolbar
              themeConfig={this.props.themeConfig}
              {...vizToolbarProps}
            />
          )}
        </div>
        <div className="dashboard-tile-toolbars-right-container">
          {!this.props.isDragging && (
            <OptionsToolbar
              authentication={getAuthentication(this.props.authentication)}
              autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
              themeConfig={getThemeConfig(this.props.themeConfig)}
              onErrorCallback={this.props.onErrorCallback}
              onSuccessAlert={this.props.onSuccessCallback}
              onCSVDownloadStart={this.onCSVDownloadStart}
              onCSVDownloadProgress={this.onCSVDownloadProgress}
              onCSVDownloadFinish={this.onCSVDownloadFinish}
              rebuildTooltips={this.props.rebuildTooltips}
              {...optionsToolbarProps}
            />
          )}
        </div>
      </div>
    )
  }

  renderResponseContent = ({
    queryOutputProps,
    isSecondHalf,
    isExecuting,
    isExecuted,
    renderPlaceholder,
  }) => {
    if (renderPlaceholder) {
      return this.renderContentPlaceholder({
        isExecuting,
        isExecuted,
      })
    }

    let customMessage = this.state.customMessage
    if (isSecondHalf) {
      customMessage = this.state.secondCustomMessage
    }

    return (
      <>
        {this.getIsSuggestionResponse(queryOutputProps.queryResponse) &&
          this.renderSuggestionMessage(customMessage)}
        {!customMessage && (
          <QueryOutput
            authentication={getAuthentication(this.props.authentication)}
            themeConfig={this.props.themeConfig}
            autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
            dataFormatting={getDataFormatting(this.props.dataFormatting)}
            renderTooltips={false}
            autoSelectQueryValidationSuggestion={false}
            autoChartAggregations={this.props.autoChartAggregations}
            isResizing={this.props.isDragging}
            renderSuggestionsAsDropdown={this.props.tile.h < 4}
            enableDynamicCharting={this.props.enableDynamicCharting}
            backgroundColor={document.documentElement.style.getPropertyValue(
              '--react-autoql-background-color-primary'
            )}
            enableAjaxTableData={this.props.enableAjaxTableData}
            rebuildTooltips={this.props.rebuildTooltips}
            {...queryOutputProps}
          />
        )}
      </>
    )
  }

  renderResponse = ({
    queryOutputProps = {},
    vizToolbarProps = {},
    optionsToolbarProps = {},
    isSecondHalf,
    isExecuting,
    isExecuted,
    renderPlaceholder,
  }) => {
    return (
      <div className="loading-container-centered" id={queryOutputProps.key}>
        {this.renderResponseContent({
          queryOutputProps,
          isSecondHalf,
          isExecuting,
          isExecuted,
          renderPlaceholder,
        })}
        {this.renderToolbars({
          queryOutputProps,
          vizToolbarProps,
          optionsToolbarProps,
          isSecondHalf,
        })}
      </div>
    )
  }

  renderTopResponse = () => {
    const isExecuting = this.state.isTopExecuting
    const isExecuted = this.state.isTopExecuted

    const renderPlaceholder =
      !this.props.queryResponse || isExecuting || !isExecuted

    const displayType = _get(this.props, 'tile.displayType')

    return this.renderResponse({
      renderPlaceholder,
      isExecuting,
      isExecuted,
      queryOutputProps: {
        ref: (ref) => this.setState({ responseRef: ref }),
        optionsToolbarRef: this.optionsToolbarRef,
        key: `dashboard-tile-query-top-${this.QUERY_RESPONSE_KEY}`,
        displayType,
        queryResponse: this.props.queryResponse,
        tableConfigs: this.props.tile.dataConfig,
        onTableConfigChange: this.onDataConfigChange,
        queryValidationSelections: this.props.tile.queryValidationSelections,
        onSuggestionClick: this.onSuggestionClick,
        selectedSuggestion: _get(this.props.tile, 'selectedSuggestion'),
        onNoneOfTheseClick: this.onNoneOfTheseClick,
        onDrilldownStart: (activeKey) =>
          this.props.onDrilldownStart({
            tileId: this.props.tile.i,
            isSecondHalf: false,
            activeKey,
          }),
        onDrilldownEnd: this.props.onDrilldownEnd,
        onQueryValidationSelectOption: this.onQueryValidationSelectOption,
        onSupportedDisplayTypesChange: this.onSupportedDisplayTypesChange,
        onRecommendedDisplayType: (displayType) => {
          this.onDisplayTypeChange(displayType)
        },
        reportProblemCallback: this.reportProblemCallback,
      },
      vizToolbarProps: {
        ref: (r) => (this.vizToolbarRef = r),
        key: `viz-toolbar-${this.QUERY_RESPONSE_KEY}`,
        displayType: displayType,
        onDisplayTypeChange: this.onDisplayTypeChange,
        supportedDisplayTypes: this.state.supportedDisplayTypes,
      },
      optionsToolbarProps: {
        ref: (r) => (this.optionsToolbarRef = r),
        key: `options-toolbar-${this.QUERY_RESPONSE_KEY}`,
        responseRef: this.state.responseRef,
        queryResponse: this.props.queryResponse,
        onFilterClick: ({ isFilteringTable }) =>
          this.toggleTableFilter(this.state.responseRef, isFilteringTable),
        displayType,
      },
    })
  }

  renderBottomResponse = () => {
    const topQuery = this.props?.tile?.query
    const bottomQuery = this.props?.tile?.secondQuery
    const isQuerySameAsTop = !bottomQuery || topQuery === bottomQuery

    let isExecuting = this.state.isBottomExecuting
    let isExecuted = this.state.isBottomExecuted

    if (isQuerySameAsTop) {
      isExecuting = this.state.isTopExecuting
      isExecuted = this.state.isTopExecuted
    }

    const renderPlaceholder =
      (!isQuerySameAsTop && !this.props.secondQueryResponse) ||
      (isQuerySameAsTop && !this.props.queryResponse) ||
      isExecuting ||
      !isExecuted

    const displayType = _get(this.props, 'tile.secondDisplayType', 'table')

    return this.renderResponse({
      renderPlaceholder,
      isExecuting,
      isExecuted,
      queryOutputProps: {
        key: `dashboard-tile-query-bottom-${this.QUERY_RESPONSE_KEY}`,
        ref: (ref) => this.setState({ secondResponseRef: ref }),
        optionsToolbarRef: this.secondOptionsToolbarRef,
        displayType,
        queryResponse:
          this.props.secondQueryResponse || this.props.queryResponse,
        tableConfigs: this.props.tile.secondDataConfig,
        onTableConfigChange: this.onSecondDataConfigChange,
        queryValidationSelections: this.props.tile
          .secondqueryValidationSelections,
        onSuggestionClick: this.onSecondSuggestionClick,
        selectedSuggestion: _get(this.props.tile, 'secondSelectedSuggestion'),
        reportProblemCallback: this.secondReportProblemCallback,
        onSupportedDisplayTypesChange: this.onSecondSupportedDisplayTypesChange,
        onRecommendedDisplayType: (displayType) => {
          this.onSecondDisplayTypeChange(displayType)
        },
        onNoneOfTheseClick: this.secondOnNoneOfTheseClick,
        onDrilldownStart: (activeKey) => {
          this.props.onDrilldownStart({
            tileId: this.props.tile.i,
            isSecondHalf: true,
            activeKey,
          })
        },
        onDrilldownEnd: this.props.onDrilldownEnd,
        onQueryValidationSelectOption: this.onSecondQueryValidationSelectOption,
      },
      vizToolbarProps: {
        ref: (r) => (this.secondVizToolbarRef = r),
        key: `viz-toolbar-${this.QUERY_RESPONSE_KEY}`,
        displayType: displayType,
        onDisplayTypeChange: this.onSecondDisplayTypeChange,
        supportedDisplayTypes: this.state.secondSupportedDisplayTypes,
      },
      optionsToolbarProps: {
        ref: (r) => (this.secondOptionsToolbarRef = r),
        key: `options-toolbar-${this.QUERY_RESPONSE_KEY}`,
        queryResponse:
          this.props.secondQueryResponse || this.props.queryResponse,
        responseRef: this.state.secondResponseRef,
        onFilterClick: ({ isFilteringTable }) =>
          this.toggleTableFilter(
            this.state.secondResponseRef,
            isFilteringTable
          ),
        displayType,
      },
      isSecondHalf: true,
    })
  }

  renderContent = () => {
    return (
      <div
        className={`dashboard-tile-response-wrapper
      ${this.props.isEditing ? ' editing' : ''}
      ${this.props.tile.h < 4 ? ' small' : ''}`}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="dashboard-tile-response-container"
        >
          {this.getIsSplitView()
            ? this.renderSplitResponse()
            : this.renderTopResponse()}
        </div>
      </div>
    )
  }

  renderDragHandles = () => {
    return (
      <Fragment>
        <div className="react-autoql-dashboard-tile-drag-handle top" />
        <div className="react-autoql-dashboard-tile-drag-handle bottom" />
        <div className="react-autoql-dashboard-tile-drag-handle left" />
        <div className="react-autoql-dashboard-tile-drag-handle right" />
      </Fragment>
    )
  }

  render = () => {
    const { onMouseDown, onMouseUp, onTouchStart, onTouchEnd } = this.props
    const propsToPassToDragHandle = {
      onMouseDown,
      onMouseUp,
      onTouchStart,
      onTouchEnd,
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
            id={`react-autoql-dashboard-tile-inner-div-${this.COMPONENT_KEY}`}
            ref={(r) => (this.tileInnerDiv = r)}
            className={`react-autoql-dashboard-tile-inner-div
              ${this.getIsSplitView() ? 'split' : ''}`}
          >
            <Fragment>
              {this.renderHeader()}
              {this.renderContent()}
            </Fragment>
          </div>
          {this.props.isEditing && this.renderDragHandles()}
        </div>
      </ErrorBoundary>
    )
  }
}

// React-Grid-Layout needs the forwarded original ref
// we can forward our own ref down to DashboardTile as a prop
export default React.forwardRef(({ style, className, key, ...props }, ref) => (
  <div style={{ ...style }} className={className} ref={ref}>
    <DashboardTile
      {...props}
      ref={props.tileRef}
      className={`${props.innerDivClass} ${props.isEditing ? 'editing' : ''}`}
      data-test="react-autoql-dashboard-tile"
    />
  </div>
))
