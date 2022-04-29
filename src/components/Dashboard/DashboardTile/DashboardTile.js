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
    this.autoCompleteTimer = undefined

    const supportedDisplayTypes =
      getSupportedDisplayTypes(props.queryResponse) || []
    const secondSupportedDisplayTypes =
      getSupportedDisplayTypes(props.secondQueryResponse) || []

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

  componentDidUpdate = (prevProps) => {
    // If query or title change from props (due to undo for example), update state
    if (_get(this.props, 'tile.query') !== _get(prevProps, 'tile.query')) {
      this.setState({ query: _get(this.props, 'tile.query') }, () => {
        this.setState({
          supportedDisplayTypes: getSupportedDisplayTypes(
            _get(this.props, 'queryResponse')
          ),
        })
      })
    }

    if (_get(this.props, 'tile.title') !== _get(prevProps, 'tile.title')) {
      this.setState({ title: _get(this.props, 'tile.title') })
    }

    // Keep this for a deep compare to debug
    // if (!_isEqual(this.props, prevProps)) {
    //   console.log(
    //     'PROPS were not equal!! Re-rendering',
    //     _reduce(
    //       prevProps,
    //       (result, value, key) => {
    //         return _isEqual(value, this.props[key])
    //           ? result
    //           : result.concat(key)
    //       },
    //       []
    //     )
    //   )
    // }

    // Keep this for a deep compare to debug
    // if (!_isEqual(this.state, prevState)) {
    //   console.log(
    //     'STATE were not equal!! Re-rendering',
    //     _reduce(
    //       prevState,
    //       (result, value, key) => {
    //         return _isEqual(value, this.state[key])
    //           ? result
    //           : result.concat(key)
    //       },
    //       []
    //     )
    //   )
    // }
  }

  componentWillUnmount = () => {
    this._isMounted = true

    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }

    // todo: Cancel all dashboard calls here
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

  endTopQuery = ({ response }) => {
    // Update component key after getting new response
    // so QueryOutput completely resets
    this.COMPONENT_KEY = uuid()

    this.props.setParamsForTile(
      {
        queryResponse: response,
        selectedSuggestion: undefined,
      },
      this.props.tile.i
    )

    this.setState({
      isTopExecuting: false,
      isTopExecuted: true,
    })
  }

  endBottomQuery = ({ response }) => {
    this.props.setParamsForTile(
      {
        secondQueryResponse: response,
        secondSelectedSuggestion: undefined,
      },
      this.props.tile.i
    )

    this.setState({
      isBottomExecuting: false,
      isBottomExecuted: true,
    })
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
    this.props.setParamsForTile(
      {
        query,
        dataConfig:
          this.props.tile.query === query
            ? undefined
            : this.props.tile.dataConfig,
        skipQueryValidation: skipValidation,
        queryResponse: null,
        selectedSuggestion: undefined,
        queryValidationSelections,
      },
      this.props.tile.i
    )

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
    this.props.setParamsForTile(
      {
        secondQuery: query,
        secondDataConfig:
          this.props.tile.secondQuery === query
            ? undefined
            : this.props.tile.secondDataConfig,
        secondskipQueryValidation: skipValidation,
        secondQueryResponse: null,
        secondSelectedSuggestion: undefined,
        secondQueryValidationSelections: queryValidationSelections,
      },
      this.props.tile.i
    )

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
    this.props.setParamsForTile(
      {
        queryResponse: undefined,
        secondQueryResponse: undefined,
      },
      this.props.tile.i
    )
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
      this.props.setParamsForTile(
        { selectedSuggestion: query },
        this.props.tile.i
      )
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
      this.props.setParamsForTile(
        { secondQuery: query, secondQueryValidationSelections: userSelection },
        this.props.tile.i
      )
      this.processTileBottom({
        query,
        userSelection,
        skipQueryValidation: true,
        source,
      })
    } else {
      this.props.setParamsForTile({ secondQuery: query }, this.props.tile.i)
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
      this.props.setParamsForTile({ query: newQuery }, this.props.tile.i)
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
    this.props.setParamsForTile({ displayType }, this.props.tile.i)
  }

  onSecondDisplayTypeChange = (secondDisplayType) => {
    this.props.setParamsForTile({ secondDisplayType }, this.props.tile.i)
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
                    onFocus: () => this.setState({ isQueryInputFocused: true }),
                    onChange: this.onQueryInputChange,
                    onKeyDown: this.onQueryTextKeyDown,
                    onBlur: (e) => {
                      if (_get(this.props, 'tile.query') !== e.target.value) {
                        this.props.setParamsForTile(
                          {
                            query: e.target.value,
                            dataConfig: undefined,
                            queryValidationSelections: undefined,
                          },
                          this.props.tile.i
                        )
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
                  onChange={(e) => this.setState({ query: e.target.value })}
                  onKeyDown={this.onQueryTextKeyDown}
                  onFocus={() => this.setState({ isQueryInputFocused: true })}
                  onBlur={(e) => {
                    if (_get(this.props, 'tile.query') !== e.target.value) {
                      this.props.setParamsForTile(
                        {
                          query: e.target.value,
                          dataConfig: undefined,
                          queryValidationSelections: undefined,
                        },
                        this.props.tile.i
                      )
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
                onChange={(e) => this.setState({ title: e.target.value })}
                onFocus={() => this.setState({ isTitleInputFocused: true })}
                onBlur={(e) => {
                  this.props.setParamsForTile(
                    { title: e.target.value },
                    this.props.tile.i
                  )
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
    this.props.setParamsForTile(
      {
        query: queryText,
        queryValidationSelections: suggestionList,
      },
      this.props.tile.i
    )
  }

  onSecondQueryValidationSelectOption = (queryText, suggestionList) => {
    this.setState({ secondQuery: queryText })
    this.props.setParamsForTile(
      {
        secondQuery: queryText,
        secondqueryValidationSelections: suggestionList,
      },
      this.props.tile.i
    )
  }

  getIsSuggestionResponse = (response) => {
    return !!_get(response, 'data.data.items')
  }

  onDataConfigChange = (config) => {
    this.props.setParamsForTile({ dataConfig: config }, this.props.tile.i)
  }

  onSecondDataConfigChange = (config) => {
    this.props.setParamsForTile({ secondDataConfig: config }, this.props.tile.i)
  }

  reportProblemCallback = () => {
    if (this.optionsToolbarRef) {
      this.optionsToolbarRef.setState({ activeMenu: 'other-problem' })
    }
  }

  secondReportProblemCallback = () => {
    if (this.secondOptionsToolbarRef) {
      this.secondOptionsToolbarRef.setState({ activeMenu: 'other-problem' })
    }
  }

  onNoneOfTheseClick = () => {
    this.setState({ customMessage: 'Thank you for your feedback' })
  }

  secondOnNoneOfTheseClick = () => {
    this.setState({ secondCustomMessage: 'Thank you for your feedback' })
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
          setTimeout(() => {
            const percentString = _get(this.tileInnerDiv, 'style.height', '')
            const percentNumber = Number(
              percentString.substring(0, percentString.length - 1)
            )

            if (!Number.isNaN(percentNumber)) {
              this.props.setParamsForTile(
                {
                  secondDisplayPercentage: percentNumber,
                },
                this.props.tile.i
              )
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
                onChange={(e) => this.setState({ secondQuery: e.target.value })}
                onKeyDown={this.onSecondQueryTextKeyDown}
                onBlur={(e) => {
                  if (_get(this.props, 'tile.secondQuery') !== e.target.value) {
                    this.props.setParamsForTile(
                      {
                        secondQuery: e.target.value,
                        secondDataConfig: undefined,
                        secondQueryValidationSelections: undefined,
                      },
                      this.props.tile.i
                    )
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

  renderSplitViewBtn = () => {
    return (
      <div className="viz-toolbar split-view-btn" data-test="split-view-btn">
        <button
          onClick={() => {
            this.props.setParamsForTile(
              { splitView: !this.props.tile.splitView },
              this.props.tile.i
            )
            ReactTooltip.hide()
          }}
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
  }

  onSecondSupportedDisplayTypesChange = (secondSupportedDisplayTypes) => {
    this.setState({ secondSupportedDisplayTypes })
    this.props.setParamsForTile({
      secondDataConfig: undefined,
    })
  }

  renderSuggestionMessage = (customMessage) => {
    if (customMessage) {
      return customMessage
    }

    return (
      <div style={{ paddingTop: '20px' }}>{this.renderSuggestionPrefix()}</div>
    )
  }

  renderResponse = ({
    queryOutputProps = {},
    vizToolbarProps = {},
    optionsToolbarProps = {},
    showSplitViewBtn,
    isSecondHalf,
  }) => {
    let customMessage = this.state.customMessage
    if (isSecondHalf) {
      customMessage = this.state.secondCustomMessage
    }

    return (
      <div className="loading-container-centered">
        {this.getIsSuggestionResponse(queryOutputProps.queryResponse) &&
          this.renderSuggestionMessage(customMessage)}
        {!customMessage && (
          <QueryOutput
            authentication={getAuthentication(this.props.authentication)}
            themeConfig={getThemeConfig(this.props.themeConfig)}
            autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
            dataFormatting={getDataFormatting(this.props.dataFormatting)}
            renderTooltips={false}
            autoSelectQueryValidationSuggestion={false}
            isDashboardQuery={true}
            autoChartAggregations={this.props.autoChartAggregations}
            isResizing={this.props.isDragging}
            renderSuggestionsAsDropdown={this.props.tile.h < 4}
            enableDynamicCharting={this.props.enableDynamicCharting}
            onUpdate={this.props.onQueryOutputUpdate}
            backgroundColor={document.documentElement.style.getPropertyValue(
              '--react-autoql-background-color-primary'
            )}
            onDisplayTypeUpdate={() => {
              // This is necessary to update the toolbar with the newly rendered QueryOutput
              setTimeout(() => {
                this.forceUpdate()
              }, 0)
            }}
            {...queryOutputProps}
          />
        )}
        {this.renderDataLimitWarning()}

        {!this.props.isDragging && this.props.isEditing && (
          <div className="dashboard-tile-viz-toolbar-container">
            {this.props.isEditing &&
              showSplitViewBtn &&
              this.renderSplitViewBtn()}
            <VizToolbar
              themeConfig={getThemeConfig(this.props.themeConfig)}
              {...vizToolbarProps}
            />
          </div>
        )}
        {!this.props.isDragging && (
          <OptionsToolbar
            authentication={getAuthentication(this.props.authentication)}
            autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
            themeConfig={getThemeConfig(this.props.themeConfig)}
            onErrorCallback={this.props.onErrorCallback}
            onSuccessAlert={this.props.onSuccessCallback}
            {...optionsToolbarProps}
          />
        )}
      </div>
    )
  }

  renderTopResponse = () => {
    const isExecuting = this.state.isTopExecuting
    const isExecuted = this.state.isTopExecuted

    if (!this.props.queryResponse || isExecuting || !isExecuted) {
      return this.renderContentPlaceholder({ isExecuting, isExecuted })
    }

    const displayType = this.props.displayType

    return this.renderResponse({
      queryOutputProps: {
        ref: (ref) => (this.responseRef = ref),
        optionsToolbarRef: this.optionsToolbarRef,
        key: `dashboard-tile-query-top-${this.COMPONENT_KEY}`,
        displayType,
        queryResponse: this.props.queryResponse,
        dataConfig: this.props.tile.dataConfig,
        onDataConfigChange: this.onDataConfigChange,
        queryValidationSelections: this.props.tile.queryValidationSelections,
        onSuggestionClick: this.onSuggestionClick,
        selectedSuggestion: _get(this.props.tile, 'selectedSuggestion'),
        onNoneOfTheseClick: this.onNoneOfTheseClick,
        onDataClick: (drilldownData, queryID, activeKey) => {
          this.props.processDrilldown({
            tileId: this.props.tile.i,
            drilldownData,
            queryID,
            activeKey,
            isSecondHalf: false,
          })
        },
        onQueryValidationSelectOption: this.onQueryValidationSelectOption,
        onSupportedDisplayTypesChange: this.onSupportedDisplayTypesChange,
        onRecommendedDisplayType: (displayType) => {
          this.onDisplayTypeChange(displayType)
        },
        reportProblemCallback: this.reportProblemCallback,
      },
      vizToolbarProps: {
        displayType: displayType,
        onDisplayTypeChange: this.onDisplayTypeChange,
        supportedDisplayTypes: this.state.supportedDisplayTypes,
      },
      optionsToolbarProps: {
        ref: (r) => (this.optionsToolbarRef = r),
        responseRef: this.responseRef,
        onFilterClick: ({ isFilteringTable }) =>
          this.toggleTableFilter(this.responseRef, isFilteringTable),
        displayType,
      },
      showSplitViewBtn: !this.getIsSplitView(),
    })
  }

  renderBottomResponse = () => {
    const isExecuting = this.state.isBottomExecuting
    const isExecuted = this.state.isBottomExecuted

    const queryResponse =
      this.props.tile.secondQueryResponse || this.props.queryResponse

    if (!queryResponse || isExecuting || !isExecuted) {
      return this.renderContentPlaceholder({ isExecuting, isExecuted })
    }

    const displayType = this.props.secondDisplayType

    return this.renderResponse({
      queryOutputProps: {
        key: `dashboard-tile-query-bottom-${this.COMPONENT_KEY}`,
        ref: (ref) => (this.secondResponseRef = ref),
        optionsToolbarRef: this.secondOptionsToolbarRef,
        displayType,
        queryResponse,
        dataConfig: this.props.tile.secondDataConfig,
        onDataConfigChange: this.onSecondDataConfigChange,
        queryValidationSelections: this.props.tile
          .secondqueryValidationSelections,
        onSuggestionClick: this.onSecondSuggestionClick,
        selectedSuggestion: _get(this.props.tile, 'secondSelectedSuggestion'),
        reportProblemCallback: this.secondReportProblemCallback,
        onSupportedDisplayTypesChange: this.onSecondSupportedDisplayTypesChange,
        onRecommendedDisplayType: this.onSecondDisplayTypeChange,
        onNoneOfTheseClick: this.secondOnNoneOfTheseClick,
        onDataClick: (drilldownData, queryID, activeKey) => {
          this.props.processDrilldown({
            tileId: this.props.tile.i,
            drilldownData,
            queryID,
            activeKey,
            isSecondHalf: true,
          })
        },
        onQueryValidationSelectOption: this.onSecondQueryValidationSelectOption,
      },
      vizToolbarProps: {
        displayType: displayType,
        onDisplayTypeChange: this.onSecondDisplayTypeChange,
        supportedDisplayTypes: this.state.secondSupportedDisplayTypes,
      },
      optionsToolbarProps: {
        ref: (r) => (this.secondOptionsToolbarRef = r),
        responseRef: this.secondResponseRef,
        onFilterClick: ({ isFilteringTable }) =>
          this.toggleTableFilter(this.secondResponseRef, isFilteringTable),
        displayType,
      },
      showSplitViewBtn: this.getIsSplitView(),
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

  renderDataLimitWarning = () => {
    const numRows = _get(this.props, 'queryResponse.data.data.rows.length')
    const maxRowLimit = _get(this.props, 'queryResponse.data.data.row_limit')

    if (maxRowLimit && numRows === maxRowLimit) {
      return (
        <Icon
          type="warning"
          className="dashboard-data-limit-warning-icon"
          data-tip={`The display limit of ${numRows} rows has been reached. Try querying a smaller time-frame to ensure all your data is displayed.`}
          data-for="dashboard-data-limit-warning-tooltip"
        />
      )
    }
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
export default React.forwardRef(({ style, className, ...props }, ref) => (
  <div style={{ ...style }} className={className} ref={ref}>
    <DashboardTile
      {...props}
      ref={props.tileRef}
      className={`${props.innerDivClass} ${props.isEditing ? 'editing' : ''}`}
      data-test="react-autoql-dashboard-tile"
    />
  </div>
))
