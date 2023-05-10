import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'
import Autosuggest from 'react-autosuggest'
import SplitterLayout from 'react-splitter-layout'

import { QueryOutput } from '../../QueryOutput'
import { VizToolbar } from '../../VizToolbar'
import { OptionsToolbar } from '../../OptionsToolbar'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import LoadingDots from '../../LoadingDots/LoadingDots.js'
import { Icon } from '../../Icon'
import { responseErrors } from '../../../js/errorMessages'
import { deepEqual, isChartType, mergeSources } from '../../../js/Util'
import { hideTooltips } from '../../Tooltip'

import { runQuery, fetchAutocomplete } from '../../../js/queryService'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAuthentication,
  getAutoQLConfig,
} from '../../../props/defaults'

import './DashboardTile.scss'

let autoCompleteArray = []

export class DashboardTile extends React.Component {
  constructor(props) {
    super(props)
    this.dashboardTileTitleRef = undefined
    this.optionsToolbarRef = undefined
    this.secondOptionsToolbarRef = undefined
    this.COMPONENT_KEY = uuid()
    this.FIRST_QUERY_RESPONSE_KEY = uuid()
    this.SECOND_QUERY_RESPONSE_KEY = uuid()
    this.DEFAULT_AJAX_PAGE_SIZE = 50
    this.autoCompleteTimer = undefined
    this.debounceTime = 50
    this.paramsToSet = {}
    this.callbackArray = []

    const tile = props.tile

    this.state = {
      query: tile.query,
      secondQuery: tile.secondQuery || tile.query,
      title: tile.title,
      isTopExecuting: false,
      isBottomExecuting: false,
      suggestions: [],
      isSecondQueryInputOpen: false,
      isTitleOverFlow: false,
      isTopExecuted: !!tile.queryResponse,
      isBottomExecuted:
        tile.splitView && (this.areTopAndBottomSameQuery() ? !!tile.queryResponse : !!tile.secondQueryResponse),
    }
  }

  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,

    tile: PropTypes.shape({}).isRequired,
    isEditing: PropTypes.bool,
    deleteTile: PropTypes.func,
    dataPageSize: PropTypes.number,
    queryResponse: PropTypes.shape({}),
    notExecutedText: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    onErrorCallback: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    onCSVDownloadStart: PropTypes.func,
    onCSVDownloadProgress: PropTypes.func,
    onCSVDownloadFinish: PropTypes.func,
    enableAjaxTableData: PropTypes.bool,
    cancelQueriesOnUnmount: PropTypes.bool,
  }

  static defaultProps = {
    // Global
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    query: '',
    title: '',
    isEditing: false,
    displayType: 'table',
    dataPageSize: undefined,
    queryValidationSelections: undefined,
    defaultSelectedSuggestion: undefined,
    notExecutedText: 'Hit "Execute" to run this dashboard',
    autoChartAggregations: true,
    enableAjaxTableData: false,
    cancelQueriesOnUnmount: true,
    deleteTile: () => {},
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
    if (nextProps.isDragging && this.props.isDragging) {
      return false
    }

    const thisPropsFiltered = this.getFilteredProps(this.props)
    const nextPropsFiltered = this.getFilteredProps(nextProps)

    return !deepEqual(thisPropsFiltered, nextPropsFiltered) || !deepEqual(this.state, nextState)
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (prevProps.tile !== this.props.tile) {
      this.setState({ isTitleOverFlow: this.isTitleOverFlow() })
    }

    // If query or title change from props (due to undo for example), update state
    if (this.props.tile?.title !== prevProps.tile?.title) {
      this.setState({ title: this.props.tile?.title })
    }
    if (this.props.tile?.query !== prevProps.tile?.query) {
      this.setState({ query: this.props.tile?.query })
    }
    if (this.props.tile?.secondQuery !== prevProps.tile?.secondQuery) {
      this.setState({ secondQuery: this.props.tile?.secondQuery })
    }
    if (
      this.responseRef?._isMounted &&
      this.props.tile?.displayType &&
      this.props.tile.displayType !== prevProps.tile?.displayType &&
      this.props.tile.displayType !== this.responseRef.state.displayType
    ) {
      this.responseRef.changeDisplayType(this.props.tile.displayType)
    }
  }

  componentWillUnmount = () => {
    try {
      this._isMounted = false

      clearTimeout(this.autoCompleteTimer)
      clearTimeout(this.dragEndTimeout)
      clearTimeout(this.setParamsForTileTimeout)
      clearTimeout(this.queryInputTimer)
      clearTimeout(this.secondQueryInputTimer)

      if (this.props.cancelQueriesOnUnmount) {
        this.cancelAllQueries()
      }
    } catch (error) {
      console.error(error)
    }
  }

  refreshLayout = () => {
    this.state.responseRef?.refreshLayout()
    this.state.secondResponseRef?.refreshLayout()
  }

  cancelAllQueries = () => {
    this.axiosSource?.cancel(responseErrors.CANCELLED)
    this.secondAxiosSource?.cancel(responseErrors.CANCELLED)
  }

  debouncedSetParamsForTile = (params, callback) => {
    if (!this._isMounted) {
      clearTimeout(this.setParamsForTileTimeout)
      return
    }

    this.paramsToSet = {
      ...this.paramsToSet,
      ...params,
    }

    if (typeof callback === 'function') {
      this.callbackArray = [...this.callbackArray, callback]
    }

    clearTimeout(this.setParamsForTileTimeout)
    this.setParamsForTileTimeout = setTimeout(() => {
      this.props.setParamsForTile(this.paramsToSet, this.props.tile.i, _cloneDeep(this.callbackArray))
      this.paramsToSet = {}
      this.callbackArray = []
    }, this.debounceTime)
  }

  getFilteredProps = (props) => {
    return {
      ...props,
      children: undefined,
      tileRef: undefined,
    }
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
    if (response?.data?.message !== responseErrors.CANCELLED) {
      // Update component key after getting new response
      // so QueryOutput completely resets
      this.debouncedSetParamsForTile(
        {
          queryResponse: response,
          defaultSelectedSuggestion: undefined,
        },
        this.setTopExecuted,
      )
      return response
    } else {
      return Promise.reject(responseErrors.CANCELLED)
    }
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
    if (response?.data?.message !== responseErrors.CANCELLED) {
      this.debouncedSetParamsForTile(
        {
          secondQueryResponse: response,
          secondDefaultSelectedSuggestion: undefined,
        },
        this.setTopExecuted,
      )
      return response
    } else {
      return Promise.reject(responseErrors.CANCELLED)
    }
  }

  processQuery = ({ query, userSelection, skipQueryValidation, source, isSecondHalf }) => {
    if (this.isQueryValid(query)) {
      let pageSize
      if (isSecondHalf && isChartType(this.props.tile.secondDisplayType)) {
        pageSize = this.props.tile.secondPageSize ?? this.props.dataPageSize
      } else if (isChartType(this.props.tile.displayType)) {
        pageSize = this.props.tile.pageSize ?? this.props.dataPageSize
      }

      const requestData = {
        ...getAuthentication(this.props.authentication),
        ...getAutoQLConfig(this.props.autoQLConfig),
        enableQueryValidation: !this.props.isEditing
          ? false
          : getAutoQLConfig(this.props.autoQLConfig).enableQueryValidation,
        cancelToken: isSecondHalf ? this.secondAxiosSource.token : this.axiosSource.token,
        skipQueryValidation: skipQueryValidation,
        source: mergeSources(this.props.source, source),
        scope: 'dashboards', // Hardcode this for now until we change the filter lock blacklist to a whitelist
        userSelection,
        pageSize,
        query,
      }

      return runQuery(requestData)
        .then((response) => {
          if (isSecondHalf) {
            this.bottomRequestData = requestData
          } else {
            this.topRequestData = requestData
          }
          return Promise.resolve(response)
        })
        .catch((error) => Promise.reject(error))
    }
    return Promise.reject()
  }

  processTileTop = ({ query, userSelection, skipQueryValidation, source, pageSize }) => {
    this.setState({ isTopExecuting: true, queryResponse: null })
    const queryChanged = this.props.tile.query !== query
    const skipValidation = skipQueryValidation || (this.props.tile.skipQueryValidation && !queryChanged)

    const queryValidationSelections =
      userSelection || (queryChanged ? undefined : _get(this.props.tile, 'queryValidationSelections'))

    // New query is running, reset temporary state fields
    this.debouncedSetParamsForTile({
      query,
      dataConfig: queryChanged ? undefined : this.props.tile.dataConfig,
      skipQueryValidation: skipValidation,
      columns: queryChanged ? undefined : this.props.tile.columns,
      defaultSelectedSuggestion: undefined,
      queryValidationSelections,
    })

    return this.processQuery({
      query,
      userSelection: queryValidationSelections,
      skipQueryValidation: skipQueryValidation,
      source,
      pageSize,
      isSecondHalf: false,
    })
      .then((response) => {
        return this.endTopQuery({ response })
      })
      .catch((response) => {
        if (response?.data?.message === responseErrors.CANCELLED) {
          return undefined
        }

        return this.endTopQuery({ response })
      })
  }

  processTileBottom = ({ query, userSelection, skipQueryValidation, source }) => {
    this.setState({
      isBottomExecuting: true,
      isSecondQueryInputOpen: false,
      secondQueryResponse: null,
    })

    const queryChanged = this.props.tile.secondQuery !== query
    const skipValidation = skipQueryValidation || (this.props.tile.secondskipQueryValidation && !queryChanged)

    const queryValidationSelections =
      userSelection || (queryChanged ? undefined : _get(this.props.tile, 'secondQueryValidationSelections'))

    // New query is running, reset temporary state fields
    this.debouncedSetParamsForTile({
      secondQuery: query,
      secondDataConfig: queryChanged ? undefined : this.props.tile.secondDataConfig,
      secondskipQueryValidation: skipValidation,
      secondColumns: queryChanged ? undefined : this.props.tile.secondColumns,
      secondDefaultSelectedSuggestion: undefined,
      secondQueryValidationSelections: queryValidationSelections,
    })

    return this.processQuery({
      query,
      userSelection: queryValidationSelections,
      skipQueryValidation: skipQueryValidation,
      source,
      isSecondHalf: true,
    })
      .then((response) => {
        return this.endBottomQuery({ response })
      })
      .catch((response) => {
        if (response?.data?.message === responseErrors.CANCELLED) {
          return undefined
        }

        return this.endBottomQuery({ response })
      })
  }

  clearTopQueryResponse = (newState = {}) => {
    this.setState({
      isTopExecuting: false,
      isTopExecuted: false,
      userSelection: undefined,
      ...newState,
    })

    this.debouncedSetParamsForTile({
      queryResponse: undefined,
    })
  }

  clearBottomQueryResponse = (newState = {}) => {
    this.setState({
      isBottomExecuted: false,
      isBottomExecuting: false,
      secondUserSelection: undefined,
      ...newState,
    })

    this.debouncedSetParamsForTile({
      secondQueryResponse: undefined,
    })
  }

  processTile = ({ query, secondQuery, skipQueryValidation, secondskipQueryValidation, source } = {}) => {
    // If tile is already processing, cancel current process
    this.secondAxiosSource?.cancel(responseErrors.CANCELLED)
    this.axiosSource?.cancel(responseErrors.CANCELLED)

    // Create new cancel tokens for each query
    this.axiosSource = axios.CancelToken?.source()
    this.secondAxiosSource = axios.CancelToken.source()

    const q1 = query || this.props.tile.defaultSelectedSuggestion || this.state.query
    const q2 = secondQuery || this.props.tile.secondDefaultSelectedSuggestion || this.state.secondQuery

    const promises = []

    if (this.getIsSplitView() && q2 && q1 !== q2) {
      promises[1] = this.processTileBottom({
        query: q2,
        skipQueryValidation: secondskipQueryValidation,
        source,
      })
    }

    promises[0] = this.processTileTop({ query: q1, skipQueryValidation, source })

    return Promise.all(promises)
      .then((queryResponses) => {
        return {
          ...this.props.tile,
          queryResponse: queryResponses?.[0],
          secondQueryResponse: queryResponses?.[1],
          defaultSelectedSuggestion: undefined,
          secondDefaultSelectedSuggestion: undefined,
        }
      })
      .catch(() => {
        return Promise.reject()
      })
  }

  debounceQueryInputChange = (query) => {
    if (query === this.state.query) {
      return
    }

    const newState = { query, queryValidationSelections: undefined }
    this.clearTopQueryResponse(newState)

    clearTimeout(this.queryInputTimer)
    this.queryInputTimer = setTimeout(() => {
      this.debouncedSetParamsForTile({ query, dataConfig: undefined, queryValidationSelections: undefined })
    }, 600)
  }

  debounceSecondQueryInputChange = (secondQuery) => {
    if (secondQuery === this.state.secondQuery) {
      return
    }

    const newState = { secondQuery }
    this.clearBottomQueryResponse(newState)

    clearTimeout(this.secondQueryInputTimer)
    this.secondQueryInputTimer = setTimeout(() => {
      this.debouncedSetParamsForTile({
        secondQuery,
        secondDataConfig: undefined,
        secondQueryValidationSelections: undefined,
      })
    }, 600)
  }

  debounceTitleInputChange = (title) => {
    this.setState({ title })

    clearTimeout(this.titleInputTimer)
    this.titleInputTimer = setTimeout(() => {
      this.debouncedSetParamsForTile({ title })
    }, 600)
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
      this.debouncedSetParamsForTile({ defaultSelectedSuggestion: query })
    }
  }

  onSecondSuggestionClick = ({ query, userSelection, isButtonClick, source }) => {
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
    if (userSelectedValueFromSuggestionBox && userSelectedValueFromSuggestionBox.name && this._isMounted) {
      const newQuery = userSelectedValueFromSuggestionBox.name
      this.userSelectedValue = newQuery
      this.userSelectedSuggestion = true
      this.setState({ query: newQuery })
      this.debouncedSetParamsForTile({ query: newQuery })
    }
  }

  onQueryInputChange = (e) => {
    // If input change we want to start validating the new queries again
    if (this.props.tile.skipQueryValidation) {
      this.debouncedSetParamsForTile({ skipQueryValidation: false })
    }

    if (this.userSelectedSuggestion && (e.keyCode === 38 || e.keyCode === 40)) {
      // keyup or keydown
      return // return to let the component handle it...
    }

    if (e?.target?.value || e?.target?.value === '') {
      this.debounceQueryInputChange(e.target.value)
    } else {
      // User clicked on autosuggest item
      this.processTile({ query: this.userSelectedValue })
    }
  }

  onSecondQueryInputChange = (e) => {
    this.setState({ secondQuery: e.target.value })
    this.debouncedSetParamsForTile({ secondSkipQueryValidation: false })
  }

  getIsSplitView = () => this.props.tile?.splitView

  toggleSecondQueryInput = () => {
    this.setState({
      isSecondQueryInputOpen: !this.state.isSecondQueryInputOpen,
    })
  }

  isTitleOverFlow = () => {
    const dashboardTileTitleElement = this.dashboardTileTitleRef
    if (dashboardTileTitleElement) {
      const elemWidth = dashboardTileTitleElement.getBoundingClientRect().width
      const parentWidth = dashboardTileTitleElement.parentElement.getBoundingClientRect().width
      return elemWidth > parentWidth
    }
    return false
  }

  onQueryValidationSelectOption = (queryText, selections) => {
    this.setState({ query: queryText })
    this.debouncedSetParamsForTile({
      query: queryText,
      queryValidationSelections: selections,
    })
  }

  onSecondQueryValidationSelectOption = (queryText, selections) => {
    this.setState({ secondQuery: queryText })
    this.debouncedSetParamsForTile({
      secondQuery: queryText,
      secondqueryValidationSelections: selections,
    })
  }

  onPageSizeChange = (pageSize) => this.debouncedSetParamsForTile({ pageSize })
  onAggConfigChange = (config) => this.debouncedSetParamsForTile({ aggConfig: config })
  onDataConfigChange = (config) => this.debouncedSetParamsForTile({ dataConfig: config })
  onDisplayTypeChange = (displayType) => this.debouncedSetParamsForTile({ displayType })

  onSecondPageSizeChange = (secondPageSize) => this.debouncedSetParamsForTile({ secondPageSize })
  onSecondAggConfigChange = (config) => this.debouncedSetParamsForTile({ secondAggConfig: config })
  onSecondDataConfigChange = (config) => this.debouncedSetParamsForTile({ secondDataConfig: config })
  onSecondDisplayTypeChange = (secondDisplayType) => this.debouncedSetParamsForTile({ secondDisplayType })

  reportProblemCallback = () => {
    if (this.optionsToolbarRef?._isMounted) {
      this.optionsToolbarRef?.openReportProblemModal()
    }
  }

  secondReportProblemCallback = () => {
    if (this.secondOptionsToolbarRef?._isMounted) {
      this.secondOptionsToolbarRef.openReportProblemModal()
    }
  }

  onSplitViewClick = () => {
    const splitView = !this.props.tile?.splitView
    let secondQuery = this.props.tile?.secondQuery

    if (splitView && !secondQuery) {
      secondQuery = this.state.query
    }

    this.debouncedSetParamsForTile({ splitView, secondQuery })

    hideTooltips()
  }

  renderSplitResponse = () => {
    const secondQueryInputWidth = _get(this.tileInnerDiv, 'clientWidth')
      ? `${this.tileInnerDiv.clientWidth - 70}px`
      : '0px'

    return (
      <SplitterLayout
        key={`dashboard-tile-splitter-layout-${this.COMPONENT_KEY}`}
        vertical={true}
        percentage={true}
        primaryMinSize={30}
        secondaryMinSize={30}
        secondaryInitialSize={this.props.secondDisplayPercentage || 50}
        onDragStart={() => {
          this.setState({ isDraggingSplitter: true })
        }}
        onDragEnd={() => {
          this.dragEndTimeout = setTimeout(() => {
            const percentString = _get(this.tileInnerDiv, 'style.height', '')
            const percentNumber = Number(percentString.substring(0, percentString.length - 1))

            if (!isNaN(percentNumber)) {
              this.debouncedSetParamsForTile({
                secondDisplayPercentage: percentNumber,
              })
            }

            this.setState({ isDraggingSplitter: false })
          }, 1000)
        }}
      >
        <div className='dashboard-tile-split-pane-container'>{this.renderTopResponse()}</div>
        <div className='dashboard-tile-split-pane-container'>
          {this.renderBottomResponse()}
          {this.props.isEditing && (
            <div
              className='react-autoql-toolbar viz-toolbar split-view-btn split-view-query-btn'
              data-test='split-view-query-btn'
            >
              <button
                onClick={() => {
                  this.toggleSecondQueryInput()
                  hideTooltips()
                }}
                className='react-autoql-toolbar-btn'
                data-tip='Query'
                data-for={this.props.tooltipID}
                style={{ paddingLeft: '3px', marginRight: '10px' }}
              >
                <Icon type='react-autoql-bubbles-outlined' />
                <Icon
                  type={this.state.isSecondQueryInputOpen ? 'caret-left' : 'caret-right'}
                  style={{
                    position: 'absolute',
                    top: '13px',
                    left: '31px',
                    fontSize: '10px',
                  }}
                />
              </button>
              <input
                className={`dashboard-tile-input query second ${this.state.isSecondQueryInputOpen ? 'open' : ''}`}
                value={this.state.secondQuery}
                spellCheck={false}
                onChange={this.onSecondQueryInputChange}
                onKeyDown={this.onSecondQueryTextKeyDown}
                placeholder={this.props.tile.query || 'Type a query'}
                style={{
                  width: this.state.isSecondQueryInputOpen ? secondQueryInputWidth : '0px',
                }}
              />
            </div>
          )}
        </div>
      </SplitterLayout>
    )
  }

  renderHeader = () => {
    if (this.props.isEditing) {
      return (
        <div className='dashboard-tile-edit-wrapper'>
          <div
            className={`dashboard-tile-input-container
            ${this.state.isQueryInputFocused ? 'query-focused' : ''}
            ${this.state.isTitleInputFocused ? 'title-focused' : ''}`}
          >
            <div className='dashboard-tile-left-input-container'>
              <Icon className='query-input-icon' type='react-autoql-bubbles-outlined' />
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
                    className: 'dashboard-tile-autocomplete-input',
                    placeholder: 'Type a query in your own words',
                    value: this.state.query,
                    'data-tip': 'Query',
                    'data-for': this.props.tooltipID,
                    'data-place': 'bottom',
                    onFocus: (e) => {
                      e.stopPropagation()
                      this.setState({ isQueryInputFocused: true })
                    },
                    onChange: this.onQueryInputChange,
                    onKeyDown: this.onQueryTextKeyDown,
                    onBlur: () => this.setState({ isQueryInputFocused: false }),
                  }}
                />
              ) : (
                <input
                  className='dashboard-tile-input query'
                  placeholder='Type a query in your own words'
                  value={this.state.query}
                  data-tip='Query'
                  data-for={this.props.tooltipID}
                  data-place='bottom'
                  spellCheck={false}
                  onChange={this.onQueryInputChange}
                  onKeyDown={this.onQueryTextKeyDown}
                  onFocus={() => this.setState({ isQueryInputFocused: true })}
                  onBlur={() => this.setState({ isQueryInputFocused: false })}
                />
              )}
            </div>

            <div className='dashboard-tile-right-input-container'>
              <Icon className='title-input-icon' type='title' />
              <input
                className='dashboard-tile-input title'
                placeholder='Add descriptive title (optional)'
                data-tip='Title'
                data-for={this.props.tooltipID}
                data-place='bottom'
                value={this.state.title}
                onChange={(e) => this.debounceTitleInputChange(e.target.value)}
                onFocus={() => this.setState({ isTitleInputFocused: true })}
                onBlur={() => this.setState({ isTitleInputFocused: false })}
              />
            </div>
          </div>
          <div className={`dashboard-tile-play-button${!this.isQueryValid(this.state.query) ? ' disabled' : ''}`}>
            <Icon type='play' onClick={() => this.processTile()} data-tip='Run tile' data-place='left' />
          </div>
        </div>
      )
    }

    return (
      <div className='dashboard-tile-title-container'>
        <span
          ref={(r) => (this.dashboardTileTitleRef = r)}
          className='dashboard-tile-title'
          id={`dashboard-tile-title-${this.COMPONENT_KEY}`}
          data-tip={this.state.isTitleOverFlow ? this.props.tile.title || this.props.tile.query || 'Untitled' : null}
          data-for='react-autoql-dashboard-tile-title-tooltip'
        >
          {this.props.tile.title || this.props.tile.query || 'Untitled'}
        </span>
        <div className='dashboard-tile-title-divider'></div>
      </div>
    )
  }

  renderContentPlaceholder = ({ isExecuting, isExecuted } = {}) => {
    if (isExecuting) {
      // This should always take priority over the other conditions below
      return (
        <div className='loading-container-centered'>
          <LoadingDots />
        </div>
      )
    }

    if (!this.state.query?.trim()) {
      return (
        <div className='loading-container-centered'>
          <div className='dashboard-tile-placeholder-text'>
            {this.props.isEditing ? (
              <span>
                To get started, enter a query and click <Icon className='play-icon' type='play' />
              </span>
            ) : (
              <span>No query was supplied for this tile.</span>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className='loading-container-centered'>
        <div className='dashboard-tile-placeholder-text'>
          {this.props.isEditing ? (
            <span>
              Hit <Icon className='edit-mode-placeholder-icon' type='play' /> to run this tile
            </span>
          ) : (
            <span>{this.props.notExecutedText}</span>
          )}
        </div>
      </div>
    )
  }

  renderSplitViewBtn = () => {
    return (
      <div className='viz-toolbar split-view-btn' data-test='split-view-btn'>
        <button
          onClick={this.onSplitViewClick}
          className={`react-autoql-toolbar-btn ${this.getIsSplitView() ? 'active' : ''}`}
          data-tip={this.props.tile.splitView ? 'Split View On' : 'Split View Off'}
          data-for={this.props.tooltipID}
          data-test='viz-toolbar-button'
        >
          <Icon type='split-view' />
        </button>
      </div>
    )
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

  onDrilldownStart = (activeKey) =>
    this.props.onDrilldownStart({
      tileId: this.props.tile.i,
      isSecondHalf: false,
      activeKey,
      queryOutputRef: this.state.responseRef,
    })

  renderToolbars = ({ queryOutputProps, vizToolbarProps, optionsToolbarProps, isSecondHalf }) => {
    return (
      <div className='dashboard-tile-toolbars-container'>
        <div className='dashboard-tile-toolbars-left-container'>
          {this.props.isEditing && (isSecondHalf || !this.getIsSplitView()) && this.renderSplitViewBtn()}
          {this.props.isEditing && (
            <VizToolbar {...vizToolbarProps} shouldRender={!this.props.isDragging} tooltipID={this.props.tooltipID} />
          )}
        </div>
        <div className='dashboard-tile-toolbars-right-container'>
          <OptionsToolbar
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            onErrorCallback={this.props.onErrorCallback}
            onSuccessAlert={this.props.onSuccessCallback}
            onCSVDownloadStart={this.onCSVDownloadStart}
            onCSVDownloadProgress={this.onCSVDownloadProgress}
            onCSVDownloadFinish={this.onCSVDownloadFinish}
            shouldRender={!this.props.isDragging}
            tooltipID={this.props.tooltipID}
            popoverPositions={['top', 'left', 'bottom', 'right']}
            popoverAlign='end'
            {...optionsToolbarProps}
          />
        </div>
      </div>
    )
  }

  renderResponseContent = ({ queryOutputProps, isExecuting, isExecuted, renderPlaceholder }) => {
    if (renderPlaceholder) {
      return this.renderContentPlaceholder({
        isExecuting,
        isExecuted,
      })
    }

    return (
      <QueryOutput
        key={`${this.props.tile?.key}${this.props.isEditing ? '-editing' : '-notediting'}`}
        authentication={this.props.authentication}
        autoQLConfig={this.props.autoQLConfig}
        dataFormatting={this.props.dataFormatting}
        renderTooltips={false}
        autoSelectQueryValidationSuggestion={false}
        autoChartAggregations={this.props.autoChartAggregations}
        isResizing={this.props.isDragging || this.state.isDraggingSplitter}
        renderSuggestionsAsDropdown={this.props.tile.h < 4}
        enableDynamicCharting={this.props.enableDynamicCharting}
        backgroundColor={document.documentElement.style.getPropertyValue('--react-autoql-background-color-secondary')}
        enableAjaxTableData={this.props.enableAjaxTableData}
        showQueryInterpretation={this.props.isEditing}
        reverseTranslationPlacement='top'
        tooltipID={this.props.tooltipID}
        chartTooltipID={this.props.chartTooltipID}
        shouldRender={!this.props.isDragging}
        source={this.props.source}
        scope={this.props.scope}
        autoHeight={false}
        height='100%'
        width='100%'
        {...queryOutputProps}
      />
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
      <div className='loading-container-centered' id={queryOutputProps.key}>
        {this.renderResponseContent({
          queryOutputProps,
          isExecuting,
          isExecuted,
          renderPlaceholder,
          isSecondHalf,
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

    const renderPlaceholder = !this.props.tile?.queryResponse || isExecuting || !isExecuted

    const initialDisplayType = this.props?.displayType

    return this.renderResponse({
      renderPlaceholder,
      isExecuting,
      isExecuted,
      queryOutputProps: {
        ref: (ref) => ref && ref !== this.state.responseRef && this._isMounted && this.setState({ responseRef: ref }),
        optionsToolbarRef: this.optionsToolbarRef,
        vizToolbarRef: this.vizToolbarRef,
        key: `dashboard-tile-query-top-${this.FIRST_QUERY_RESPONSE_KEY}`,
        initialDisplayType,
        queryResponse: this.props.tile?.queryResponse,
        initialTableConfigs: this.props.tile.dataConfig,
        initialAggConfig: this.props.tile.aggConfig,
        onTableConfigChange: this.onDataConfigChange,
        onAggConfigChange: this.onAggConfigChange,
        queryValidationSelections: this.props.tile.queryValidationSelections,
        onSuggestionClick: this.onSuggestionClick,
        defaultSelectedSuggestion: _get(this.props.tile, 'defaultSelectedSuggestion'),
        onNoneOfTheseClick: this.onNoneOfTheseClick,
        onDrilldownStart: this.onDrilldownStart,
        onDrilldownEnd: this.props.onDrilldownEnd,
        onQueryValidationSelectOption: this.onQueryValidationSelectOption,
        reportProblemCallback: this.reportProblemCallback,
        queryRequestData: this.topRequestData,
        onDisplayTypeChange: this.onDisplayTypeChange,
        pageSize: this.props.tile.pageSize,
        onPageSizeChange: this.onPageSizeChange,
      },
      vizToolbarProps: {
        ref: (r) => (this.vizToolbarRef = r),
        responseRef: this.state.responseRef,
      },
      optionsToolbarProps: {
        ref: (r) => (this.optionsToolbarRef = r),
        responseRef: this.state.responseRef,
      },
    })
  }

  areTopAndBottomSameQuery = () => {
    const topQuery = this.props?.tile?.query
    const bottomQuery = this.props?.tile?.secondQuery
    const isQuerySame = !bottomQuery || topQuery === bottomQuery
    return isQuerySame
  }

  renderBottomResponse = () => {
    const isQuerySameAsTop = this.areTopAndBottomSameQuery()

    let isExecuting = this.state.isBottomExecuting
    let isExecuted = this.state.isBottomExecuted
    let queryRequestData = this.bottomRequestData

    if (isQuerySameAsTop) {
      isExecuting = this.state.isTopExecuting
      isExecuted = this.state.isTopExecuted
      queryRequestData = this.topRequestData
    }

    const renderPlaceholder =
      (!isQuerySameAsTop && !this.props.tile?.secondQueryResponse) ||
      (isQuerySameAsTop && !this.props.tile?.queryResponse) ||
      isExecuting ||
      !isExecuted

    const initialDisplayType = this.props?.secondDisplayType

    return this.renderResponse({
      renderPlaceholder,
      isExecuting,
      isExecuted,
      queryOutputProps: {
        key: `dashboard-tile-query-bottom-${this.SECOND_QUERY_RESPONSE_KEY}`,
        ref: (ref) =>
          ref && ref !== this.state.secondResponseRef && this._isMounted && this.setState({ secondResponseRef: ref }),
        optionsToolbarRef: this.secondOptionsToolbarRef,
        vizToolbarRef: this.secondVizToolbarRef,
        initialDisplayType,
        queryResponse: this.props.tile?.secondQueryResponse || this.props.tile?.queryResponse,
        initialTableConfigs: this.props.tile.secondDataConfig,
        initialAggConfig: this.props.tile.secondAggConfig,
        onTableConfigChange: this.onSecondDataConfigChange,
        onAggConfigChange: this.onSecondAggConfigChange,
        queryValidationSelections: this.props.tile.secondQueryValidationSelections,
        onSuggestionClick: this.onSecondSuggestionClick,
        defaultSelectedSuggestion: _get(this.props.tile, 'secondDefaultSelectedSuggestion'),
        reportProblemCallback: this.secondReportProblemCallback,
        onNoneOfTheseClick: this.secondOnNoneOfTheseClick,
        onDrilldownStart: (activeKey) => {
          this.props.onDrilldownStart({
            tileId: this.props.tile.i,
            isSecondHalf: true,
            activeKey,
            queryOutputRef: this.state.secondResponseRef,
          })
        },
        onDrilldownEnd: this.props.onDrilldownEnd,
        onQueryValidationSelectOption: this.onSecondQueryValidationSelectOption,
        queryRequestData,
        onDisplayTypeChange: this.onSecondDisplayTypeChange,
        pageSize: this.props.tile.secondPageSize,
        onPageSizeChange: this.onSecondPageSizeChange,
      },
      vizToolbarProps: {
        ref: (r) => (this.secondVizToolbarRef = r),
        responseRef: this.state.secondResponseRef,
      },
      optionsToolbarProps: {
        ref: (r) => (this.secondOptionsToolbarRef = r),
        responseRef: this.state.secondResponseRef,
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
        <div className='dashboard-tile-response-container'>
          {this.getIsSplitView() ? this.renderSplitResponse() : this.renderTopResponse()}
        </div>
      </div>
    )
  }

  renderDragHandle = (props, placement) => {
    return <div {...props} className={`react-autoql-dashboard-tile-drag-handle ${placement}`} />
  }

  renderDragHandles = () => {
    const propsToPassToDragHandle = {
      onMouseDown: (e) => {
        e.stopPropagation()
        return this.props.onMouseDown(e)
      },
      onMouseUp: (e) => {
        e.stopPropagation()
        return this.props.onMouseUp(e)
      },
      onTouchStart: (e) => {
        e.stopPropagation()
        return this.props.onTouchStart(e)
      },
      onTouchEnd: (e) => {
        e.stopPropagation()
        return this.props.onTouchEnd(e)
      },
    }

    return (
      <Fragment>
        {this.renderDragHandle(propsToPassToDragHandle, 'top')}
        {this.renderDragHandle(propsToPassToDragHandle, 'bottom')}
        {this.renderDragHandle(propsToPassToDragHandle, 'left')}
        {this.renderDragHandle(propsToPassToDragHandle, 'right')}
      </Fragment>
    )
  }

  renderDeleteBtn = () => {
    return (
      <div className='dashboard-tile-delete-button' onClick={() => this.props.deleteTile(this.props.tile.i)}>
        <Icon style={{ fontSize: '18px' }} type='close' />
      </div>
    )
  }

  render = () => {
    const style = {}
    if (this.props.isDragging) {
      style.pointerEvents = 'none'
    }

    return (
      <ErrorBoundary>
        <div
          ref={(r) => (this.ref = r)}
          className={this.props.className}
          style={{ ...this.props.style }}
          data-grid={this.props.tile}
          data-test='react-autoql-dashboard-tile'
        >
          {this.props.children}
          <div
            id={`react-autoql-dashboard-tile-inner-div-${this.COMPONENT_KEY}`}
            ref={(r) => (this.tileInnerDiv = r)}
            className={`react-autoql-dashboard-tile-inner-div
              ${this.getIsSplitView() ? 'split' : ''}`}
            style={style}
          >
            <Fragment>
              {this.renderHeader()}
              {this.renderContent()}
            </Fragment>
          </div>
          {this.props.isEditing && this.renderDragHandles()}
          {this.props.isEditing && this.renderDeleteBtn()}
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
      rglRef={ref}
      ref={props.tileRef}
      className={`${props.innerDivClass} ${props.isEditing ? 'editing' : ''}`}
    />
  </div>
))
